/**
 * Parser puro e agregador estrito de conteúdo da área de transferência.
 * Reconhece exclusivamente em cascata discriminada (`PIX_BRCODE | PIX_KEY | PIX_RECEIPT | NONE`):
 * 1. Pix Copia e Cola / BR Code (EMVCo 000201... com GUI `br.gov.bcb.pix` e CRC16-CCITT válido, com ou sem valor).
 * 2. Chave Pix isolada validada estritamente (`PIX_KEY`, sempre com `valueCents === 0`).
 * 3. Comprovantes bancários formais inequívocos (`PIX_RECEIPT`, sem fallback genérico frouxo).
 */

import { parseBankSlipDigitableLine } from "./bank-slip-barcode";
import { isBankSlipReceipt } from "./bank-slip-parser";
import { isCardSlipReceipt } from "./card-slip-parser";
import { isDanfeNfcReceipt, parseNfceQrCodeUrl } from "./danfe-nfc-parser";
import { parsePixEMVPayload } from "./pix-emv-parser";
import { isPixReceipt } from "./pix-receipt-parser";
import { detectPixKey, extractPixKeyFromReceiptText, type PixKeyType } from "./pix-text-parser";
import { isInvoicePaymentReceipt, parseUniversalReceipt } from "./universal-receipt-parser";
import { isWireTransferReceipt } from "./wire-transfer-parser";

export type ClipboardPixKind = "PIX_BRCODE" | "PIX_KEY" | "PIX_RECEIPT" | "NONE";

export interface ClipboardParsedCandidate {
  kind: ClipboardPixKind;
  valueCents: number;
  description: string;
  merchant?: string;
  recipientName?: string;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  txId?: string;
  city?: string;
  taxId?: string;
  nature: "expense" | "income";
  paymentMethod: "pix" | "credit_card" | "debit_card" | "boleto" | "other";
  confidence: "high" | "medium" | "low";
  date?: string;
  rawText?: string;
}

function hasFormalReceiptSignature(text: string): boolean {
  return (
    isInvoicePaymentReceipt(text) ||
    isDanfeNfcReceipt(text) ||
    isBankSlipReceipt(text) ||
    isPixReceipt(text) ||
    isCardSlipReceipt(text) ||
    isWireTransferReceipt(text)
  );
}

/**
 * Tenta converter texto colado da área de transferência em um candidato estruturado.
 * Função 100% pura: sem efeitos colaterais e sem dependência de rede ou UI.
 */
export function parseClipboardTransactionCandidate(rawText?: string | null): ClipboardParsedCandidate | null {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  if (trimmed.length === 0) return null;

  // 1. Pix Copia e Cola EMVCo (BR Code) com validação CRC16-CCITT UTF-8 (suporta Tag 54 ausente -> valueCents = 0)
  if (trimmed.includes("000201")) {
    const emv = parsePixEMVPayload(trimmed);
    if (emv) {
      return {
        kind: "PIX_BRCODE",
        valueCents: emv.amountCents,
        description: emv.description,
        merchant: emv.merchant,
        recipientName: emv.recipientName,
        pixKey: emv.pixKey,
        txId: emv.txId,
        city: emv.city,
        nature: "expense",
        paymentMethod: "pix",
        confidence: "high",
        date: emv.date,
        rawText: emv.rawText,
      };
    }
  }

  // 2. Chave Pix isolada estrita (CPF/CNPJ Módulo 11, EVP UUIDv4, E-mail completo, Celular DDD Anatel)
  const isolatedKey = detectPixKey(trimmed);
  if (isolatedKey) {
    return {
      kind: "PIX_KEY",
      valueCents: 0,
      description: `Pix: ${isolatedKey.rawKey}`,
      pixKey: isolatedKey.normalizedKey,
      pixKeyType: isolatedKey.type,
      nature: "expense",
      paymentMethod: "pix",
      confidence: "medium",
      rawText: trimmed,
    };
  }

  // 2b. Linha digitável de boleto/arrecadação colada isolada (47/48 dígitos com dígitos verificadores válidos)
  const barcodeOnlyDigits = trimmed.replace(/\D/g, "");
  if (
    (barcodeOnlyDigits.length === 47 || barcodeOnlyDigits.length === 48) &&
    /^[0-9.\-\s]+$/.test(trimmed)
  ) {
    const decodedSlip = parseBankSlipDigitableLine(trimmed);
    if (decodedSlip && decodedSlip.isValidChecksum) {
      const slipLabel = decodedSlip.bankName
        ? `Boleto (${decodedSlip.bankName})`
        : decodedSlip.segmentLabel
          ? `Boleto: ${decodedSlip.segmentLabel}`
          : "Boleto Bancário";
      return {
        kind: "PIX_RECEIPT",
        valueCents: decodedSlip.amountCents ?? 0,
        description: slipLabel,
        merchant: decodedSlip.bankName || decodedSlip.segmentLabel,
        nature: "expense",
        paymentMethod: "boleto",
        confidence: decodedSlip.amountCents && decodedSlip.amountCents > 0 ? "high" : "medium",
        date: decodedSlip.dueDate,
        rawText: trimmed,
      };
    }
  }

  // 2c. URL de QR Code NFC-e / SAT com chave fiscal válida
  if (/^https?:\/\//i.test(trimmed)) {
    const nfceQr = parseNfceQrCodeUrl(trimmed);
    if (nfceQr) {
      return {
        kind: "PIX_RECEIPT",
        valueCents: nfceQr.amountCents,
        description: nfceQr.description,
        merchant: nfceQr.merchantOrBeneficiary,
        recipientName: nfceQr.merchantOrBeneficiary,
        taxId: nfceQr.taxId,
        nature: "expense",
        paymentMethod: "other",
        confidence: nfceQr.amountCents > 0 ? "high" : "medium",
        date: nfceQr.date,
        rawText: trimmed,
      };
    }
  }

  // 3. Comprovante bancário formal inequívoco (proibido fallback genérico em textos aleatórios)
  if (hasFormalReceiptSignature(trimmed)) {
    const receipt = parseUniversalReceipt(trimmed);
    if (receipt && receipt.amountCents > 0) {
      const method: ClipboardParsedCandidate["paymentMethod"] =
        receipt.paymentMethod === "pix"
          ? "pix"
          : receipt.paymentMethod === "credit_card"
            ? "credit_card"
            : receipt.paymentMethod === "debit"
              ? "debit_card"
              : receipt.kind === "bank_slip_payment"
                ? "boleto"
                : "other";

      const detectedKey = extractPixKeyFromReceiptText(trimmed);

      return {
        kind: "PIX_RECEIPT",
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
  }

  return null;
}
