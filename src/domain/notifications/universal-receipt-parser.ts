/**
 * Orquestrador Universal de Parsing de Comprovantes e Notificações (OCR / Imagens / Texto).
 *
 * Analisa e classifica determinísticamente textos de comprovantes brasileiros:
 * 1. Cupons Fiscais Eletrônicos (DANFE NFC-e / Extrato SAT).
 * 2. Boletos Bancários e Guias de Tributos (DARF, GPS, Água, Luz, Telefone).
 * 3. Comprovantes de transferências e pagamentos Pix.
 * 4. Comprovantes de Maquininhas de Cartão (Slips POS / TEF: Cielo, Rede, Stone, PagBank, Getnet...).
 * 5. Transferências Bancárias Tradicionais (TED, DOC e Entre Contas).
 * 6. Fallback semântico para recibos não estruturados (recibos avulsos, recibos de aluguel/serviços).
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou banco de dados.
 */

import { toISODate } from "@/domain/money";
import type { PaymentMethod } from "@/types/schema";
import {
  cleanMerchantName,
  extractCentsFromText,
  extractDateFromReceipt,
  extractMerchantOrRecipient,
  extractTaxId,
  isBlacklistedReceipt,
  resolveBankName,
} from "./bank-parser";
import { isBankSlipReceipt, parseBankSlipReceipt } from "./bank-slip-parser";
import {
  extractTerminalAcquirer,
  isCardSlipReceipt,
  parseCardSlipReceipt,
} from "./card-slip-parser";
import { isDanfeNfcReceipt, parseDanfeNfcReceipt } from "./danfe-nfc-parser";
import { extractDetailedInstallments } from "./installment-extractor";
import { cleanOcrText } from "./ocr-cleaner";
import { isPixReceipt, parsePixReceipt } from "./pix-receipt-parser";
import type { ReceiptKind, UniversalReceiptData } from "./receipt-types";
import { isWireTransferReceipt, parseWireTransferReceipt } from "./wire-transfer-parser";

/**
 * Detecta a forma de pagamento em recibos genéricos não estruturados.
 */
function detectGenericPaymentMethod(text: string): PaymentMethod {
  const lower = text.toLowerCase();
  if (/\b(?:pix)\b/i.test(lower)) return "pix";
  if (/\b(?:cart[ãa]o\s+de\s+cr[ée]dito|cr[ée]dito)\b/i.test(lower)) return "credit_card";
  if (/\b(?:cart[ãa]o\s+de\s+d[ée]bito|d[ée]bito)\b/i.test(lower)) return "debit";
  if (/\b(?:dinheiro|esp[ée]cie)\b/i.test(lower)) return "cash";
  if (/\b(?:ted|doc|transfer[êe]ncia)\b/i.test(lower)) return "transfer";
  return "other";
}

/**
 * Extrai o beneficiário ou favorecido de recibos genéricos avulsos.
 */
function extractGenericRecipient(text: string): string {
  // 1. Rótulos explícitos de favorecido / beneficiário / prestador / emissor
  const labelMatch =
    /(?:FAVORECIDO|BENEFICI[ÁA]RIO|PRESTADOR(?:\s+DE\s+SERVI[ÇC]OS)?|EMISSOR|RECEBEDOR|NOME\s+FANTASIA|RAZ[ÃA]O\s+SOCIAL)\s*[:=]\s*([^\n\r]+)/i.exec(
      text,
    );
  if (labelMatch && labelMatch[1]) {
    const candidate = labelMatch[1].trim();
    if (candidate.length >= 2) {
      return cleanMerchantName(candidate);
    }
  }

  // 2. Fallback para extrator padrão
  return cleanMerchantName(extractMerchantOrRecipient(text));
}

/**
 * Extrai o pagador/cliente de recibos genéricos avulsos.
 */
function extractGenericPayer(text: string): string | undefined {
  const payerMatch =
    /(?:PAGADOR|CLIENTE|DEVEDOR|RECEBI\s+DE)\s*[:=]?\s*([A-Za-zÀ-ÿ\s]{3,40})(?:\s+a\s+quantia|\s+o\s+valor|[\n\r]|$)/i.exec(
      text,
    );
  if (payerMatch && payerMatch[1]) {
    const candidate = payerMatch[1].trim();
    if (candidate.length >= 2) {
      return cleanMerchantName(candidate);
    }
  }
  return undefined;
}

/**
 * Fallback semântico para recibos avulsos e declarações de pagamento genéricas.
 */
