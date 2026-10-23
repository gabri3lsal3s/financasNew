import { toISODate } from "@/domain/money";
import type { PaymentMethod } from "@/types/schema";
import { inferCategoryKeyword } from "./category-inference";
import { cleanAcquirerPrefixes } from "./merchant-catalog";
import { parsePixEMVPayload } from "./pix-emv-parser";

export type TransactionNature = "expense" | "income" | "investment";
export type InvestmentSubtype = "contribution" | "dividend" | "trade" | "redemption";

export interface ParsedBankTransaction {
  id: string;
  bankName: string;
  nature: TransactionNature;
  type: "expense" | "income"; // Compatibilidade retroativa
  investmentSubtype?: InvestmentSubtype;
  amountCents: number;
  currency?: "BRL" | "USD";
  exchangeRate?: number;
  iofCents?: number;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: PaymentMethod;
  cardLastDigits?: string;
  cardBrand?: string;
  merchant?: string;
  assetTicker?: string;
  categorySlug?: string;
  rawText: string;
  timestamp: number;
  installments?: number;
  currentInstallment?: number;
  installmentAmountCents?: number;
  issuerBank?: string;
  isRefund?: boolean;
  status?: "completed" | "scheduled";
  isScheduled?: boolean;
  scheduledFor?: string;
  txId?: string;
  taxId?: string;
  payerName?: string;
  recipientName?: string;
  source?: "receipt" | "notification";
}


export interface BankNotificationPayload {
  title: string;
  text: string;
  packageName?: string;
  timestamp?: number;
}

export interface InstallmentInfo {
  installments: number;
  currentInstallment?: number;
  installmentAmountCents?: number;
  totalAmountCents?: number;
}

const BANK_PACKAGE_MAP: Record<string, string> = {
  // Principais fintechs e bancos digitais
  "com.nu.production": "Nubank",
  "br.com.intermedium": "Inter",
  "com.c6bank.app": "C6 Bank",
  "com.mercadopago.wallet": "Mercado Pago",
  "com.picpay": "PicPay",
  "br.com.uol.ps.myaccount": "PagBank",
  "br.com.uol.ps": "PagBank",
  "br.com.neon": "Neon",
  "br.com.bradesco.next": "Next",
  "com.btg.pactual.banking": "BTG Pactual",
  "com.btgpactual.investimentos": "BTG Investimentos",
  "br.com.xp.carteira": "XP Investimentos",
  "com.xpinc.investments": "XP Investimentos",
  "br.com.rico": "Rico",
  "br.com.rico.investimentos": "Rico",
  "com.binance.dev": "Binance",
  "com.nomadfinancial.app": "Nomad",
  "com.transferwise.android": "Wise",

  // Grandes bancos tradicionais
  "com.itau": "Itaú",
  "com.itau.personnalite": "Itaú Personnalité",
  "com.bradesco": "Bradesco",
  "com.santander.app": "Santander",
  "br.com.santander.way": "Santander",
  "br.gov.caixa.tem": "Caixa Tem",
  "br.com.gabba.Caixa": "Caixa",
  "br.com.bb.android": "Banco do Brasil",

  // Carteiras digitais
  "com.google.android.apps.walletnfcrel": "Carteira Google",
  "com.samsung.android.spay": "Samsung Pay",
  "com.samsung.android.raja.spay": "Samsung Pay",
};

/**
 * Expressões da Blacklist Semântica para descarte imediato de notificações
 * que não representam transações financeiras reais ou que gerariam duplicações/falsos positivos.
 */
const BLACKLIST_EXPRESSIONS: RegExp[] = [
  // Faturas fechadas / resumos / abertas
  /\bfatura\b.*?\b(?:fechou|fechada|est[áa]\s+fechada|abriu|aberta|dispon[íi]vel|pronta|fechamento)\b/i,
  /\bfechamento\b.*?\bfatura\b/i,
  /\bresumo\s+d[aeo]\s+fatura\b/i,
  /\bpague\s+o\s+valor\s+m[íi]nimo\b/i,

  // Pagamento de fatura confirmado (já computado pelas compras individuais no cartão)
  /\bpagamento\s+d[aeo]\s+(?:sua\s+)?fatura\b/i,
  /\bpagamento\s+efetuado\s+da\s+(?:sua\s+)?fatura\b/i,
  /\brecebemos\s+o\s+pagamento\s+da\s+(?:sua\s+)?fatura\b/i,
  /\bfatura\s+paga\b/i,
  /\bconfirmamos\s+o\s+pagamento\s+da\s+(?:sua\s+)?fatura\b/i,

  // Transações não autorizadas, recusas, bloqueios e falhas
  /\b(?:n[ãa]o\s+foi\s+autorizad[ao]|n[ãa]o\s+autorizad[ao])\b/i,
  /\b(?:compra|transa[çc][ãa]o)\s+(?:n[ãa]o\s+aprovada|recusada|cancelada|negada)\b/i,
  /\btransa[çc][ãa]o\s+negada\b/i,
  /\bcompra\s+negada\b/i,
  /\brecusad[ao]\s+por\b/i,
  /\brecusad[ao]\b/i,
  /\bsaldo\s+insuficiente\b/i,
  /\blimite\s+insuficiente\b/i,
  /\bcart[ãa]o\s+bloqueado\b/i,
  /\bbloqueado\s+temporariamente\b/i,
  /\bestorno\s+negado\b/i,

  // Ofertas de crédito, aumento de limite, empréstimos e promoções
  /\blimite\s+(?:aumentou|aprovado|pr[ée]-aprovado|dispon[íi]vel|foi\s+ajustado)\b/i,
  /\baumento\s+de\s+limite\b/i,
  /\bnovo\s+limite\b/i,
  /\b(?:empr[ée]stimo|cr[ée]dito)\s+pr[ée]-aprovado\b/i,
  /\boferta\s+(?:especial\s+)?de\s+empr[ée]stimo\b/i,
  /\bliberamos\s+.*de\s+cr[ée]dito\b/i,
  /\bdinheiro\s+extra\s+dispon[íi]vel\b/i,
  /\baproveite\s+a\s+oferta\b/i,
  /\baproveite\s+.*cashback\b/i,
  /\bconhe[çc]a\s+o\s+novo\b/i,
  /\bganhe\s+cashback\b/i,
  /\bpontos\s+(?:acumulados|do\s+cart[ãa]o)\b/i,
  /\bclube\s+de\s+vantagens\b/i,

  // Chamadas comerciais, dicas e incentivos (Fase 10 / Tarefa 10.4)
  /\bsaiba\s+mais\b/i,
  /\bganhe\s+f[ôo]lego\b/i,
  /\bfazendo\s+pix\b/i,
  /\bpagando\s+boletos?\b/i,
  /\bfa[çc]a\s+pix\s+no\s+cr[ée]dito\b/i,
  /\bpague\s+com\s+cart[ãa]o\b/i,
  /\bconhe[çc]a\b/i,
  /\bportabilidade\b/i,
  /\btraga\s+seu\s+sal[áa]rio\b/i,
  /\bopen\s+finance\b/i,
  /\bseguro\s+celular\b/i,
  /\bdica\s+do\b/i,

  // Segurança, 2FA e tokens
  /\bc[óo]digo\s+de\s+(?:seguran[çc]a|verifica[çc][ãa]o|acesso|autoriza[çc][ãa]o)\b/i,
  /\bc[óo]digo\b.*?\b(?:para\s+autorizar|autorizar\s+o\s+acesso|de\s+acesso)\b/i,
  /\b(?:seu\s+)?token\s+(?:de\s+(?:acesso|seguran[çc]a))?\b/i,
  /\bc[óo]digo\s+2fa\b/i,
  /\bautoriza[çc][ãa]o\s+de\s+acesso\b/i,
  /\bnovo\s+(?:dispositivo|acesso)\s+identificado\b/i,

  // Agendamentos futuros e lembretes
  /\b(?:pix|transfer[êe]ncia|pagamento|boleto|ted|doc)\b.*?\b(?:foi\s+)?agendad[ao]\b/i,
  /\bagendad[ao]\b/i,
  /\bagendamento\b/i,
  /\blembrete\s+de\s+(?:pagamento|vencimento)\b/i,
  /\bvencimento\s+da\s+fatura\b/i,
  /\bsua\s+fatura\s+vence\b/i,
];

/**
 * Verifica se a notificação pertence à blacklist semântica de falsos positivos.
 */
export function isBlacklistedNotification(text?: string, title?: string): boolean {
  const combined = `${title || ""} ${text || ""}`.trim();
  if (!combined) return false;

  for (const regex of BLACKLIST_EXPRESSIONS) {
    if (regex.test(combined)) {
      return true;
    }
  }

  return false;
}

/**
 * Converte string com formato monetário brasileiro ("R$ 42,90", "1.250,50", "42,90")
 * em valor inteiro em centavos. Prioriza ocorrências com prefixo explícito R$.
 */
