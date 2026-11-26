/**
 * Decodificador puro de Payload Pix Copia-e-Cola (Padrão BR Code / EMVCo).
 * Extrai valor monetário, favorecido/estabelecimento, chave Pix, TxID, URL dinâmica e cidade
 * com validação matemática estrita do checksum CRC16-CCITT sobre bytes UTF-8.
 *
 * Função 100% pura: sem dependências de UI, React ou banco de dados.
 */

import { toISODate } from "@/domain/money/parcelar";
import { calculatePixCrc16, stripInvisiblePixChars } from "@/domain/pix/pix-br-code";
import type { ParsedBankTransaction } from "./bank-parser";
import { cleanMerchantName } from "./bank-parser";
import { inferCategoryKeyword } from "./category-inference";

export interface EMVTagMap {
  [tag: string]: string;
}

export interface ParsedPixEmvTransaction extends ParsedBankTransaction {
  city?: string;
  dynamicUrl?: string;
}

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const UTF8_LENIENT_DECODER = new TextDecoder("utf-8");

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, seed 0xFFFF) sobre bytes UTF-8
 * reutilizando a fonte única do domínio Pix (`calculatePixCrc16`).
 */
export function computeEMVCRC16(payloadToSign: string): string {
  return calculatePixCrc16(payloadToSign);
}

/**
 * Deserializa um payload TLV (Tag-Length-Value) no padrão EMVCo percorrendo comprimentos em bytes UTF-8.
 */
export function parseEMVTLV(payload: string): EMVTagMap {
  const tags: EMVTagMap = {};
  if (!payload || typeof payload !== "string") return tags;

  const bytes = UTF8_ENCODER.encode(payload);
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const t0 = bytes[offset]!;
    const t1 = bytes[offset + 1]!;
    const l0 = bytes[offset + 2]!;
    const l1 = bytes[offset + 3]!;

    if (
      t0 < 0x30 || t0 > 0x39 ||
      t1 < 0x30 || t1 > 0x39 ||
      l0 < 0x30 || l0 > 0x39 ||
      l1 < 0x30 || l1 > 0x39
    ) {
      break;
    }

    const tag = String.fromCharCode(t0, t1);
    const tagLen = (l0 - 0x30) * 10 + (l1 - 0x30);
    if (tagLen < 0 || offset + 4 + tagLen > bytes.length) {
      break;
    }

    const value = UTF8_LENIENT_DECODER.decode(bytes.subarray(offset + 4, offset + 4 + tagLen));
    tags[tag] = value;
    offset += 4 + tagLen;
  }

  return tags;
}

/**
 * Valida estritamente a estrutura TLV em bytes UTF-8 e o checksum matemático CRC16-CCITT (Tag 6304).
 */
export function validateEMVCRC16(payload: string): boolean {
  if (!payload || typeof payload !== "string") return false;

  const cleaned = stripInvisiblePixChars(payload).trim();
  if (cleaned.length < 12 || !cleaned.startsWith("000201")) {
    return false;
  }

  const tag63Index = cleaned.lastIndexOf("6304");
  if (tag63Index === -1 || tag63Index !== cleaned.length - 8) {
    return false;
  }

  const expectedCrc = cleaned.slice(tag63Index + 4).toUpperCase();
  if (!/^[0-9A-F]{4}$/.test(expectedCrc)) {
    return false;
  }

  const payloadToSign = cleaned.slice(0, tag63Index + 4);
  return computeEMVCRC16(payloadToSign) === expectedCrc;
}

/**
 * Extrai e delimita o bloco EMVCo exato a partir de "000201" até a Tag 6304XXXX,
 * higienizando quebras de linha e caracteres invisíveis injetados por apps de mensagem.
 */
function extractDelimitedEMVPayload(rawText: string): { payload: string; tags: EMVTagMap } | null {
  const sanitized = stripInvisiblePixChars(rawText).trim();
  let searchFrom = 0;

  while (searchFrom < sanitized.length) {
    const headerIdx = sanitized.indexOf("000201", searchFrom);
    if (headerIdx === -1) return null;

    const candidate = sanitized.slice(headerIdx);
    const bytes = UTF8_ENCODER.encode(candidate);
    const tags: EMVTagMap = {};
    let offset = 0;
    let reachedTag63 = false;
    let malformed = false;

    while (offset + 4 <= bytes.length) {
      const t0 = bytes[offset]!;
      const t1 = bytes[offset + 1]!;
      const l0 = bytes[offset + 2]!;
      const l1 = bytes[offset + 3]!;

      if (
        t0 < 0x30 || t0 > 0x39 ||
        t1 < 0x30 || t1 > 0x39 ||
        l0 < 0x30 || l0 > 0x39 ||
        l1 < 0x30 || l1 > 0x39
      ) {
        malformed = true;
        break;
      }

      const tag = String.fromCharCode(t0, t1);
      const tagLen = (l0 - 0x30) * 10 + (l1 - 0x30);
      if (tagLen < 0 || offset + 4 + tagLen > bytes.length) {
        malformed = true;
        break;
      }

      let value: string;
      try {
        value = UTF8_DECODER.decode(bytes.subarray(offset + 4, offset + 4 + tagLen));
      } catch {
        malformed = true;
        break;
      }

      tags[tag] = value;
      offset += 4 + tagLen;

      if (tag === "63") {
        if (tagLen !== 4) {
          malformed = true;
        } else {
          reachedTag63 = true;
        }
        break;
      }
    }

    if (!malformed && reachedTag63) {
      const delimitedPayload = UTF8_DECODER.decode(bytes.subarray(0, offset));
      if (validateEMVCRC16(delimitedPayload)) {
        return { payload: delimitedPayload, tags };
      }
    }

    searchFrom = headerIdx + 6;
  }

  return null;
}

