import { toISODate } from "@/domain/money";
import type { PaymentMethod } from "@/types/schema";
import { inferCategoryKeyword } from "./category-inference";

export interface ParsedBankTransaction {
  id: string;
  bankName: string;
  type: "expense" | "income";
  amountCents: number;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: PaymentMethod;
  rawText: string;
  installments?: number;
  currentInstallment?: number;
  installmentAmountCents?: number;
  merchant?: string;
  timestamp?: number;
  categorySlug?: string;
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
  "com.btgpactual.investimentos": "BTG Pactual",
  "br.com.xp.carteira": "XP Investimentos",
  "com.xpinc.investments": "XP Investimentos",
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
  /\binvestimento\s+realizado\s+em\s+cdb\b/i,

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

  // 2. Fallback para valores decimais com vírgula típicos ("42,90", "1.250,50")
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

  const combined = `${title || ""} ${text || ""}`.toLowerCase();
  if (combined.includes("nubank") || combined.includes("roxinho")) return "Nubank";
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
export function hasValidTransactionSignal(text?: string, title?: string): boolean {
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
    "crédito em conta",
    "credito em conta",
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
]);

function isValidCandidate(candidate: string): boolean {
  if (!candidate || candidate.length < 2) return false;
  const lower = candidate.toLowerCase().trim();
  if (lower.startsWith("r$") || /^\d/.test(lower)) return false;
  if (IGNORED_MERCHANT_TOKENS.has(lower)) return false;
  return true;
}

/**
 * Higieniza o nome do estabelecimento removendo prefixos de maquininhas/adquirentes,
 * sufixos de geolocalização e resíduos de dados de cartão.
 */
export function cleanMerchantName(rawName: string): string {
  if (!rawName) return "";
  let cleaned = rawName.trim();

  // Tratamento específico de corridas Uber
  if (/^UBER(?:\s*\*TRIP(?:\s*HELP)?|\s*\*EATS|\s*\*PENDING|\s*\*|\s+)/i.test(cleaned)) {
    return "Uber";
  }

  // Tratamento de pedidos iFood
  if (/^IFOOD(?:\s*\*PEDIDO|\s*\*ENTREGA|\s*\*|\s+)/i.test(cleaned)) {
    const after = cleaned.replace(/^IFOOD(?:\s*\*PEDIDO|\s*\*ENTREGA|\s*\*|\s+)\s*/i, "").trim();
    return after.length >= 2 ? after : "iFood";
  }

  // Tratamento de Mercado Pago / Mercado Livre
  if (/^MP\s*\*\s*MERCADOLIVRE|^MERCADOLIVRE/i.test(cleaned)) {
    return "Mercado Livre";
  }

  // Remoção de prefixos de maquininhas/adquirentes
  cleaned = cleaned.replace(
    /^(?:PAG\s*\*|PAGSEGURO\s*\*|MP\s*\*|MERCADOPAGO\s*\*|STONE\s*\*|CIELO\s*\*|GETNET\s*\*|SUMUP\s*\*|REDECARD\s*\*|REDE\s*\*|99APP\s*\*|99\s*\*)\s*/i,
    "",
  );

  // Remoção de sufixos de geolocalização como " SAO PAULO BR", " RIO DE JANEI BRA", etc.
  cleaned = cleaned.replace(/\s+[A-ZÀ-ÿ\s]{2,20}\s+(?:BR|BRA)$/i, "");

  // Remoção de resíduos de cartão como ", cartao final 1234", " final 1234"
  cleaned = cleaned.replace(/[,.-]?\s*(?:cart[aã]o\s*)?final\s*\d{4}\b.*$/i, "");

  // Remoção de pontuações soltas nas bordas
  cleaned = cleaned.replace(/^[\s,.:;/-]+|[\s,.:;/-]+$/g, "").trim();

  return cleaned;
}

/**
 * Extrai o nome do estabelecimento ou destinatário do texto da notificação,
 * com suporte multibanco (travessão, vírgulas, preposições contraídas).
 */
