/**
 * Parser puro e agregador de conteúdo da área de transferência.
 * Reconhece em cascata:
 * 1. Pix Copia e Cola / BR Code (EMVCo 000201...).
 * 2. Comprovantes bancários completos (Pix, TED, Boleto, Cartão).
 * 3. Textos livres de compartilhamento bancário.
 */

import { parsePixEMVPayload } from "./pix-emv-parser";
import { parseUniversalReceipt } from "./universal-receipt-parser";

export interface ClipboardParsedCandidate {
  kind: "emv_code" | "receipt" | "decimal_amount";
  valueCents: number;
  description: string;
  merchant?: string;
  nature: "expense" | "income";
  paymentMethod: "pix" | "credit_card" | "debit_card" | "boleto" | "other";
  confidence: "high" | "medium" | "low";
  date?: string;
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
        nature: "expense",
        paymentMethod: "pix",
        confidence: "high",
        date: emv.date,
      };
    }
  }

  // 2. Tenta decodificar comprovante bancário universal
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

    return {
      kind: "receipt",
      valueCents: receipt.amountCents,
      description: receipt.description,
      merchant: receipt.merchantOrBeneficiary,
      nature: receipt.nature,
      paymentMethod: method,
      confidence: "high",
      date: receipt.date,
    };
  }

  return null;
}