/**
 * Converte a string de valor da tag 54 (ex.: "12.50", "1500.00") em centavos inteiros.
 */
export function parseEMVAmountToCents(amountStr?: string): number | null {
  if (!amountStr) return null;
  const trimmed = amountStr.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match || !match[1]) return null;

  const whole = Number.parseInt(match[1], 10);
  const frac = (match[2] || "").padEnd(2, "0").slice(0, 2);
  const fracInt = Number.parseInt(frac, 10);

  const total = whole * 100 + fracInt;
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

/**
 * Tenta fazer o parsing estrito de um payload Pix Copia-e-Cola (BR Code / EMVCo).
 * Valida GUI `br.gov.bcb.pix` (tags 26..51) e checksum matemático CRC16-CCITT (tag 6304).
 * Suporta códigos estáticos e dinâmicos com ou sem valor embutido (Tag 54).
 */
export function parsePixEMVPayload(rawText: string): ParsedPixEmvTransaction | null {
  if (!rawText || typeof rawText !== "string") return null;

  const extracted = extractDelimitedEMVPayload(rawText);
  if (!extracted) return null;

  const { payload, tags } = extracted;

  // Validação obrigatória do Payload Format Indicator (CRC16 UTF-8 já validado em extractDelimitedEMVPayload)
  if (tags["00"] !== "01") {
    return null;
  }

  // Varre tags 26..51 (Merchant Account Information) procurando GUI oficial br.gov.bcb.pix
  let pixKey: string | undefined;
  let customDesc: string | undefined;
  let dynamicUrl: string | undefined;
  let hasPixGui = false;

  for (let tagNum = 26; tagNum <= 51; tagNum++) {
    const tagStr = String(tagNum);
    const rawAccountTag = tags[tagStr];
    if (!rawAccountTag) continue;

    const subTags = parseEMVTLV(rawAccountTag);
    if (subTags["00"]?.trim().toLowerCase() === "br.gov.bcb.pix") {
      hasPixGui = true;
      if (subTags["01"]?.trim()) {
        pixKey = subTags["01"].trim();
      }
      if (subTags["02"]?.trim()) {
        customDesc = subTags["02"].trim();
      }
      if (subTags["25"]?.trim()) {
        dynamicUrl = subTags["25"].trim();
      }
      break;
    }
  }

  if (!hasPixGui || (!pixKey && !dynamicUrl)) {
    return null;
  }

  // Tag 62: Campo adicional com TxID (subtag 05)
  let txId: string | undefined;
  if (tags["62"]) {
    const subTags62 = parseEMVTLV(tags["62"]);
    if (subTags62["05"] && subTags62["05"].trim() !== "***") {
      txId = subTags62["05"].trim();
    }
  }

  // Tag 54: Valor da transação (opcional em QRs estáticos e em alguns QRs dinâmicos -> 0 quando ausente)
  const cents = parseEMVAmountToCents(tags["54"]) ?? 0;

  // Tag 59: Nome do recebedor / beneficiário; Tag 60: Cidade
  const rawRecipient = tags["59"] ? tags["59"].trim() : "";
  const cleanedRecipient = cleanMerchantName(rawRecipient);
  const city = tags["60"] ? tags["60"].trim() : undefined;

  const description = customDesc
    ? `Pix: ${customDesc}`
    : cleanedRecipient
      ? `Pix: ${cleanedRecipient}`
      : dynamicUrl
        ? "Pix Cobrança Dinâmica"
        : "Pix Copia e Cola";

  const id = `pix_emv_${Date.now()}_${cents}_${Math.random().toString(36).slice(2, 7)}`;
  const categorySlug = inferCategoryKeyword(customDesc || cleanedRecipient || description);

  return {
    id,
    bankName: "Pix",
    nature: "expense",
    type: "expense",
    amountCents: cents,
    currency: "BRL",
    description,
    merchant: cleanedRecipient || undefined,
    recipientName: cleanedRecipient || undefined,
    pixKey,
    txId,
    city,
    dynamicUrl,
    timestamp: Date.now(),
    categorySlug,
    date: toISODate(new Date()),
    paymentMethod: "pix",
    rawText: payload,
  };
}