export function extractCentsFromText(text: string): number | null {
  if (!text) return null;

  // 1. Tentar primeiro valores precedidos explicitamente por R$
  const r$Match = /R\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\b/i.exec(text);
  if (r$Match && r$Match[1] && r$Match[2]) {
    const wholeStr = r$Match[1].replace(/\./g, "");
    const fractionStr = r$Match[2];
    const total = parseInt(wholeStr, 10) * 100 + parseInt(fractionStr, 10);
    if (Number.isFinite(total) && total > 0) return total;
  }

  // 2. Valores internacionais explicitamente precedidos por US$, USD ou $
  const usdMatch = /(?:US\$|USD|\$)\s*(\d{1,3}(?:\.\d{3})*|\d+)[,.](\d{2})\b/i.exec(text);
  if (usdMatch && usdMatch[1] && usdMatch[2]) {
    const wholeStr = usdMatch[1].replace(/\./g, "");
    const fractionStr = usdMatch[2];
    const total = parseInt(wholeStr, 10) * 100 + parseInt(fractionStr, 10);
    if (Number.isFinite(total) && total > 0) return total;
  }

  // 3. Fallback para valores decimais com vírgula típicos ("42,90", "1.250,50")
  const genericMatch = /\b(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\b/.exec(text);
  if (genericMatch && genericMatch[1] && genericMatch[2]) {
    const wholeStr = genericMatch[1].replace(/\./g, "");
    const fractionStr = genericMatch[2];
    const total = parseInt(wholeStr, 10) * 100 + parseInt(fractionStr, 10);
    if (Number.isFinite(total) && total > 0) return total;
  }

  return null;
}

/**
 * Extrai informações e cálculos de compras parceladas:
 * 1. Parcelas isoladas de controle mensal ("Parcela 2/10 de R$ 45,00")
 * 2. Multiplicador com valor da parcela ("em 3x de R$ 50,00" -> total R$ 150,00)
 * 3. Valor total com quantidade de parcelas ("Compra de R$ 300,00 em 3x")
 */
export function extractInstallmentInfo(
  text: string,
  fallbackAmountCents: number | null,
): InstallmentInfo | null {
  if (!text) return null;

  // Caso 1: Parcela isolada de controle mensal ("Parcela 2/10 de R$ 45,00", "Parcela 02/10 - R$ 45,00")
  const singleMatch = /\bparcela\s*(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2})\b/i.exec(text);
  if (singleMatch && singleMatch[1] && singleMatch[2]) {
    const current = parseInt(singleMatch[1], 10);
    const total = parseInt(singleMatch[2], 10);
    if (current >= 1 && total >= current && total <= 60) {
      const cents = fallbackAmountCents ?? undefined;
      return {
        installments: total,
        currentInstallment: current,
        installmentAmountCents: cents,
        totalAmountCents: cents,
      };
    }
  }

  // Caso 2: Multiplicador e valor da parcela ("em 3x de R$ 50,00", "3x de R$ 50,00", "3 parcelas de R$ 50,00")
  const multiplierWithAmountMatch =
    /\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\s+de\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\b/i.exec(
      text,
    );
  if (
    multiplierWithAmountMatch &&
    multiplierWithAmountMatch[1] &&
    multiplierWithAmountMatch[2] &&
    multiplierWithAmountMatch[3]
  ) {
    const count = parseInt(multiplierWithAmountMatch[1], 10);
    const wholeStr = multiplierWithAmountMatch[2].replace(/\./g, "");
    const fractionStr = multiplierWithAmountMatch[3];
    const instCents = parseInt(wholeStr, 10) * 100 + parseInt(fractionStr, 10);
    if (count >= 2 && count <= 60 && Number.isFinite(instCents) && instCents > 0) {
      return {
        installments: count,
        installmentAmountCents: instCents,
        totalAmountCents: count * instCents,
      };
    }
  }

  // Caso 3: Valor total com indicação de parcelas ("Compra de R$ 300,00 em 3x", "R$ 300,00 parcelado em 3x", "R$ 300,00 (3x)")
  const countOnlyMatch =
    /\b(?:em|parcelad[ao]\s+em)\s+(\d{1,2})\s*(?:x|vezes|parcelas)\b|\((\d{1,2})x\)/i.exec(text);
  if (countOnlyMatch) {
    const countStr = countOnlyMatch[1] || countOnlyMatch[2];
    if (countStr) {
      const count = parseInt(countStr, 10);
      if (count >= 2 && count <= 60 && fallbackAmountCents && fallbackAmountCents > 0) {
        return {
          installments: count,
          totalAmountCents: fallbackAmountCents,
          installmentAmountCents: Math.round(fallbackAmountCents / count),
        };
      }
    }
  }

  return null;
}

const ISSUER_BANK_PATTERNS: Array<{ regex: RegExp; bankName: string }> = [
  { regex: /\b(?:cart[ãa]o\s+)?nubank(?!\w)|\broxinho(?!\w)/i, bankName: "Nubank" },
  { regex: /\b(?:cart[ãa]o\s+)?itaucard(?!\w)|\bita[úu](?!\w)|\bpersonnalit[ée](?!\w)/i, bankName: "Itaú" },
  { regex: /\b(?:cart[ãa]o\s+)?(?:banco\s+)?inter(?!\w)/i, bankName: "Inter" },
  { regex: /\b(?:cart[ãa]o\s+)?c6(?:\s+bank)?(?!\w)/i, bankName: "C6 Bank" },
  { regex: /\b(?:cart[ãa]o\s+)?bradesco(?!\w)/i, bankName: "Bradesco" },
  { regex: /\b(?:cart[ãa]o\s+)?santander(?!\w)|\bway(?!\w)/i, bankName: "Santander" },
  {
    regex: /\b(?:cart[ãa]o\s+)?(?:banco\s+do\s+brasil|ourocard)(?!\w)|\bbb(?!\w)/i,
    bankName: "Banco do Brasil",
  },
  { regex: /\b(?:cart[ãa]o\s+)?caixa(?:\s+econ[ôo]mica|\s+tem)?(?!\w)/i, bankName: "Caixa" },
  { regex: /\b(?:cart[ãa]o\s+)?btg(?:\s+pactual)?(?!\w)/i, bankName: "BTG Pactual" },
  { regex: /\b(?:cart[ãa]o\s+)?xp(?:\s+investimentos)?(?!\w)/i, bankName: "XP Investimentos" },
  { regex: /\b(?:cart[ãa]o\s+)?rico(?!\w)/i, bankName: "Rico" },
  { regex: /\b(?:cart[ãa]o\s+)?mercado\s+pago(?!\w)/i, bankName: "Mercado Pago" },
  { regex: /\b(?:cart[ãa]o\s+)?pagbank(?!\w)|\bpagseguro(?!\w)/i, bankName: "PagBank" },
  { regex: /\b(?:cart[ãa]o\s+)?picpay(?!\w)/i, bankName: "PicPay" },
  { regex: /\b(?:cart[ãa]o\s+)?neon(?!\w)/i, bankName: "Neon" },
  { regex: /\b(?:cart[ãa]o\s+)?next(?!\w)/i, bankName: "Next" },
  { regex: /\b(?:cart[ãa]o\s+)?nomad(?!\w)/i, bankName: "Nomad" },
  { regex: /\b(?:cart[ãa]o\s+)?wise(?!\w)/i, bankName: "Wise" },
  { regex: /\b(?:cart[ãa]o\s+)?sicredi(?!\w)/i, bankName: "Sicredi" },
  { regex: /\b(?:cart[ãa]o\s+)?sicoob(?!\w)/i, bankName: "Sicoob" },
  { regex: /\b(?:cart[ãa]o\s+)?safra(?!\w)/i, bankName: "Safra" },
  { regex: /\b(?:cart[ãa]o\s+)?binance(?!\w)/i, bankName: "Binance" },

  // Bandeiras de cartão (quando o banco emissor não é citado diretamente na notificação)
  { regex: /\b(?:cart[ãa]o\s+)?mastercard(?!\w)|\b(?:com|no|cart[ãa]o)\s+master\b/i, bankName: "Mastercard" },
  { regex: /\b(?:cart[ãa]o\s+|com\s+|no\s+)?visa\s+final\b|\b(?:cart[ãa]o|com|no)\s+visa\b|\bvisa\s+card\b/i, bankName: "Visa" },
  { regex: /\b(?:cart[ãa]o\s+|com\s+|no\s+)?elo\s+final\b|\b(?:cart[ãa]o|com|no)\s+elo\b/i, bankName: "Elo" },
  { regex: /\b(?:cart[ãa]o\s+)?(?:american\s+express|amex)(?!\w)/i, bankName: "American Express" },
  { regex: /\b(?:cart[ãa]o\s+)?hipercard(?!\w)/i, bankName: "Hipercard" },
];

/**
 * Extrai os últimos 4 dígitos do cartão de crédito/débito mencionados no texto
 * (comum em notificações de carteiras digitais como Google Wallet e Samsung Pay).
 */
export function extractCardLastDigits(text: string): string | undefined {
  if (!text) return undefined;

  const patterns = [
    /\b(?:final|terminad[ao]\s+em|terminando\s+em)\s*(?:n[ºo°.]\s*|n[ºo°]?\.?\s*)?[:.-]?\s*\(?(\d{4})\)?(?!\s*,\d{2})/i,
    /(?:cart[ãa]o|card|[•*.-]{2,4})\s*(?:final\s*)?(?:n[ºo°.]\s*|n[ºo°]?\.?\s*)?[:.-]?\s*\(?(\d{4})\)?(?!\s*,\d{2})/i,
    /(?:mastercard|visa|elo|amex|american\s+express)\s*(?:[A-Za-zÀ-ÿ]+\s+)?(?:[•*.-]{2,4}\s*)?[:.-]?\s*\(?(\d{4})\)?(?!\s*,\d{2})/i,
    /\b(\d{4})\b(?!\s*,\d{2})\s*(?:aprovad[ao]|utilizad[ao]|usad[ao])/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extrai o banco emissor do cartão mencionado na notificação,
 * especialmente útil para carteiras digitais (Google Wallet, Samsung Pay).
 */
export function extractIssuerBank(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Prioriza menções contextuais de cartão ("com cartão Nubank", "no cartão Itaú", "cartão Bradesco")
  const cardContextMatch =
    /(?:com|no|na|do|da|via|usando|pelo|pela)\s+(?:(?:o|a)\s+)?cart[ãa]o\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s+final|\s+\d{4}|$|\.|\s+-)/i.exec(
      text,
    );
  if (cardContextMatch && cardContextMatch[1]) {
    const candidate = cardContextMatch[1].trim();
    for (const { regex, bankName } of ISSUER_BANK_PATTERNS) {
      if (regex.test(candidate)) {
        return bankName;
      }
    }
  }

  // 1b. Menção com preposição direta sem a palavra 'cartão' (ex.: "com Mastercard final 9999", "com Nubank final 1234")
  const directContextMatch =
    /(?:com|no|na|via|usando|pelo|pela)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s+final|\s+\d{4}|$|\.|\s+-)/i.exec(text);
  if (directContextMatch && directContextMatch[1]) {
    const candidate = directContextMatch[1].trim();
    for (const { regex, bankName } of ISSUER_BANK_PATTERNS) {
      if (regex.test(candidate)) {
        return bankName;
      }
    }
  }

  // 2. Procura menções explícitas de bancos homologados ou bandeiras no texto completo
  for (const { regex, bankName } of ISSUER_BANK_PATTERNS) {
    if (regex.test(text)) {
      return bankName;
    }
  }

  return undefined;
}

