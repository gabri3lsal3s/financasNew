import { toISODate } from "@/domain/money";

export interface ParsedBankTransaction {
  id: string;
  bankName: string;
  type: "expense" | "income";
  amountCents: number;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: "credit_card" | "debit" | "pix" | "cash" | "other";
  rawText: string;
}

export interface BankNotificationPayload {
  title: string;
  text: string;
  packageName?: string;
  timestamp?: number;
}

const BANK_PACKAGE_MAP: Record<string, string> = {
  "com.nu.production": "Nubank",
  "com.itau": "Itaú",
  "com.itau.personnalite": "Itaú Personnalité",
  "br.com.intermedium": "Inter",
  "com.c6bank.app": "C6 Bank",
  "com.bradesco": "Bradesco",
  "com.santander.app": "Santander",
  "com.mercadopago.wallet": "Mercado Pago",
  "br.gov.caixa.tem": "Caixa Tem",
  "br.com.gabba.Caixa": "Caixa",
  "br.com.bb.android": "Banco do Brasil",
};

/**
 * Converte string com formato monetário brasileiro ("R$ 42,90", "1.250,50", "42,90")
 * em valor inteiro em centavos.
 */
export function extractCentsFromText(text: string): number | null {
  const match = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\b/.exec(text);
  if (!match || !match[1] || !match[2]) return null;

  const wholeStr = match[1].replace(/\./g, "");
  const fractionStr = match[2];
  const total = parseInt(wholeStr, 10) * 100 + parseInt(fractionStr, 10);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/**
 * Identifica o nome do banco através do packageName ou do título/texto.
 */
export function resolveBankName(packageName?: string, title?: string, text?: string): string {
  if (packageName && BANK_PACKAGE_MAP[packageName]) {
    return BANK_PACKAGE_MAP[packageName];
  }

  const combined = `${title || ""} ${text || ""}`.toLowerCase();
  if (combined.includes("nubank") || combined.includes("roxinho")) return "Nubank";
  if (combined.includes("itau") || combined.includes("itaú") || combined.includes("itaucard")) return "Itaú";
  if (combined.includes("inter") || combined.includes("banco inter")) return "Inter";
  if (combined.includes("c6 bank") || combined.includes("c6")) return "C6 Bank";
  if (combined.includes("bradesco")) return "Bradesco";
  if (combined.includes("santander") || combined.includes("way")) return "Santander";
  if (combined.includes("mercado pago")) return "Mercado Pago";
  if (combined.includes("caixa tem") || combined.includes("caixa")) return "Caixa";
  if (combined.includes("banco do brasil") || combined.includes("ourocard")) return "Banco do Brasil";

  return "Banco";
}

/**
 * Detecta se a notificação trata de uma entrada (receita) ou saída (despesa).
 */
export function detectTransactionType(text: string, title: string): "expense" | "income" {
  const combined = `${title} ${text}`.toLowerCase();
  const incomeKeywords = [
    "você recebeu",
    "recebido",
    "recebida",
    "transferência recebida",
    "pix recebido",
    "depósito recebido",
    "crédito em conta",
  ];

  for (const keyword of incomeKeywords) {
    if (combined.includes(keyword)) {
      return "income";
    }
  }

  return "expense";
}

/**
 * Detecta o meio de pagamento provável da notificação.
 */
export function detectPaymentMethod(text: string, title: string): "credit_card" | "debit" | "pix" | "other" {
  const combined = `${title} ${text}`.toLowerCase();
  if (combined.includes("pix")) return "pix";
  if (combined.includes("crédito") || combined.includes("cartão") || combined.includes("cartao")) {
    return "credit_card";
  }
  if (combined.includes("débito") || combined.includes("debito")) return "debit";
  return "other";
}

/**
 * Extrai o nome do estabelecimento ou destinatário do texto da notificação.
 */
export function extractMerchantOrRecipient(text: string): string {
  // Padrão: "em [Estabelecimento]" ou "para [Destinatário]" ou "de [Pagador]"
  // Ignora ocorrências onde "de/para" é seguido de valor monetário (ex: "de R$ 250,00")
  const regex = /\b(?:em|para|de)\s+([A-Za-zÀ-ÿ][A-Za-z0-9\sÀ-ÿ._-]{1,30}?)(?:\s+(?:aprovada|realizada|com|via|no|pelo|\.|$))/gi;
  const matches = Array.from(text.matchAll(regex));

  for (const match of matches) {
    if (match && match[1]) {
      const candidate = match[1].trim();
      const lower = candidate.toLowerCase();
      if (!lower.startsWith("r$") && !/^\d/.test(candidate) && candidate.length >= 2) {
        return candidate;
      }
    }
  }

  // Fallback para fim de frase: "de Roberto Santos" ou "para Maria Silva" no final da string
  const endMatch = /\b(?:em|para|de)\s+([A-Za-zÀ-ÿ][A-Za-z0-9\sÀ-ÿ._-]{1,30})$/i.exec(text);
  if (endMatch && endMatch[1]) {
    const candidate = endMatch[1].trim();
    const lower = candidate.toLowerCase();
    if (!lower.startsWith("r$") && !/^\d/.test(candidate) && candidate.length >= 2) {
      return candidate;
    }
  }

  return "";
}

/**
 * Faz o parsing de uma notificação bancária nativa do Android.
 * Retorna uma transação normalizada pronta para sugestão em memória, ou null se não for reconhecida.
 */
export function parseBankNotification(payload: BankNotificationPayload): ParsedBankTransaction | null {
  const combinedText = `${payload.title} ${payload.text}`.trim();
  if (!combinedText) return null;

  const cents = extractCentsFromText(combinedText);
  if (!cents) return null;

  const bankName = resolveBankName(payload.packageName, payload.title, payload.text);
  const type = detectTransactionType(payload.text, payload.title);
  const paymentMethod = detectPaymentMethod(payload.text, payload.title);
  const merchant = extractMerchantOrRecipient(payload.text);

  const defaultDesc = merchant
    ? merchant
    : type === "income"
      ? `Recebimento (${bankName})`
      : `Compra (${bankName})`;

  const dateStr = payload.timestamp
    ? toISODate(new Date(payload.timestamp))
    : toISODate(new Date());

  const id = `sug_${payload.timestamp || Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    bankName,
    type,
    amountCents: cents,
    description: defaultDesc,
    date: dateStr,
    paymentMethod,
    rawText: combinedText,
  };
}

/**
 * Faz o parsing de um texto compartilhado de comprovante Pix (Android Share Target).
 */
export function parsePixShareText(rawText: string): ParsedBankTransaction | null {
  if (!rawText || typeof rawText !== "string") return null;

  const cents = extractCentsFromText(rawText);
  if (!cents) return null;

  const isIncome = detectTransactionType(rawText, "");
  const bankName = resolveBankName(undefined, undefined, rawText);

  // Extrai nome do destinatário / recebedor em comprovantes típicos
  const recipientMatch = /(?:Para|Destinatário|Nome do recebedor|Pago para|Beneficiário):\s*([^\n\r,]+)/i.exec(rawText);
  const recipient = recipientMatch && recipientMatch[1]
    ? recipientMatch[1].trim()
    : extractMerchantOrRecipient(rawText);

  const description = recipient
    ? `Pix: ${recipient}`
    : isIncome === "income"
      ? `Pix Recebido (${bankName})`
      : `Pix Enviado (${bankName})`;

  const id = `pix_${Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    bankName,
    type: isIncome,
    amountCents: cents,
    description,
    date: toISODate(new Date()),
    paymentMethod: "pix",
    rawText,
  };
}
