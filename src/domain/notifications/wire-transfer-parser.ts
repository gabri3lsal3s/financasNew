/**
 * Parser puro de comprovantes de transferências bancárias tradicionais (TED, DOC e Entre Contas).
 *
 * Suporta comprovantes dos principais bancos brasileiros (Itaú, Bradesco, Santander,
 * Banco do Brasil, Caixa, Safra, etc.).
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import { toISODate } from "@/domain/money";
import {
  cleanMerchantName,
  extractCentsFromText,
  extractDateFromReceipt,
  extractTaxId,
  isBlacklistedReceipt,
  resolveBankName,
} from "./bank-parser";
import { isBankSlipReceipt } from "./bank-slip-parser";
import { isPixReceipt } from "./pix-receipt-parser";
import type { UniversalReceiptData } from "./receipt-types";

/**
 * Verifica se o texto possui marcadores característicos de transferência bancária tradicional (TED/DOC).
 */
export function isWireTransferReceipt(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  if (isBlacklistedReceipt(text)) return false;

  // Pix e Boletos têm parsers próprios e não devem colidir com transferências tradicionais
  if (isPixReceipt(text)) return false;
  if (isBankSlipReceipt(text)) return false;

  const wireMarkers = [
    /\bcomprovante\s+(?:de\s+)?transfer[êe]ncia(?:\s+banc[áa]ria)?\b/i,
    /\btransfer[êe]ncia\s+(?:eletr[ôo]nica\s+dispon[íi]vel|ted|doc|entre\s+contas)\b/i,
    /\bcomprovante\s+(?:de\s+)?(?:ted|doc)\b/i,
    /\bopera[çc][ãa]o\s*:\s*ted\b/i,
    /\btipo\s+de\s+transfer[êe]ncia\s*:\s*(?:ted|doc|mesma\s+institui[çc][ãa]o|entre\s+contas)\b/i,
  ];

  for (const rx of wireMarkers) {
    if (rx.test(lower)) return true;
  }

  if (
    /\btransfer[êe]ncia\b/i.test(lower) &&
    /\b(?:ag[êe]ncia|conta\s+corrente|c\/c|favorecido)\b/i.test(lower) &&
    /\b(?:valor|banco)\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Extrai o nome do favorecido / destinatário da transferência bancária.
 */
export function extractWireBeneficiary(text: string): string {
  const match =
    /(?:(?:Favorecido|Destinat[áa]rio|Conta\s+de\s+Destino)[\s\S]*?(?:Nome|Raz[ãa]o\s+Social):\s*([^\n\r,]+)|(?:Favorecido|Destinat[áa]rio|Nome\s+do\s+Favorecido|Para|Cr[ée]dito\s+para)\s*[:=]\s*([^\n\r,]+))/i.exec(
      text,
    );
  if (match) {
    const candidate = (match[1] || match[2] || "").trim();
    if (candidate.length >= 3 && !/^(?:n[ãa]o\s+informado|-+)$/i.test(candidate)) {
      return cleanMerchantName(candidate);
    }
  }
  return "";
}

/**
 * Extrai o nome do remetente / emissor da transferência bancária.
 */
export function extractWireSender(text: string): string {
  const match =
    /(?:(?:Remetente|Origem|Conta\s+de\s+Origem)[\s\S]*?(?:Nome|Raz[ãa]o\s+Social):\s*([^\n\r,]+)|(?:Remetente|Origem|Nome\s+do\s+Remetente|De|Debitado\s+de)\s*[:=]\s*([^\n\r,]+))/i.exec(
      text,
    );
  if (match) {
    const candidate = (match[1] || match[2] || "").trim();
    if (candidate.length >= 3 && !/^(?:n[ãa]o\s+informado|-+)$/i.test(candidate)) {
      return cleanMerchantName(candidate);
    }
  }
  return "";
}

/**
 * Extrai o banco de destino / contraparte da transferência bancária.
 */
export function extractWireCounterpartBank(text: string): string | undefined {
  const bankMatch =
    /(?:Banco\s+de\s+Destino|Institui[çc][ãa]o\s+de\s+Destino|Banco\s+Favorecido|Banco)\s*[:=]\s*([^\n\r,]+)/i.exec(
      text,
    );
  if (bankMatch && bankMatch[1]) {
    return resolveBankName(undefined, undefined, bankMatch[1]) ?? undefined;
  }
  return undefined;
}

/**
 * Executa o parsing especializado de um comprovante de TED / DOC / Transferência entre contas.
 */
export function parseWireTransferReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") return null;

  if (isBlacklistedReceipt(rawText)) return null;

  const cents = extractCentsFromText(rawText);
  if (!cents || cents <= 0) return null;

  const { date: txDate } = extractDateFromReceipt(rawText, false);
  const beneficiary = extractWireBeneficiary(rawText);
  const sender = extractWireSender(rawText);
  const taxId = extractTaxId(rawText);

  // Resolução do banco de origem
  const headerLines = rawText.split(/[\r\n]+/).slice(0, 4).join(" ");
  let originBank = resolveBankName(undefined, undefined, headerLines);
  if (!originBank) {
    originBank = resolveBankName(undefined, undefined, rawText) || "Transferência Bancária";
  }

  const counterpartBank = extractWireCounterpartBank(rawText);

  let description: string;
  if (beneficiary) {
    description = `TED para ${beneficiary}`;
  } else if (counterpartBank) {
    description = `Transferência (${counterpartBank})`;
  } else {
    description = `Transferência TED (${originBank})`;
  }

  const id = `wire_${Date.now()}_${cents}`;

  return {
    id,
    kind: "wire_transfer",
    nature: "expense",
    amountCents: cents,
    date: txDate || toISODate(new Date()),
    description,
    paymentMethod: "transfer",
    merchantOrBeneficiary: beneficiary || undefined,
    payerOrSource: sender || undefined,
    taxId,
    bankName: originBank,
    issuerBank: counterpartBank,
    rawCleanText: rawText,
  };
}