/**
 * Extrai a bandeira do cartão de crédito/débito mencionada no texto.
 */
export function extractCardBrand(text: string): string | undefined {
  if (!text) return undefined;
  if (/\b(?:mastercard|master)\b/i.test(text)) return "Mastercard";
  if (/\bvisa\b/i.test(text)) return "Visa";
  if (/\belo\b/i.test(text)) return "Elo";
  if (/\b(?:american\s+express|amex)\b/i.test(text)) return "American Express";
  if (/\bhipercard\b/i.test(text)) return "Hipercard";
  return undefined;
}

const CARD_BRAND_NAMES = new Set([
  "mastercard",
  "visa",
  "elo",
  "american express",
  "amex",
  "hipercard",
]);

/**
 * Determina se um determinado identificador de emissor corresponde a uma bandeira de cartão.
 */
export function isCardBrand(name?: string): boolean {
  if (!name) return false;
  return CARD_BRAND_NAMES.has(name.toLowerCase().trim());
}

const DIGITAL_WALLET_NAMES = new Set([
  "carteira google",
  "google pay",
  "google wallet",
  "samsung pay",
  "samsung wallet",
  "apple pay",
]);

/**
 * Determina se uma instituição corresponde a uma carteira digital (proxy NFC).
 */
export function isDigitalWallet(bankName?: string): boolean {
  if (!bankName) return false;
  const lower = bankName.toLowerCase().trim();
  if (DIGITAL_WALLET_NAMES.has(lower)) return true;
  return (
    lower.includes("carteira google") ||
    lower.includes("google pay") ||
    lower.includes("google wallet") ||
    lower.includes("samsung pay") ||
    lower.includes("samsung wallet")
  );
}

/**
 * Janela temporal de tolerância para fusão e deduplicação de notificações concorrentes:
 * 5 minutos (300.000 ms).
 */
export const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000;

/**
 * Normaliza textos de estabelecimentos comerciais para comparação semântica.
 */