function parseGenericReceipt(cleanedText: string): UniversalReceiptData | null {
  const cents = extractCentsFromText(cleanedText);
  if (!cents || cents <= 0) return null;

  const { date: txDate } = extractDateFromReceipt(cleanedText, false);
  const taxId = extractTaxId(cleanedText);
  const paymentMethod = detectGenericPaymentMethod(cleanedText);
  const recipient = extractGenericRecipient(cleanedText);
  const payer = extractGenericPayer(cleanedText);
  const bankName = resolveBankName(undefined, undefined, cleanedText);

  // Extração de parcelas
  const installments = extractDetailedInstallments(cleanedText, cents);
  const finalCents =
    installments?.isNewFinancedPurchase && installments.totalAmountCents > 0
      ? installments.totalAmountCents
      : cents;

  let description: string;
  if (recipient) {
    description = `Recibo: ${recipient}`;
  } else if (bankName) {
    description = `Comprovante (${bankName})`;
  } else {
    description = "Comprovante de Pagamento";
  }

  if (installments && installments.count > 1 && !description.includes("x)")) {
    description = `${description} (${installments.count}x)`;
  }

  const id = `generic_${Date.now()}_${finalCents}`;

  return {
    id,
    kind: "generic",
    nature: "expense",
    amountCents: finalCents,
    date: txDate || toISODate(new Date()),
    description,
    paymentMethod,
    merchantOrBeneficiary: recipient || undefined,
    payerOrSource: payer || undefined,
    taxId,
    bankName: bankName || undefined,
    installments: installments || undefined,
    rawCleanText: cleanedText,
  };
}

/**
 * Pós-processamento que garante acoplamento de parcelamento e consistência final.
 */
function postProcessReceipt(
  receipt: UniversalReceiptData,
  cleanedText: string,
): UniversalReceiptData {
  // Se ainda não tiver parcelamento detectado, tenta extrair do texto limpo
  if (!receipt.installments) {
    const installments = extractDetailedInstallments(cleanedText, receipt.amountCents);
    if (installments && installments.count > 1) {
      receipt.installments = installments;
      if (installments.isNewFinancedPurchase && installments.totalAmountCents > 0) {
        receipt.amountCents = installments.totalAmountCents;
      }
      if (!receipt.description.includes("x)")) {
        receipt.description = `${receipt.description} (${installments.count}x)`;
      }
    }
  }

  return receipt;
}



/**
 * Função orquestradora que limpa, analisa e extrai dados consolidados de qualquer comprovante.
 */
export function parseUniversalReceipt(rawText: string): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  // 1. Limpeza e normalização óptica de OCR
  const cleaned = cleanOcrText(rawText);
  if (!cleaned || cleaned.trim().length < 5) {
    return null;
  }

  // 2. Descarta falhas, 2FA, spam e mensagens que não são transações financeiras
  if (isBlacklistedReceipt(cleaned)) {
    return null;
  }

  // 3. Orquestração determinística por ordem de especificidade e assinatura

  // A. Cupons fiscais eletrônicos ao consumidor (DANFE NFC-e / SAT)
  if (isDanfeNfcReceipt(cleaned)) {
    const parsed = parseDanfeNfcReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // B. Boletos bancários, títulos e tributos (DARF / GPS / Concessionárias)
  if (isBankSlipReceipt(cleaned)) {
    const parsed = parseBankSlipReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // C. Comprovantes de transferências e pagamentos Pix
  if (isPixReceipt(cleaned)) {
    const parsed = parsePixReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // D. Slips de maquininhas de cartão (POS / TEF)
  if (isCardSlipReceipt(cleaned) || extractTerminalAcquirer(cleaned)) {
    const parsed = parseCardSlipReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // E. Transferências bancárias tradicionais (TED / DOC / Entre Contas)
  if (isWireTransferReceipt(cleaned)) {
    const parsed = parseWireTransferReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // F. Fallback semântico para recibos avulsos ou não-estruturados
  const generic = parseGenericReceipt(cleaned);
  if (generic) return postProcessReceipt(generic, cleaned);

  return null;
}

/**
 * Retorna rótulo amigável em pt-BR descrevendo o tipo de comprovante identificado.
 */
export function getReceiptKindLabel(
  kind?: ReceiptKind | string,
  installments?: number,
): string {
  switch (kind) {
    case "card_slip":
      return installments && installments > 1
        ? `Comprovante de Cartão de Crédito (${installments}x)`
        : "Comprovante de Cartão";
    case "pix":
      return "Comprovante Pix";
    case "bank_slip_payment":
      return "Boleto Bancário";
    case "invoice_danfe":
    case "danfe_nfc_e":
      return "Cupom Fiscal";
    case "wire_transfer":
      return "Transferência Bancária";
    case "generic":
      return installments && installments > 1
        ? `Comprovante de Pagamento (${installments}x)`
        : "Comprovante de Pagamento";
    default:
      return "Comprovante";
  }
}
