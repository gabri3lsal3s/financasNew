/**
 * Parser puro e agregador de conteúdo da área de transferência.
 * Reconhece em cascata:
 * 1. Pix Copia e Cola / BR Code (EMVCo 000201...).
 * 2. Comprovantes bancários completos (Pix, TED, Boleto, Cartão).
 * 3. Textos livres de compartilhamento bancário.
 */

import { parsePixEMVPayload } from "./pix-emv-parser";
import { parseUniversalReceipt } from "./universal-receipt-parser";
import { detectPixKey, parsePixFreeText, type PixKeyType } from "./pix-text-parser";

export interface ClipboardParsedCandidate {
  kind: "emv_code" | "receipt" | "decimal_amount" | "pix_key" | "pix_link" | "pix_message";
  valueCents: number;
  description: string;
  merchant?: string;
  recipientName?: string;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  taxId?: string;
  nature: "expense" | "income";
  paymentMethod: "pix" | "credit_card" | "debit_card" | "boleto" | "other";
  confidence: "high" | "medium" | "low";
  date?: string;
  rawText?: string;
}

/**
 * Tenta converter texto livre colado da área de transferência em um candidato a lançamento.
 * Função 100% pura: sem efeitos colaterais e sem dependência de rede ou UI.
 */
export function parseClipboardTransactionCandidate(rawText?: string | null): ClipboardParsedCandidate | null {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  if (trimmed.length === 0) return null;

  // 1. Tenta decodificar Pix Copia e Cola EMVCo (BR Code)
  if (trimmed.includes("000201")) {
    const emv = parsePixEMVPayload(trimmed);
    if (emv) {
      return {
        kind: "emv_code",
        valueCents: emv.amountCents,
        description: emv.description,
        merchant: emv.merchant,
        recipientName: emv.recipientName,
        pixKey: emv.pixKey,
        nature: "expense",
        paymentMethod: "pix",
        confidence: "high",
        date: emv.date,
        rawText: trimmed,
      };
    }
  }

  // 2. Se for mensagem de compartilhamento, chave avulsa ou link Pix (sem cabeçalho de comprovante formal)
  const isFormalReceipt = /\b(?:comprovante|autentica[çc][ãa]o|extrato\s+sat|danfe|documento\s+auxiliar|via\s+do\s+cliente)\b/i.test(trimmed);

  if (!isFormalReceipt) {
    const pixText = parsePixFreeText(trimmed);
    if (pixText) {
      return {
        kind: pixText.kind,
        valueCents: pixText.amountCents,
        description: pixText.description,
        merchant: pixText.recipientName,
        recipientName: pixText.recipientName,
        pixKey: pixText.pixKey,
        pixKeyType: pixText.pixKeyType,
        nature: pixText.nature,
        paymentMethod: "pix",
        confidence: pixText.confidence,
        date: pixText.date,
        rawText: trimmed,
      };
    }
  }

  // 3. Tenta decodificar comprovante bancário universal formal
  const receipt = parseUniversalReceipt(trimmed);
  if (receipt && receipt.amountCents > 0) {
    const method: ClipboardParsedCandidate["paymentMethod"] =
      receipt.paymentMethod === "pix"
        ? "pix"
        : receipt.paymentMethod === "credit_card"
          ? "credit_card"
          : receipt.paymentMethod === "debit"
            ? "debit_card"
            : "other";

    const detectedKey = detectPixKey(trimmed);

    return {
      kind: "receipt",
      valueCents: receipt.amountCents,
      description: receipt.description,
      merchant: receipt.merchantOrBeneficiary,
      recipientName: receipt.merchantOrBeneficiary,
      taxId: receipt.taxId,
      pixKey: detectedKey?.normalizedKey,
      pixKeyType: detectedKey?.type,
      nature: receipt.nature,
      paymentMethod: method,
      confidence: "high",
      date: receipt.date,
      rawText: trimmed,
    };
  }

  // 4. Fallback final para texto Pix se ainda não capturado
  const fallbackPix = parsePixFreeText(trimmed);
  if (fallbackPix) {
    return {
      kind: fallbackPix.kind,
      valueCents: fallbackPix.amountCents,
      description: fallbackPix.description,
      merchant: fallbackPix.recipientName,
      recipientName: fallbackPix.recipientName,
      pixKey: fallbackPix.pixKey,
      pixKeyType: fallbackPix.pixKeyType,
      nature: fallbackPix.nature,
      paymentMethod: "pix",
      confidence: fallbackPix.confidence,
      date: fallbackPix.date,
      rawText: trimmed,
    };
  }

  return null;
}
