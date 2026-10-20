/**
 * Decodificador puro de Payload Pix Copia-e-Cola (Padrão BR Code / EMVCo).
 * Extrai valor monetário, favorecido/estabelecimento e cidade a partir da string bruta.
 *
 * Função 100% pura: sem dependências de UI, React ou banco de dados.
 */

import { toISODate } from "@/domain/money";
import type { ParsedBankTransaction } from "./bank-parser";
import { cleanMerchantName } from "./bank-parser";
import { inferCategoryKeyword } from "./category-inference";

export interface EMVTagMap {
  [tag: string]: string;
}

/**
 * Deserializa um payload TLV (Tag-Length-Value) no padrão EMVCo.
 */
export function parseEMVTLV(payload: string): EMVTagMap {
  const tags: EMVTagMap = {};
  if (!payload || typeof payload !== "string") return tags;

  let index = 0;
  const len = payload.length;

  while (index + 4 <= len) {
    const tag = payload.slice(index, index + 2);
    const lengthStr = payload.slice(index + 2, index + 4);
    const tagLen = parseInt(lengthStr, 10);

    if (isNaN(tagLen) || tagLen < 0 || index + 4 + tagLen > len) {
      break;
    }

    const value = payload.slice(index + 4, index + 4 + tagLen);
    tags[tag] = value;
    index += 4 + tagLen;
  }

  return tags;
}

/**
 * Converte a string de valor da tag 54 (ex.: "12.50", "1500.00") em centavos inteiros.
 */
export function parseEMVAmountToCents(amountStr?: string): number | null {
  if (!amountStr) return null;
  const trimmed = amountStr.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match || !match[1]) return null;

  const whole = parseInt(match[1], 10);
  const frac = (match[2] || "").padEnd(2, "0").slice(0, 2);
  const fracInt = parseInt(frac, 10);

  const total = whole * 100 + fracInt;
  return Number.isFinite(total) && total >= 0 ? total : null;
}

/**
 * Tenta fazer o parsing de um payload Pix Copia-e-Cola (BR Code / EMVCo).
 * Retorna uma transação bancária estruturada ou null se o texto não for um código Pix válido.
 */
export function parsePixEMVPayload(rawText: string): ParsedBankTransaction | null {
  if (!rawText || typeof rawText !== "string") return null;

  const trimmed = rawText.trim();
  // Códigos Pix EMVCo válidos contêm o cabeçalho 000201
  const emvHeaderIndex = trimmed.indexOf("000201");
  if (emvHeaderIndex === -1) return null;

  const payload = trimmed.slice(emvHeaderIndex);
  const tags = parseEMVTLV(payload);

  // Tag 00 deve ser "01" (Payload Format Indicator) e tag 26 deve existir (Merchant Account Information)
  if (tags["00"] !== "01" || !tags["26"]) {
    return null;
  }

  // Tag 54: Valor da transação (opcional em QRs estáticos, comum em faturas e cobranças)
  const cents = parseEMVAmountToCents(tags["54"]) ?? 0;

  // Tag 59: Nome do recebedor / beneficiário
  const rawRecipient = tags["59"] ? tags["59"].trim() : "";
  const cleanedRecipient = cleanMerchantName(rawRecipient);

  const description = cleanedRecipient
    ? `Pix: ${cleanedRecipient}`
    : "Pix Copia e Cola";

  const id = `pix_emv_${Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;
  const categorySlug = inferCategoryKeyword(cleanedRecipient || description);

  return {
    id,
    bankName: "Pix",
    nature: "expense",
    type: "expense",
    amountCents: cents,
    currency: "BRL",
    description,
    merchant: cleanedRecipient || undefined,
    timestamp: Date.now(),
    categorySlug,
    date: toISODate(new Date()),
    paymentMethod: "pix",
    rawText: trimmed,
  };
}