export function extractMerchantOrRecipient(text: string): string {
  if (!text || typeof text !== "string") return "";

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

  // 3. Padrão de preposições e contrações: em, no, na, nos, nas, para, de, do, da, pelo, pela
  // Ex: "em Padaria Estrela aprovada", "no Restaurante Fogão", "na Droga Raia", "na Tok&Stok"
  // Ignora preposições seguidas de valores (de R$, de 50), dígitos ou palavras de forma de pagamento/parcelamento
  const prepRegex =
    /\b(?:em|no|na|nos|nas|para|de|do|da|pelo|pela)\s+(?!(?:R\$\s*|\d|parcela\b|cr[ée]dito\b|d[ée]bito\b|cart[ãa]o\b|conta\b))([A-Za-zÀ-ÿ0-9&.*_\s'-]{2,35}?)(?:\s+(?:aprovada|aprovado|realizada|realizado|com|via|pelo|pela|no\s+cartão|no\s+cartao|no\s+crédito|no\s+credito|no\s+débito|no\s+debito|cart[aã]o\s+final|em\s+\d+x|\.|$)|$)/gi;
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
  if (!hasValidTransactionSignal(payload.text, payload.title)) {
    return null;
  }

  // 4. Extração de informações monetárias e parcelas
  const rawCents = extractCentsFromText(combinedText);
  const installmentInfo = extractInstallmentInfo(combinedText, rawCents);

  // Se houver parcelamento com total calculado ("3x de R$ 50" -> 15000 centavos)
  const cents = installmentInfo?.totalAmountCents ?? rawCents;
  if (!cents) return null;

  const type = detectTransactionType(payload.text, payload.title);
  const paymentMethod = detectPaymentMethod(payload.text, payload.title);
  const merchant = extractMerchantOrRecipient(payload.text);

  let defaultDesc = merchant;
  if (!defaultDesc) {
    if (installmentInfo?.currentInstallment && installmentInfo?.installments) {
      defaultDesc = `Parcela ${installmentInfo.currentInstallment}/${installmentInfo.installments} (${bankName})`;
    } else if (installmentInfo?.installments) {
      defaultDesc = `Compra em ${installmentInfo.installments}x (${bankName})`;
    } else {
      defaultDesc =
        type === "income" ? `Recebimento (${bankName})` : `Compra (${bankName})`;
    }
  }

  const dateStr = payload.timestamp
    ? toISODate(new Date(payload.timestamp))
    : toISODate(new Date());

  const id = `sug_${payload.timestamp || Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;

  const inferredSlug = inferCategoryKeyword(merchant || defaultDesc);

  return {
    id,
    bankName,
    type,
    amountCents: cents,
    description: defaultDesc,
    merchant: merchant || undefined,
    timestamp: payload.timestamp || Date.now(),
    categorySlug: inferredSlug,
    date: dateStr,
    paymentMethod,
    rawText: combinedText,
    installments: installmentInfo?.installments,
    currentInstallment: installmentInfo?.currentInstallment,
    installmentAmountCents: installmentInfo?.installmentAmountCents,
  };
}

/**
 * Faz o parsing de um texto compartilhado de comprovante Pix (Android Share Target).
 */
export function parsePixShareText(rawText: string): ParsedBankTransaction | null {
  if (!rawText || typeof rawText !== "string") return null;

  if (isBlacklistedNotification(rawText)) return null;

  const cents = extractCentsFromText(rawText);
  if (!cents) return null;

  const isIncome = detectTransactionType(rawText, "");
  const bankName = resolveBankName(undefined, undefined, rawText) || "Pix";

  // Extrai nome do destinatário / recebedor em comprovantes típicos
  const recipientMatch =
    /(?:Para|Destinatário|Nome do recebedor|Pago para|Beneficiário):\s*([^\n\r,]+)/i.exec(rawText);
  const rawRecipient =
    recipientMatch && recipientMatch[1]
      ? recipientMatch[1].trim()
      : extractMerchantOrRecipient(rawText);
  const recipient = cleanMerchantName(rawRecipient);

  const description = recipient
    ? `Pix: ${recipient}`
    : isIncome === "income"
      ? `Pix Recebido (${bankName})`
      : `Pix Enviado (${bankName})`;

  const id = `pix_${Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;
  const inferredSlug = inferCategoryKeyword(recipient || description);

  return {
    id,
    bankName,
    type: isIncome,
    amountCents: cents,
    description,
    merchant: recipient || undefined,
    timestamp: Date.now(),
    categorySlug: inferredSlug,
    date: toISODate(new Date()),
    paymentMethod: "pix",
    rawText,
  };
}
