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
  extractCardLastDigits,
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
import { getLearnedReceiptPreferences } from "./receipt-learning";
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
    /(?:PAGADOR|CLIENTE|DEVEDOR|RECEBI\s+DE|CONTA\s+DEBITADA[\s\S]*?NOME|DADOS\s+DA\s+CONTA[\s\S]*?NOME|NOME)\s*[:=\n]?\s*([A-Za-zÀ-ÿ\s]{3,40})(?:\s+a\s+quantia|\s+o\s+valor|ag[êe]ncia|[\n\r]|$)/i.exec(
      text,
    );
  if (payerMatch && payerMatch[1]) {
    const candidate = payerMatch[1].trim();
    if (candidate.length >= 2 && !/^(?:do\s+documento|da\s+conta|do\s+cart[ãa]o)/i.test(candidate)) {
      return cleanMerchantName(candidate);
    }
  }
  return undefined;
}

/**
 * Extrai o valor monetário total de recibos genéricos buscando explicitamente linhas de totalizador
 * (do fim para o início) antes de recorrer ao primeiro valor monetário encontrado.
 */
export function extractGenericReceiptTotalCents(text: string): number | null {
  if (!text) return null;

  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Busca reversa por linha explícita de total (do fim para o início)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (/\b(?:troco|troco\s+r\$|tributos|lei\s+12\.741)\b/i.test(line)) continue;

    const matchTotal = line.match(
      /(?:VALOR\s+A\s+PAGAR|TOTAL\s+(?:A\s+PAGAR|LIQUIDO|GERAL)|VALOR\s+TOTAL|TOTAL\s+R\$|TOTAL\s*[:=])\s*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i,
    );
    if (matchTotal && matchTotal[1]) {
      const cents = extractCentsFromText(matchTotal[1]);
      if (cents && cents > 0) return cents;
    }
  }

  // 2. Fallback: extrai o primeiro valor monetário geral
  return extractCentsFromText(text);
}

/**
 * Fallback semântico para recibos avulsos e declarações de pagamento genéricas.
 */
function parseGenericReceipt(cleanedText: string): UniversalReceiptData | null {
  const cents = extractGenericReceiptTotalCents(cleanedText);
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
 * Verifica se o comprovante se refere explicitamente a pagamento de fatura de cartão de crédito.
 */
export function isInvoicePaymentReceipt(text: string): boolean {
  if (!text) return false;
  return (
    /\b(?:fatura\s+(?:do\s+)?cart[ãa]o|comprovante\s+de\s+pagamento\s+cart[ãa]o\s+de\s+cr[ée]dito|fatura\s+nubank|fatura\s+ita[úu])\b/i.test(
      text,
    )
  );
}

/**
 * Realiza o parsing de comprovante de pagamento de fatura de cartão de crédito.
 */
export function parseCreditCardInvoicePayment(cleanedText: string): UniversalReceiptData | null {
  const cents = extractGenericReceiptTotalCents(cleanedText) || extractCentsFromText(cleanedText);
  if (!cents || cents <= 0) return null;

  const { date: txDate } = extractDateFromReceipt(cleanedText, false);
  const taxId = extractTaxId(cleanedText);
  const bankName = resolveBankName(undefined, undefined, cleanedText) || "Cartão de Crédito";
  const cardLastDigits = extractCardLastDigits(cleanedText);
  const payer = extractGenericPayer(cleanedText);

  const description = `Fatura do Cartão (${bankName})`;
  const id = `invoice_payment_${Date.now()}_${cents}`;

  return {
    id,
    kind: "card_slip",
    nature: "expense",
    amountCents: cents,
    date: txDate || toISODate(new Date()),
    description,
    paymentMethod: "credit_card",
    merchantOrBeneficiary: description,
    payerOrSource: payer || undefined,
    bankName,
    cardLastDigits,
    taxId,
    rawCleanText: cleanedText,
  };
}

/**
 * Pós-processamento que garante acoplamento de parcelamento, memória adaptativa e consistência final.
 */
function postProcessReceipt(
  receipt: UniversalReceiptData,
  cleanedText: string,
): UniversalReceiptData {
  // 1. Tenta enriquecer com aprendizado histórico do usuário se disponível
  const learned = getLearnedReceiptPreferences({
    cnpj: receipt.taxId,
    merchantName: receipt.merchantOrBeneficiary,
    rawText: cleanedText,
  });

  if (learned) {
    if (learned.merchantName && (!receipt.merchantOrBeneficiary || receipt.merchantOrBeneficiary.length < 3)) {
      receipt.merchantOrBeneficiary = learned.merchantName;
      receipt.description = learned.merchantName;
    }
    if (learned.paymentMethod && receipt.paymentMethod === "other") {
      receipt.paymentMethod = learned.paymentMethod;
    }
    if (learned.cardLastDigits && !receipt.cardLastDigits) {
      receipt.cardLastDigits = learned.cardLastDigits;
    }
    if (learned.cardBrand && !receipt.cardBrand) {
      receipt.cardBrand = learned.cardBrand;
    }
  }

  // 2. Se ainda não tiver parcelamento detectado, tenta extrair do texto limpo
  // Em cupons fiscais (invoice_danfe), o total apurado é soberano e expressões como "3X 2,29"
  // representam multiplicação de itens no PDV, nunca parcelamento de cartão.
  if (!receipt.installments && receipt.kind !== "invoice_danfe") {
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
export function parseUniversalReceipt(
  rawText: string,
  isManualUpload = false,
): UniversalReceiptData | null {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  // 1. Limpeza e normalização óptica de OCR
  const cleaned = cleanOcrText(rawText);
  if (!cleaned || cleaned.trim().length < 5) {
    return null;
  }

  // 2. Descarta falhas, 2FA, spam e mensagens que não são transações financeiras
  if (isBlacklistedReceipt(cleaned, isManualUpload)) {
    return null;
  }

  // 3. Orquestração determinística por ordem de especificidade e assinatura

  // A. Comprovantes de pagamento de faturas de cartão de crédito
  if (isInvoicePaymentReceipt(cleaned)) {
    const invoice = parseCreditCardInvoicePayment(cleaned);
    if (invoice) return postProcessReceipt(invoice, cleaned);
  }

  // B. Cupons fiscais eletrônicos ao consumidor (DANFE NFC-e / SAT / ECF / PDV)
  if (isDanfeNfcReceipt(cleaned)) {
    const parsed = parseDanfeNfcReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // C. Boletos bancários, títulos e tributos (DARF / GPS / Concessionárias)
  if (isBankSlipReceipt(cleaned)) {
    const parsed = parseBankSlipReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // D. Comprovantes de transferências e pagamentos Pix
  if (isPixReceipt(cleaned)) {
    const parsed = parsePixReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // E. Slips de maquininhas de cartão (POS / TEF)
  if (isCardSlipReceipt(cleaned) || extractTerminalAcquirer(cleaned)) {
    const parsed = parseCardSlipReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // F. Transferências bancárias tradicionais (TED / DOC / Entre Contas)
  if (isWireTransferReceipt(cleaned)) {
    const parsed = parseWireTransferReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned);
  }

  // G. Fallback semântico para recibos avulsos ou não-estruturados
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