export function normalizeMerchantText(text?: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_COMMERCIAL_WORDS = new Set([
  "padaria",
  "restaurante",
  "farmacia",
  "drogaria",
  "mercado",
  "supermercado",
  "posto",
  "loja",
  "comercio",
  "bar",
  "lanchonete",
  "panificadora",
  "distribuidora",
  "servicos",
  "ltda",
  "eireli",
  "sa",
  "me",
  "epp",
  "brasil",
  "compra",
  "pagamento",
  "cartao",
]);

/**
 * Verifica se dois registros de transação apontam para o mesmo estabelecimento comercial
 * de maneira compatível (fuzzy matching resiliente a sufixos fiscais e prefixos de adquirentes).
 */
export function areMerchantsCompatible(
  a: ParsedBankTransaction,
  b: ParsedBankTransaction,
): boolean {
  const m1 = normalizeMerchantText(a.merchant);
  const m2 = normalizeMerchantText(b.merchant);

  // 1. Se ambos tiverem estabelecimento identificado:
  if (m1 && m2) {
    if (m1 === m2) return true;
    if (m1.includes(m2) || m2.includes(m1)) return true;

    // Tokens distintivos (excluindo termos genéricos comerciais como "padaria", "ltda", "posto")
    const words1 = m1.split(" ").filter((w) => w.length >= 3);
    const words2 = m2.split(" ").filter((w) => w.length >= 3);

    const distinctive1 = words1.filter((w) => !GENERIC_COMMERCIAL_WORDS.has(w));
    const distinctive2 = words2.filter((w) => !GENERIC_COMMERCIAL_WORDS.has(w));

    if (distinctive1.length > 0 && distinctive2.length > 0) {
      const common = distinctive1.filter((w) => distinctive2.includes(w));
      if (common.length > 0) return true;
    }
    return false;
  }

  // 2. Se um tiver merchant e o outro não, compara com a description do outro
  const d1 = normalizeMerchantText(a.description);
  const d2 = normalizeMerchantText(b.description);

  if (m1 && !m2) {
    if (d2.includes(m1)) return true;
    const words1 = m1.split(" ").filter((w) => w.length >= 3 && !GENERIC_COMMERCIAL_WORDS.has(w));
    if (words1.length > 0 && words1.some((w) => d2.includes(w))) return true;
  }

  if (m2 && !m1) {
    if (d1.includes(m2)) return true;
    const words2 = m2.split(" ").filter((w) => w.length >= 3 && !GENERIC_COMMERCIAL_WORDS.has(w));
    if (words2.length > 0 && words2.some((w) => d1.includes(w))) return true;
  }

  // 3. Se nenhum tiver merchant explícito, compara descrições
  if (!m1 && !m2) {
    if (d1 === d2) return true;
    if (d1.includes(d2) || d2.includes(d1)) return true;
    const isGenericD1 = d1.includes("compra") || d1.includes("pagamento");
    const isGenericD2 = d2.includes("compra") || d2.includes("pagamento");
    if (isGenericD1 && isGenericD2) return true;
  }

  return false;
}

/**
 * Determina se duas transações caem dentro da janela de tolerância temporal (default 5 minutos).
 */
export function isWithinTemporalWindow(
  a: ParsedBankTransaction,
  b: ParsedBankTransaction,
  windowMs = DEDUPLICATION_WINDOW_MS,
): boolean {
  const t1 = a.timestamp;
  const t2 = b.timestamp;
  if (typeof t1 === "number" && typeof t2 === "number" && !Number.isNaN(t1) && !Number.isNaN(t2)) {
    return Math.abs(t1 - t2) <= windowMs;
  }
  return Boolean(a.date && b.date && a.date === b.date);
}

/**
 * Realiza o merge entre uma notificação prévia de carteira digital e a notificação
 * subsequente do banco emissor oficial:
 * - Atribui a transação ao banco oficial
 * - Mantém a bandeira do cartão (ex: Mastercard, Visa, Elo)
 * - Mantém os últimos 4 dígitos do cartão
 * - Preserva o valor, categoria e parcelamento
 */
export function mergeWalletWithBank(
  walletSuggestion: ParsedBankTransaction,
  bankSuggestion: ParsedBankTransaction,
): ParsedBankTransaction {
  const cardBrand =
    bankSuggestion.cardBrand ||
    walletSuggestion.cardBrand ||
    (isCardBrand(walletSuggestion.issuerBank) ? walletSuggestion.issuerBank : undefined) ||
    (isCardBrand(bankSuggestion.issuerBank) ? bankSuggestion.issuerBank : undefined);

  const cardLastDigits =
    bankSuggestion.cardLastDigits || walletSuggestion.cardLastDigits;

  const merchant = bankSuggestion.merchant || walletSuggestion.merchant;
  const description =
    bankSuggestion.merchant || !walletSuggestion.merchant
      ? bankSuggestion.description
      : walletSuggestion.description;

  return {
    ...walletSuggestion,
    ...bankSuggestion,
    id: walletSuggestion.id,
    bankName: bankSuggestion.bankName,
    issuerBank:
      bankSuggestion.issuerBank && bankSuggestion.issuerBank !== bankSuggestion.bankName
        ? bankSuggestion.issuerBank
        : walletSuggestion.issuerBank && !isDigitalWallet(walletSuggestion.issuerBank)
          ? walletSuggestion.issuerBank
          : bankSuggestion.bankName,
    cardBrand,
    cardLastDigits,
    merchant,
    description,
    paymentMethod: bankSuggestion.paymentMethod || walletSuggestion.paymentMethod || "credit_card",
    categorySlug: bankSuggestion.categorySlug || walletSuggestion.categorySlug,
    installments: bankSuggestion.installments ?? walletSuggestion.installments,
    currentInstallment: bankSuggestion.currentInstallment ?? walletSuggestion.currentInstallment,
    installmentAmountCents:
      bankSuggestion.installmentAmountCents ?? walletSuggestion.installmentAmountCents,
    rawText: `${bankSuggestion.rawText} | [Merge Carteira: ${walletSuggestion.rawText}]`,
  };
}

/**
 * Identifica o nome do banco através do packageName ou do título/texto da notificação.
 */
export function resolveBankName(
  packageName?: string,
  title?: string,
  text?: string,
): string | null {
  if (packageName && BANK_PACKAGE_MAP[packageName]) {
    return BANK_PACKAGE_MAP[packageName];
  }

  const titleLower = (title || "").toLowerCase();
  const textLower = (text || "").toLowerCase();
  const combined = `${titleLower} ${textLower}`.trim();

  // 1. Título ou início do texto identifica explicitamente uma carteira digital
  if (
    titleLower.includes("carteira google") ||
    titleLower.includes("carteira do google") ||
    titleLower.includes("google pay") ||
    titleLower.includes("google wallet") ||
    titleLower.includes("gpay") ||
    /^(?:carteira\s+(?:do\s+)?google|google\s+pay|google\s+wallet|gpay)[:\s-]/i.test(textLower)
  ) {
    return "Carteira Google";
  }

  if (
    titleLower.includes("samsung pay") ||
    titleLower.includes("samsung wallet") ||
    titleLower.includes("spay") ||
    /^(?:samsung\s+pay|samsung\s+wallet|spay)[:\s-]/i.test(textLower)
  ) {
    return "Samsung Pay";
  }

  // 2. Título identifica explicitamente banco tradicional ou fintech
  if (titleLower.includes("nubank") || titleLower.includes("roxinho") || titleLower.includes("nu pagamentos")) return "Nubank";
  if (
    titleLower.includes("itau") ||
    titleLower.includes("itaú") ||
    titleLower.includes("itaucard") ||
    titleLower.includes("personnalite")
  ) {
    return "Itaú";
  }
  if (titleLower.includes("inter") || titleLower.includes("banco inter")) return "Inter";
  if (titleLower.includes("c6 bank") || titleLower.includes("c6")) return "C6 Bank";
  if (titleLower.includes("bradesco")) return "Bradesco";
  if (titleLower.includes("santander") || titleLower.includes("way")) return "Santander";
  if (titleLower.includes("mercado pago") || titleLower.includes("mercadopago")) return "Mercado Pago";
  if (titleLower.includes("picpay")) return "PicPay";
  if (titleLower.includes("pagbank") || titleLower.includes("pagseguro")) return "PagBank";
  if (titleLower.includes("neon")) return "Neon";
  if (titleLower.includes("next")) return "Next";
  if (titleLower.includes("binance")) return "Binance";
  if (titleLower.includes("rico")) return "Rico";
  if (
    titleLower.includes("btg investimentos") ||
    titleLower.includes("btg pactual investimentos")
  ) {
    return "BTG Investimentos";
  }
  if (titleLower.includes("btg") || titleLower.includes("btgpactual")) return "BTG Pactual";
  if (
    titleLower.includes("xp investimentos") ||
    titleLower.includes("cartão xp") ||
    titleLower.includes("cartao xp")
  ) {
    return "XP Investimentos";
  }
  if (titleLower.includes("nomad")) return "Nomad";
  if (titleLower.includes("wise") || titleLower.includes("transferwise")) return "Wise";
  if (
    titleLower.includes("caixa tem") ||
    titleLower.includes("caixa econômica") ||
    titleLower.includes("caixa economica") ||
    titleLower.includes("caixa")
  ) {
    return "Caixa";
  }
  if (
    titleLower.includes("banco do brasil") ||
    titleLower.includes("ourocard") ||
    /\bbb[:\s]/i.test(titleLower)
  ) {
    return "Banco do Brasil";
  }

  // 3. Fallback procurando carteiras no texto combinado
  if (
    combined.includes("carteira google") ||
    combined.includes("carteira do google") ||
    combined.includes("google pay") ||
    combined.includes("google wallet") ||
    combined.includes("gpay")
  ) {
    return "Carteira Google";
  }
  if (
    combined.includes("samsung pay") ||
    combined.includes("samsung wallet") ||
    combined.includes("spay")
  ) {
    return "Samsung Pay";
  }

  // 4. Fallback procurando bancos no texto combinado
  if (combined.includes("nubank") || combined.includes("roxinho") || combined.includes("nu pagamentos")) return "Nubank";
  if (
    combined.includes("itau") ||
    combined.includes("itaú") ||
    combined.includes("itaucard") ||
    combined.includes("personnalite")
  ) {
    return "Itaú";
  }
  if (combined.includes("inter") || combined.includes("banco inter")) return "Inter";
  if (combined.includes("c6 bank") || combined.includes("c6")) return "C6 Bank";
  if (combined.includes("bradesco")) return "Bradesco";
  if (combined.includes("santander") || combined.includes("way")) return "Santander";
  if (combined.includes("mercado pago") || combined.includes("mercadopago")) return "Mercado Pago";
  if (combined.includes("picpay")) return "PicPay";
  if (combined.includes("pagbank") || combined.includes("pagseguro")) return "PagBank";
  if (combined.includes("neon")) return "Neon";
  if (combined.includes("next")) return "Next";
  if (combined.includes("binance")) return "Binance";
  if (combined.includes("rico")) return "Rico";
  if (
    combined.includes("btg investimentos") ||
    combined.includes("btg pactual investimentos")
  ) {
    return "BTG Investimentos";
  }
  if (combined.includes("btg") || combined.includes("btgpactual")) return "BTG Pactual";
  if (
    combined.includes("xp investimentos") ||
    combined.includes("cartão xp") ||
    combined.includes("cartao xp")
  ) {
    return "XP Investimentos";
  }
  if (combined.includes("nomad")) return "Nomad";
  if (combined.includes("wise") || combined.includes("transferwise")) return "Wise";
  if (
    combined.includes("caixa tem") ||
    combined.includes("caixa econômica") ||
    combined.includes("caixa economica") ||
    combined.includes("caixa")
  ) {
    return "Caixa";
  }
  if (
    combined.includes("banco do brasil") ||
    combined.includes("ourocard") ||
    /\bbb[:\s]/i.test(combined)
  ) {
    return "Banco do Brasil";
  }

  return null;
}

/**
 * Verifica se a notificação possui sinal explícito de movimentação financeira real
 * (compra aprovada, pix enviado/recebido, salário, transferência, etc.).
 * Elimina falsos positivos de cupons, propagandas, pedidos ou mensagens de texto.
 */
export function hasValidTransactionSignal(
  text?: string,
  title?: string,
  packageName?: string,
): boolean {
  if (
    packageName === "com.google.android.apps.walletnfcrel" ||
    packageName === "com.samsung.android.spay" ||
    packageName === "com.samsung.android.raja.spay" ||
    packageName === "com.binance.dev" ||
    packageName === "br.com.rico" ||
    packageName === "br.com.rico.investimentos" ||
    packageName === "com.btgpactual.investimentos" ||
    packageName === "com.nomadfinancial.app"
  ) {
    return true;
  }

  const combined = `${title || ""} ${text || ""}`.toLowerCase();

  const signals = [
    "compra",
    "aprovada",
    "aprovado",
    "pago",
    "pagou",
    "pagamento",
    "enviou",
    "enviado",
    "enviada",
    "realizado",
    "realizada",
    "você recebeu",
    "voce recebeu",
    "recebido",
    "recebida",
    "recebimento",
    "depósito",
    "deposito",
    "salário",
    "salario",
    "devolução",
    "devolucao",
    "reembolso",
    "estorno",
    "transferência",
    "transferencia",
    "proventos",
    "rendimentos",
    "dividendos",
    "débito",
    "debito",
    "crédito",
    "credito",
    "saque",
    "tarifa",
    "google pay",
    "carteira google",
    "carteira do google",
    "google wallet",
    "samsung pay",
    "samsung wallet",
    "gpay",
    "spay",
    "cartão",
    "cartao",
    "ordem",
    "executada",
    "executado",
    "venda",
    "aplicação",
    "aplicacao",
    "resgate",
    "liquidação",
    "liquidacao",
    "câmbio",
    "cambio",
    "conversão",
    "conversao",
    "jcp",
    "aporte",
    "corretagem",
    "fundo",
    "título",
    "titulo",
    "cdb",
    "cripto",
    "spot",
    "binance",
    "rico",
    "nomad",
  ];

  return signals.some((signal) => combined.includes(signal));
}

/**
 * Detecta se a notificação trata de uma entrada (receita) ou saída (despesa),
 * suportando salários, reembolsos, estornos, devoluções Pix e transferências (TED/DOC).
 */
export function detectTransactionType(text: string, title: string): "expense" | "income" {
  const combined = `${title} ${text}`.toLowerCase();
  const incomeKeywords = [
    "você recebeu",
    "voce recebeu",
    "recebido",
    "recebida",
    "transferência recebida",
    "transferencia recebida",
    "pix recebido",
    "depósito recebido",
    "deposito recebido",
    "depósito de",
    "deposito de",
    "depósito confirmado",
    "deposito confirmado",
    "crédito em conta",
    "credito em conta",
    "creditado em conta",
    "creditado na sua conta",
    "creditada em conta",
    "salário",
    "salario",
    "folha de pagamento",
    "reembolso",
    "estorno",
    "devolução pix",
    "devolucao pix",
    "pix devolvido",
    "ted recebida",
    "doc recebido",
    "proventos",
    "rendimentos",
    "dividendos",
    "jcp",
    "ordem de venda",
    "venda de",
    "venda executada",
    "venda spot",
    "resgate",
    "liquidação",
    "liquidacao",
    "vencimento de cdb",
    "cashback recebido",
    "cashback creditado",
  ];

  for (const keyword of incomeKeywords) {
    if (combined.includes(keyword)) {
      return "income";
    }
  }

  return "expense";
}

/**
 * Detecta se a transação corresponde a um estorno, cancelamento ou devolução.
 */
export function isRefundTransaction(text: string, title?: string): boolean {
  const combined = `${title || ""} ${text}`.toLowerCase();
  return /\b(?:estorno|reembolso|devolu[çc][ãa]o\s+pix|pix\s+devolvido|valor\s+estornado|compra\s+cancelada)\b/i.test(
    combined,
  );
}

/**
 * Detecta o meio de pagamento provável da notificação, alinhado com PAYMENT_METHODS.
 */

export function detectPaymentMethod(text: string, title: string): PaymentMethod {
  const combined = `${title} ${text}`.toLowerCase();

  if (combined.includes("pix")) {
    return "pix";
  }

  // Débito é avaliado antes de crédito genérico para evitar falsos "cartão de crédito"
  if (
    combined.includes("débito") ||
    combined.includes("debito") ||
    combined.includes("cartão de débito") ||
    combined.includes("cartao de debito")
  ) {
    return "debit";
  }

  if (
    combined.includes("crédito") ||
    combined.includes("credito") ||
    combined.includes("cartão") ||
    combined.includes("cartao") ||
    combined.includes("carteira google") ||
    combined.includes("google pay") ||
    combined.includes("google wallet") ||
    combined.includes("gpay") ||
    combined.includes("samsung pay") ||
    combined.includes("samsung wallet") ||
    combined.includes("spay") ||
    combined.includes("itaucard") ||
    combined.includes("ourocard") ||
    combined.includes("parcela") ||
    combined.includes("parcelad") ||
    /\b\d{1,2}\s*x\b/.test(combined)
  ) {
    return "credit_card";
  }

  if (
    combined.includes("ted") ||
    combined.includes("doc") ||
    combined.includes("transferência") ||
    combined.includes("transferencia") ||
    combined.includes("entre contas")
  ) {
    return "transfer";
  }

  if (combined.includes("boleto")) {
    return "other";
  }

  return "other";
}

/**
 * Detecta a moeda predominante da notificação ("BRL" ou "USD").
 */
export function detectCurrency(text: string): "BRL" | "USD" {
  if (/(?:US\$|USD|\bUSD\b)/i.test(text) && !/R\$/i.test(text)) {
    return "USD";
  }
  return "BRL";
}

export interface ExchangeMetadata {
  currency: "BRL" | "USD";
  exchangeRate?: number;
  iofCents?: number;
  foreignAmountCents?: number;
}

/**
 * Extrai metadados de câmbio de contas globais (Nomad / Wise):
 * cotação comercial, valor de IOF e montante em moeda estrangeira.
 */
export function extractNomadExchangeMetadata(text: string): ExchangeMetadata {
  const isUSD = detectCurrency(text) === "USD";

  // Cotação: "Cotação: R$ 5,02", "Cotação comercial 5,10", "Cotação: 5.05"
  const rateMatch =
    /(?:cota[çc][ãa]o(?:\s+comercial)?|taxa(?:\s+de\s+c[âa]mbio)?)\s*[:=]?\s*(?:R\$\s*)?(\d{1,2}[,.]\d{2,4})/i.exec(
      text,
    );
  let exchangeRate: number | undefined;
  if (rateMatch && rateMatch[1]) {
    exchangeRate = parseFloat(rateMatch[1].replace(",", "."));
  }

  // IOF: "IOF: R$ 55,00", "IOF R$ 16,50"
  const iofMatch =
    /\biof\b\s*[:=]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/i.exec(text);
  let iofCents: number | undefined;
  if (iofMatch && iofMatch[1] && iofMatch[2]) {
    const whole = iofMatch[1].replace(/\./g, "");
    iofCents = parseInt(whole, 10) * 100 + parseInt(iofMatch[2], 10);
  }

  // Valor em USD de destino: "para US$ 980,40", "em US$ 290,00", "adicionou US$ 500,00"
  const foreignMatch =
    /(?:para|em|adicionou)\s+(?:US\$|USD)\s*(\d{1,3}(?:\.\d{3})*|\d+)[,.](\d{2})/i.exec(
      text,
    );
  let foreignAmountCents: number | undefined;
  if (foreignMatch && foreignMatch[1] && foreignMatch[2]) {
    const whole = foreignMatch[1].replace(/\./g, "");
    foreignAmountCents = parseInt(whole, 10) * 100 + parseInt(foreignMatch[2], 10);
  }

  return {
    currency: isUSD ? "USD" : "BRL",
    exchangeRate,
    iofCents,
    foreignAmountCents,
  };
}

/**
 * Extrai o código do ativo (ticker B3, criptoativo ou fundo/título) mencionado na notificação.
 */
export function extractInvestmentAsset(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Tickers B3 de Ações, FIIs e ETFs (ex: PETR4, VALE3, WEGE3, HGLG11, BOVA11, ITUB4)
  const b3Match = /\b([A-Z]{4}\d{1,2}[BF]?)\b/.exec(text);
  if (b3Match && b3Match[1]) {
    return b3Match[1];
  }

  // 2. Principais criptoativos (ex: BTC, ETH, SOL, USDT, BNB, ADA, XRP)
  const cryptoMatch = /\b(BTC|ETH|SOL|USDT|BNB|ADA|XRP|DOGE|AVAX|DOT|LINK)\b/i.exec(text);
  if (cryptoMatch && cryptoMatch[1]) {
    return cryptoMatch[1].toUpperCase();
  }

  // 3. Fundos ou títulos de renda fixa (ex: "no Fundo BTG Pactual Tesouro Selic", "em CDB BTG Pactual 110% CDI")
  const fundMatch =
    /(?:no\s+fundo|em\s+cdb|no\s+t[íi]tulo|no\s+titulo|em\s+lci|em\s+lca|no\s+tesouro|no\s+cri|no\s+cra)\s+([A-Za-zÀ-ÿ0-9\s%+.-]{3,40}?)(?:\s+(?:creditado|aplicado|realizado|confirmad[ao]|\.|$)|$)/i.exec(
      text,
    );
  if (fundMatch && fundMatch[1]) {
    const rawAsset = fundMatch[1].trim();
    return rawAsset.replace(/^[\s,.:;/-]+|[\s,.:;/-]+$/g, "").trim();
  }

  return undefined;
}

/**
 * Detecta a natureza financeira (expense, income, investment) e o subtipo de investimento.
 */
export function detectTransactionNature(
  text: string,
  title: string,
  bankName: string,
): {
  nature: TransactionNature;
  subtype?: InvestmentSubtype;
} {
  const combined = `${title} ${text}`.toLowerCase();

  const isInvestmentInstitution =
    bankName === "Binance" ||
    bankName === "Rico" ||
    bankName === "XP Investimentos" ||
    bankName === "BTG Investimentos";

  // 1. Proventos / Dividendos / JCP
  if (
    combined.includes("provento") ||
    combined.includes("proventos") ||
    combined.includes("dividendo") ||
    combined.includes("dividendos") ||
    combined.includes("jcp") ||
    combined.includes("juros sobre capital") ||
    combined.includes("rendimento de fii")
  ) {
    return { nature: "investment", subtype: "dividend" };
  }

  // 2. Trades / Ordens de Compra e Venda / Cripto Spot / Notas de Corretagem
  if (
    combined.includes("ordem de compra") ||
    combined.includes("ordem de venda") ||
    combined.includes("compra spot") ||
    combined.includes("venda spot") ||
    combined.includes("nota de corretagem") ||
    combined.includes("ordem executada") ||
    combined.includes("ordem a mercado")
  ) {
    return { nature: "investment", subtype: "trade" };
  }

  // 3. Resgates / Liquidação / Vencimento de Títulos
  if (
    combined.includes("liquidação de título") ||
    combined.includes("liquidacao de titulo") ||
    combined.includes("liquidação") ||
    combined.includes("liquidacao") ||
    combined.includes("resgate") ||
    combined.includes("vencimento de cdb") ||
    combined.includes("vencimento de título") ||
    combined.includes("vencimento de titulo")
  ) {
    return { nature: "investment", subtype: "redemption" };
  }

  // 4. Aportes / Aplicações / Depósitos para Investimento / Câmbio Nomad
  if (
    combined.includes("aplicação") ||
    combined.includes("aplicacao") ||
    combined.includes("aporte") ||
    combined.includes("investimento realizado") ||
    combined.includes("investir") ||
    combined.includes("para investimento") ||
    combined.includes("para investimentos") ||
    combined.includes("câmbio") ||
    combined.includes("cambio") ||
    combined.includes("converteu r$") ||
    combined.includes("conversão realizada") ||
    combined.includes("conversao realizada")
  ) {
    return { nature: "investment", subtype: "contribution" };
  }

  // Se a instituição é uma corretora (Binance, Rico, BTG Investimentos, etc.) e recebeu depósito ou Pix
  if (isInvestmentInstitution) {
    if (combined.includes("depósito") || combined.includes("deposito") || combined.includes("pix")) {
      return { nature: "investment", subtype: "contribution" };
    }
    return { nature: "investment", subtype: "trade" };
  }

  // Caso padrão para contas de despesas e receitas convencionais
  const txType = detectTransactionType(text, title);
  return { nature: txType === "income" ? "income" : "expense" };
}

const IGNORED_MERCHANT_TOKENS = new Set([
  "nubank",
  "itau",
  "itaú",
  "itaucard",
  "inter",
  "c6",
  "c6 bank",
  "bradesco",
  "santander",
  "mercado pago",
  "picpay",
  "pagbank",
  "neon",
  "next",
  "btg",
  "btg pactual",
  "xp",
  "xp investimentos",
  "nomad",
  "wise",
  "caixa",
  "caixa tem",
  "banco do brasil",
  "bb",
  "ourocard",
  "carteira google",
  "carteira do google",
  "google pay",
  "google wallet",
  "gpay",
  "samsung pay",
  "samsung wallet",
  "spay",
  "mastercard",
  "visa",
  "elo",
  "amex",
  "american express",
  "hipercard",
  "carteira",
  "cartao",
  "cartão",
  "crédito",
  "credito",
  "débito",
  "debito",
  "pix",
  "transferência",
  "transferencia",
  "conta",
  "fatura",
  "parcela",
  "parcelas",
  "compra",
  "aprovada",
  "aprovado",
  "no valor de",
  "valor de",
  "no valor",
  "de r$",
  "em r$",
  "no total de",
  "total de",
  "com sucesso",
  "transferencia pix",
  "transferência pix",
  "da conta",
  "sua conta",
  "de sua conta",
  "em sua conta",
  "na sua conta",
]);

function isValidCandidate(candidate: string): boolean {
  if (!candidate || candidate.length < 2) return false;
  const lower = candidate.toLowerCase().trim();
  if (lower.startsWith("r$") || /^\d/.test(lower)) return false;
  if (/^(?:no|na|em|de|do|da|com|por)\s+valor\b/i.test(lower)) return false;
  if (/^valor\b/i.test(lower)) return false;
  if (/^(?:sua\s+)?conta\b/i.test(lower)) return false;
  if (IGNORED_MERCHANT_TOKENS.has(lower)) return false;
  return true;
}

/**
 * Higieniza o nome do estabelecimento removendo prefixos de maquininhas/adquirentes,
 * sufixos de geolocalização e resíduos de dados de cartão.
 */
export function cleanMerchantName(rawName: string): string {
  return cleanAcquirerPrefixes(rawName);
}

/**
 * Extrai pagador ou favorecido de notificações Pix de bancos brasileiros
 * (suporta BTG Pactual, Nubank, Inter, Itaú, Bradesco, Santander, C6, Mercado Pago).
 */
export function extractPixParty(text: string, type?: "income" | "expense"): string {
  if (!text || typeof text !== "string") return "";

  // 1. Recebimento de Pix:
  // Ex BTG: "Você recebeu um Pix de Gabriel Isaac Santana Sales ***.563.565-** no valor de R$ 1,00."
  // Ex Inter/Itaú: "Pix recebido de João da Silva no valor de R$ 50,00"
  // Ex Nubank: "Transferência recebida de Maria Souza no valor de..."
  if (!type || type === "income" || /(?:recebeu|recebido|cr[ée]dito)/i.test(text)) {
    const rxIncome =
      /(?:recebeu\s+(?:um\s+)?pix|pix\s+recebido|transfer[êe]ncia\s+recebida)\s+de\s+([A-Za-zÀ-ÿ\s'-]{2,60}?)(?:\s+[*0-9.-]{6,18})?(?:\s+(?:via\s+pix|via|com\s+sucesso|com|usando|aprovad[ao]|realizad[ao]|no\s+valor|de\s+R\$|valor)|\.|$)/i;
    const m = rxIncome.exec(text);
    if (m && m[1]) {
      const candidate = m[1]
        .replace(/[*0-9.-]{6,18}/g, "")
        .replace(/\s+(?:via\s+pix|via|com\s+sucesso|aprovad[ao]|realizad[ao])$/i, "")
        .trim();
      if (isValidCandidate(candidate)) return cleanMerchantName(candidate);
    }

    // Padrão com valor antes do nome: "Você recebeu um Pix de R$ 50,00 de João Silva"
    const rxIncomeAfterVal =
      /(?:recebeu\s+(?:um\s+)?pix|pix\s+recebido|transfer[êe]ncia\s+recebida)\s+(?:no\s+valor\s+de\s+|de\s+)?R\$\s*[\d.,]+\s+de\s+([A-Za-zÀ-ÿ\s'-]{2,60}?)(?:\s+[*0-9.-]{6,18})?(?:\s+(?:via\s+pix|via|com\s+sucesso|com|aprovad[ao]|realizad[ao])|\.|$)/i;
    const m2 = rxIncomeAfterVal.exec(text);
    if (m2 && m2[1]) {
      const candidate = m2[1]
        .replace(/[*0-9.-]{6,18}/g, "")
        .replace(/\s+(?:via\s+pix|via|com\s+sucesso|aprovad[ao]|realizad[ao])$/i, "")
        .trim();
      if (isValidCandidate(candidate)) return cleanMerchantName(candidate);
    }
  }

  // 2. Envio de Pix:
  // Ex: "Você enviou um Pix para Supermercado Dia no valor de R$ 80,00"
  // Ex: "Pix enviado para Loja ABC R$ 30,00"
  if (!type || type === "expense" || /(?:enviou|enviado|transferiu|pago|pagamento)/i.test(text)) {
    const rxExpense =
      /(?:enviou\s+(?:um\s+)?pix|pix\s+enviado|transferiu\s+(?:um\s+)?pix|pix\s+para)\s+(?:para\s+|a\s+)?([A-Za-zÀ-ÿ\s'-]{2,60}?)(?:\s+[*0-9.-]{6,18})?(?:\s+(?:via\s+pix|via|com\s+sucesso|com|usando|aprovad[ao]|realizad[ao]|no\s+valor|de\s+R\$|valor)|\.|$)/i;
    const m = rxExpense.exec(text);
    if (m && m[1]) {
      const candidate = m[1]
        .replace(/[*0-9.-]{6,18}/g, "")
        .replace(/\s+(?:via\s+pix|via|com\s+sucesso|aprovad[ao]|realizad[ao])$/i, "")
        .trim();
      if (isValidCandidate(candidate)) return cleanMerchantName(candidate);
    }

    const rxExpenseAfterVal =
      /(?:enviou\s+(?:um\s+)?pix|pix\s+enviado|transferiu)\s+(?:no\s+valor\s+de\s+|de\s+)?R\$\s*[\d.,]+\s+(?:para|a)\s+([A-Za-zÀ-ÿ\s'-]{2,60}?)(?:\s+[*0-9.-]{6,18})?(?:\s+(?:via\s+pix|via|com\s+sucesso|com|aprovad[ao]|realizad[ao])|\.|$)/i;
    const m2 = rxExpenseAfterVal.exec(text);
    if (m2 && m2[1]) {
      const candidate = m2[1]
        .replace(/[*0-9.-]{6,18}/g, "")
        .replace(/\s+(?:via\s+pix|via|com\s+sucesso|aprovad[ao]|realizad[ao])$/i, "")
        .trim();
      if (isValidCandidate(candidate)) return cleanMerchantName(candidate);
    }
  }

  return "";
}

/**
 * Extrai o nome do estabelecimento ou destinatário do texto da notificação,
 * com suporte multibanco (travessão, vírgulas, preposições contraídas).
 */
export function extractMerchantOrRecipient(text: string): string {
  if (!text || typeof text !== "string") return "";

  // 0. Se for notificação Pix, prioriza o extrator semântico especializado
  if (/pix\b/i.test(text)) {
    const pixParty = extractPixParty(text);
    if (pixParty) return pixParty;
  }

  // 1. Padrões com travessão e delimitadores específicos de cartões
  // Ex: "ITAUCARD final 1234 - LOJAS AMERICANAS R$ 89,90"
  // Ex: "Compra aprovada - EXTRA HIPER - R$ 120,00"
  // Ex: "Compra aprovada R$ 54,00 no cartão final 1234 - SUPERMERCADO DIA"
  const dashPatterns = [
    // Entre traços: " - NOME - R$"
    /-\s*([A-Za-zÀ-ÿ0-9&.*_\s'-]{2,35}?)\s*-\s*(?:R\$\s*)?\d/i,
    // Após traço e antes de valor: "- NOME R$" ou "final 1234 - NOME R$"
    /(?:final\s*\d{4}\s*)?-\s*([A-Za-zÀ-ÿ0-9&.*_\s'-]{2,35}?)(?:\s+(?:R\$\s*)?\d|\s*$)/i,
    // Após valor/cartão e traço no final: "R$ 54,00 ... - NOME"
    /(?:R\$\s*[\d.,]+,\d{2}).*?-\s*([A-Za-zÀ-ÿ0-9&.*_\s'-]{2,35})$/i,
  ];

  for (const pattern of dashPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const cleaned = cleanMerchantName(match[1]);
      if (isValidCandidate(cleaned)) return cleaned;
    }
  }

  // 2. Padrões delimitados por vírgula dos cartões BB e Santander
  // Ex BB: "R$ 45,00, DROGASIL" ou "R$ 45,00, DROGASIL, Cartao..."
  // Ex Santander: "R$ 32,50, FARMACIA PAGUE MENOS, Cartao final 5678"
  const commaPattern =
    /(?:R\$\s*\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\s*,\s*([A-Za-zÀ-ÿ0-9&.*_\s'-]{2,35}?)(?:\s*,|$)/i;
  const commaMatch = commaPattern.exec(text);
  if (commaMatch && commaMatch[2]) {
    const cleaned = cleanMerchantName(commaMatch[2]);
    if (isValidCandidate(cleaned)) return cleaned;
  }

  // 3. Padrão de preposições e contrações: em, no, na, nos, nas, para, de, do, da, pelo, pela, ao, à
  // Ex: "em Padaria Estrela aprovada", "no Restaurante Fogão", "na Droga Raia", "na Tok&Stok"
  // Ignora preposições seguidas de valores (de R$, de 50), dígitos ou palavras de forma de pagamento/parcelamento
  const prepRegex =
    /\b(?:em|no|na|nos|nas|para|de|do|da|pelo|pela|ao|à)\s+(?!(?:R\$\s*|\d|parcela\b|cr[ée]dito\b|d[ée]bito\b|cart[ãa]o\b|conta\b|valor\b))([A-Za-zÀ-ÿ0-9&.*_\s'-]{2,35}?)(?:\s+(?:aprovada|aprovado|realizada|realizado|com|via|usando|pelo|pela|no\s+cartão|no\s+cartao|no\s+crédito|no\s+credito|no\s+débito|no\s+debito|cart[aã]o\s+final|final\s*[:.-]?\s*\d{4}|em\s+\d+x|\.|$)|$)/gi;
  const matches = Array.from(text.matchAll(prepRegex));

  for (const match of matches) {
    if (match && match[1]) {
      const cleaned = cleanMerchantName(match[1]);
      if (isValidCandidate(cleaned)) {
        return cleaned;
      }
    }
  }

  return "";
}

/**
 * Faz o parsing de uma notificação bancária nativa do Android.
 * Retorna uma transação normalizada pronta para sugestão em memória, ou null se descartada ou não reconhecida.
 */
export function parseBankNotification(
  payload: BankNotificationPayload,
): ParsedBankTransaction | null {
  const combinedText = `${payload.title} ${payload.text}`.trim();
  if (!combinedText) return null;

  // 1. Blacklist semântica anti-falsos positivos
  if (isBlacklistedNotification(payload.text, payload.title)) {
    return null;
  }

  // 2. Validação estrita de identificação de banco homologado (Zero tolerância a apps desconhecidos)
  const bankName = resolveBankName(payload.packageName, payload.title, payload.text);
  if (!bankName) {
    return null;
  }

  // 3. Validação estrita de evidência de transação financeira real (Anti-promoções e anti-chats)
  if (!hasValidTransactionSignal(payload.text, payload.title, payload.packageName)) {
    return null;
  }

  // 4. Extração de informações monetárias e parcelas
  const rawCents = extractCentsFromText(combinedText);
  const installmentInfo = extractInstallmentInfo(combinedText, rawCents);

  // Se houver parcelamento com total calculado ("3x de R$ 50" -> 15000 centavos)
  const cents = installmentInfo?.totalAmountCents ?? rawCents;
  if (!cents) return null;

  const type = detectTransactionType(payload.text, payload.title);
  const { nature, subtype } = detectTransactionNature(payload.text, payload.title, bankName);
  let paymentMethod = detectPaymentMethod(payload.text, payload.title);
  if (
    paymentMethod === "other" &&
    (bankName === "Carteira Google" || bankName === "Samsung Pay")
  ) {
    paymentMethod = "credit_card";
  }
  if (
    bankName === "Nomad" &&
    (paymentMethod === "credit_card" || paymentMethod === "other") &&
    /d[ée]bito|cart[ãa]o|apple|starbucks|amazon|loja|store|final\s*\d{4}/i.test(combinedText)
  ) {
    paymentMethod = "debit";
  }

  const assetTicker = extractInvestmentAsset(combinedText);
  const exchangeMeta = extractNomadExchangeMetadata(combinedText);
  const currency = exchangeMeta.currency;

  let merchant = extractMerchantOrRecipient(payload.text);
  if (nature === "investment" && merchant) {
    const lowerMerchant = merchant.toLowerCase();
    if (
      assetTicker?.toLowerCase() === lowerMerchant ||
      /^(?:btc|eth|sol|usdt|bnb|ada|xrp|cdb|fundo|t[íi]tulo|a[çc][õo]es|investimentos|cripto|renda\s+fixa|sua\s+conta|conta)/i.test(
        lowerMerchant,
      ) ||
      lowerMerchant.includes("sua conta") ||
      lowerMerchant.includes("conta btg") ||
      lowerMerchant.includes("conta corrente") ||
      lowerMerchant.includes("conta de investimentos")
    ) {
      merchant = "";
    }
  }

  const cardLastDigits = extractCardLastDigits(combinedText);
  let issuerBank = extractIssuerBank(combinedText);
  const cardBrand =
    extractCardBrand(combinedText) || (isCardBrand(issuerBank) ? issuerBank : undefined);
  if (!issuerBank && bankName !== "Carteira Google" && bankName !== "Samsung Pay") {
    issuerBank = bankName;
  }

  let defaultDesc = merchant;
  if (paymentMethod === "pix" && merchant) {
    defaultDesc = `Pix: ${merchant}`;
  }
  if (!defaultDesc) {
    if (nature === "investment") {
      if (subtype === "dividend") {
        defaultDesc = assetTicker
          ? `Dividendos ${assetTicker} (${bankName})`
          : `Proventos (${bankName})`;
      } else if (subtype === "trade") {
        const isSell = type === "income";
        defaultDesc = isSell
          ? (assetTicker ? `Venda Spot ${assetTicker} (${bankName})` : `Ordem de Venda (${bankName})`)
          : (assetTicker ? `Compra Spot ${assetTicker} (${bankName})` : `Ordem de Compra (${bankName})`);
      } else if (subtype === "redemption") {
        defaultDesc = assetTicker
          ? `Resgate ${assetTicker} (${bankName})`
          : `Liquidação de Título (${bankName})`;
      } else if (subtype === "contribution") {
        const isExchange = /c[âa]mbio|convers[ãa]o/i.test(combinedText);
        defaultDesc = isExchange
          ? `Câmbio USD (${bankName})`
          : assetTicker
            ? `Aplicação ${assetTicker}`
            : paymentMethod === "pix"
              ? `Depósito via Pix (${bankName})`
              : `Aporte para Investimento (${bankName})`;
      } else {
        defaultDesc = `Investimento (${bankName})`;
      }
    } else if (installmentInfo?.currentInstallment && installmentInfo?.installments) {
      defaultDesc = `Parcela ${installmentInfo.currentInstallment}/${installmentInfo.installments} (${bankName})`;
    } else if (installmentInfo?.installments) {
      defaultDesc = `Compra em ${installmentInfo.installments}x (${bankName})`;
    } else {
      defaultDesc =
        type === "income"
          ? (paymentMethod === "pix" ? `Pix Recebido (${bankName})` : `Recebimento (${bankName})`)
          : (paymentMethod === "pix" ? `Pix Enviado (${bankName})` : `Compra (${bankName})`);
    }
  }

  const dateStr = payload.timestamp
    ? toISODate(new Date(payload.timestamp))
    : toISODate(new Date());

  const id = `sug_${payload.timestamp || Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;

  let inferredSlug = inferCategoryKeyword(merchant || defaultDesc);
  if (nature === "investment" && (!inferredSlug || inferredSlug === "compras")) {
    inferredSlug = "investimentos";
  }

  return {
    id,
    bankName,
    nature,
    type,
    investmentSubtype: subtype,
    amountCents: cents,
    currency,
    exchangeRate: exchangeMeta.exchangeRate,
    iofCents: exchangeMeta.iofCents,
    description: defaultDesc,
    merchant: merchant || undefined,
    assetTicker,
    timestamp: payload.timestamp || Date.now(),
    categorySlug: inferredSlug,
    date: dateStr,
    paymentMethod,
    rawText: combinedText,
    installments: installmentInfo?.installments,
    currentInstallment: installmentInfo?.currentInstallment,
    installmentAmountCents: installmentInfo?.installmentAmountCents,
    cardLastDigits,
    cardBrand,
    issuerBank,
    isRefund: isRefundTransaction(combinedText, payload.title) || undefined,
    source: "notification",
  };
}

/**
 * Blacklist semântica específica para comprovantes compartilhados.
 * Descarta recusas, falhas, cancelamentos, 2FA e propagandas,
 * mas preserva agendamentos legítimos de pagamentos.
 */
export function isBlacklistedReceipt(rawText: string): boolean {
  if (!rawText) return true;

  // Rejeita falhas, recusas, cancelamentos e tentativas não autorizadas
  const failureRegex =
    /\b(?:recusad[ao]|n[ãa]o\s+autorizad[ao]|bloquead[ao]|cancelad[ao]|transa[çc][ãa]o\s+cancelada|saldo\s+insuficiente|limite\s+insuficiente|falha\s+no\s+pagamento)\b/i;
  if (failureRegex.test(rawText)) return true;

  // Rejeita códigos de verificação / 2FA / tokens
  const authRegex =
    /\b(?:c[óo]digo\s+de\s+seguran[çc]a|token|c[óo]digo\s+2fa|autoriza[çc][ãa]o\s+de\s+acesso)\b/i;
  if (authRegex.test(rawText)) return true;

  // Rejeita ofertas e crédito pré-aprovado
  const marketingRegex =
    /\b(?:empr[ée]stimo\s+pr[ée]-aprovado|dinheiro\s+extra\s+dispon[íi]vel)\b/i;
  if (marketingRegex.test(rawText)) return true;

  return false;
}

/**
 * Detecta se o comprovante se refere a um pagamento Pix agendado para liquidação futura.
 */
export function isScheduledTransaction(text: string): boolean {
  if (!text) return false;
  return /\b(?:agendad[ao]|agendamento|programad[ao]|data\s+do\s+d[ée]bito|data\s+de\s+liquida[çc][ãa]o|data\s+para\s+pagamento|pagamento\s+agendado|situa[çc][ãa]o:\s*agendad[ao])\b/i.test(
    text,
  );
}

/**
 * Determina se o comprovante Pix corresponde a uma entrada (renda/recebido) ou saída (despesa/enviado).
 */
export function detectPixTransactionNature(rawText: string): "expense" | "income" {
  const lower = rawText.toLowerCase();

  // Termos inequívocos de recebimento de Pix
  const incomeRegex =
    /\b(?:pix\s+recebido|recebemos\s+um\s+pix|voc[êe]\s+recebeu|transfer[êe]ncia\s+recebida|quem\s+te\s+enviou|recebido\s+por|valor\s+creditado)\b/i;
  // Termos inequívocos de envio de Pix
  const expenseRegex =
    /\b(?:pix\s+enviado|voc[êe]\s+transferiu|voc[êe]\s+pagou|pago\s+para|para:|destinat[áa]rio:|benefici[áa]rio:|favorecido:|dados\s+do\s+recebedor|comprovante\s+de\s+pagamento|comprovante\s+de\s+agendamento)\b/i;

  if (incomeRegex.test(lower) && !expenseRegex.test(lower)) {
    return "income";
  }

  // Se ambos os blocos estiverem presentes (ex: comprovante com dados do pagador e do recebedor):
  if (/\b(?:pix\s+recebido|transfer[êe]ncia\s+recebida|quem\s+te\s+enviou)\b/i.test(lower)) {
    return "income";
  }

  return "expense";
}

/**
 * Extrai data contida no comprovante bancário (formato DD/MM/AAAA ou DD-MM-AAAA)
 * retornando a data no padrão ISO (YYYY-MM-DD). Se for agendado, prioriza a data de liquidação futura.
 */
export function extractDateFromReceipt(
  text: string,
  isScheduled: boolean,
): { date: string; scheduledFor?: string } {
  if (isScheduled) {
    const scheduledMatch =
      /(?:data\s+do\s+d[ée]bito|data\s+do\s+pagamento|data\s+de\s+liquida[çc][ãa]o|data\s+programada|agendad[ao]\s+para|para\s+o\s+dia|data\s+de\s+pagamento):\s*(\d{2})[/.-](\d{2})[/.-](\d{4})/i.exec(
        text,
      );
    if (scheduledMatch && scheduledMatch[1] && scheduledMatch[2] && scheduledMatch[3]) {
      const iso = `${scheduledMatch[3]}-${scheduledMatch[2]}-${scheduledMatch[1]}`;
      return { date: iso, scheduledFor: iso };
    }
  }

  const labeledMatch =
    /(?:data\s+e\s+hora|data\/hora|data\s+da\s+opera[çc][ãa]o|data\s+da\s+transa[çc][ãa]o|realizada\s+em|data|opera[çc][ãa]o\s+realizada\s+em):\s*(\d{2})[/.-](\d{2})[/.-](\d{4})/i.exec(
      text,
    );
  if (labeledMatch && labeledMatch[1] && labeledMatch[2] && labeledMatch[3]) {
    const iso = `${labeledMatch[3]}-${labeledMatch[2]}-${labeledMatch[1]}`;
    return { date: iso, scheduledFor: isScheduled ? iso : undefined };
  }

  const genericMatch = /\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/.exec(text);
  if (genericMatch && genericMatch[1] && genericMatch[2] && genericMatch[3]) {
    const iso = `${genericMatch[3]}-${genericMatch[2]}-${genericMatch[1]}`;
    return { date: iso, scheduledFor: isScheduled ? iso : undefined };
  }

  const today = toISODate(new Date());
  return { date: today, scheduledFor: isScheduled ? today : undefined };
}

/**
 * Extrai CNPJ ou CPF do comprovante bancário (formato com pontuação ou dígitos limpos).
 */
export function extractTaxId(text: string): string | undefined {
  if (!text) return undefined;

  // 1. CNPJ explícito: XX.XXX.XXX/XXXX-XX ou 14 dígitos após token CNPJ
  const cnpjMatch =
    /(?:CNPJ|CPF\/CNPJ):\s*([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}|[0-9]{14})\b/i.exec(
      text,
    );
  if (cnpjMatch && cnpjMatch[1]) {
    return cnpjMatch[1].replace(/[^\d]/g, "");
  }

  // 2. CPF explícito: XXX.XXX.XXX-XX ou mascarado ***.XXX.XXX-**
  const cpfMatch =
    /(?:CPF|CPF\/CNPJ):\s*([0-9*]{3}\.[0-9*]{3}\.[0-9*]{3}-[0-9*]{2}|[0-9]{11})\b/i.exec(
      text,
    );
  if (cpfMatch && cpfMatch[1]) {
    return cpfMatch[1].trim();
  }

  return undefined;
}

/**
 * Faz o parsing de um texto compartilhado de comprovante Pix (Android Share Target).
 * Extrai tipo, status (efetivado vs agendado), valor em centavos, favorecido/pagador,
 * CNPJ/CPF, instituição financeira e identificadores com alta tolerância a múltiplos bancos.
 */
export function parsePixShareText(rawText: string): ParsedBankTransaction | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Descarta se pertencer à blacklist de comprovantes inválidos (falhas, 2FA, spam)
  if (isBlacklistedReceipt(rawText)) return null;

  // Tenta decodificar código Pix Copia e Cola padrão EMVCo BR Code
  if (rawText.includes("000201")) {
    const emvParsed = parsePixEMVPayload(rawText);
    if (emvParsed) return emvParsed;
  }

  const cents = extractCentsFromText(rawText);
  if (!cents) return null;

  const isIncome = detectPixTransactionNature(rawText);
  const isRefund = isRefundTransaction(rawText);
  const isScheduled = isScheduledTransaction(rawText);
  const status = isScheduled ? "scheduled" : "completed";
  const { date: txDate, scheduledFor } = extractDateFromReceipt(rawText, isScheduled);

  // Resolução da instituição bancária emissora: prioriza cabeçalho do comprovante e canal/instituição de origem
  const headerLines = rawText.split(/[\r\n]+/).slice(0, 4).join(" ");
  let bankName = resolveBankName(undefined, undefined, headerLines);

  if (!bankName) {
    const originMatch =
      /(?:Institui[çc][ãa]o\s+de\s+Origem|Institui[çc][ãa]o\s+do\s+Pagador|Canal(?:\s*:\s*Aplicativo)?|Banco\s+emissor)\s*[:=]?\s*([^\n\r]+)/i.exec(
        rawText,
      );
    if (originMatch && originMatch[1]) {
      bankName = resolveBankName(undefined, undefined, originMatch[1]);
    }
  }

  if (!bankName) {
    bankName = resolveBankName(undefined, undefined, rawText) || "Pix";
  }

  // 1. Extração do favorecido / recebedor em comprovantes
  const recipientMatch =
    /(?:Dados\s+(?:do\s+Recebedor|de\s+quem\s+recebeu)[\s\S]*?(?:Nome|Raz[ãa]o\s+Social):\s*([^\n\r,]+)|(?:Para|Destinat[áa]rio|Nome\s+do\s+recebedor|Pago\s+para|Benefici[áa]rio|Favorecido|Quem\s+recebeu|Destino):\s*([^\n\r,]+))/i.exec(
      rawText,
    );
  const rawRecipient = recipientMatch
    ? (recipientMatch[1] || recipientMatch[2] || "").trim()
    : "";

  // 2. Extração do pagador / remetente
  const payerMatch =
    /(?:Dados\s+(?:do\s+Pagador|de\s+quem\s+pagou)[\s\S]*?(?:Nome|Raz[ãa]o\s+Social):\s*([^\n\r,]+)|(?:Quem\s+te\s+enviou|Pagador|De|Origem|Nome\s+do\s+pagador|Remetente):\s*([^\n\r,]+))/i.exec(
      rawText,
    );
  const rawPayer = payerMatch
    ? (payerMatch[1] || payerMatch[2] || "").trim()
    : "";

  const recipient = cleanMerchantName(
    rawRecipient || (isIncome === "expense" ? extractMerchantOrRecipient(rawText) : ""),
  );
  const payer = cleanMerchantName(
    rawPayer || (isIncome === "income" ? extractMerchantOrRecipient(rawText) : ""),
  );

  const primaryParty = isIncome === "income" ? payer || recipient : recipient || payer;
  const taxId = extractTaxId(rawText);

  // Extração de ID da transação ou EndToEndId para deduplicação determinística
  const txIdMatch =
    /(?:ID(?:\s+da\s+(?:transa[çc][ãa]o|opera[çc][ãa]o))?|EndToEndId|C[óo]digo\s+da\s+opera[çc][ãa]o|Autentica[çc][ãa]o(?:\s+mec[âa]nica)?):\s*([A-Za-z0-9.-]{6,50})\b/i.exec(
      rawText,
    ) || /\b(E[0-9]{8}[0-9]{4}[0-9]{4}[A-Za-z0-9]{5,20})\b/.exec(rawText);
  const txId = txIdMatch && txIdMatch[1] ? txIdMatch[1].trim() : undefined;

  const id = txId
    ? `pix_${txId.replace(/[^A-Za-z0-9]/g, "")}`
    : `pix_${Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;

  let description: string;
  if (isScheduled) {
    description = recipient
      ? `Pix Agendado: ${recipient}`
      : `Pix Agendado (${bankName})`;
  } else if (isIncome === "income") {
    description = payer
      ? `Pix Recebido: ${payer}`
      : recipient
        ? `Pix Recebido: ${recipient}`
        : `Pix Recebido (${bankName})`;
  } else {
    description = recipient
      ? `Pix: ${recipient}`
      : `Pix Enviado (${bankName})`;
  }

  const inferredSlug = inferCategoryKeyword(recipient || payer || description);

  return {
    id,
    bankName,
    nature: isIncome,
    type: isIncome,
    status,
    isScheduled: isScheduled || undefined,
    scheduledFor,
    amountCents: cents,
    currency: "BRL",
    description,
    merchant: primaryParty || undefined,
    recipientName: recipient || undefined,
    payerName: payer || undefined,
    taxId,
    txId,
    timestamp: Date.now(),
    categorySlug: inferredSlug,
    date: txDate,
    paymentMethod: "pix",
    rawText,
    isRefund: isRefund || undefined,
    source: "receipt",
  };
}

