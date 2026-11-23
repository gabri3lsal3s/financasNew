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
import { cleanCPF } from "@/domain/validation/cpf";
import type { PaymentMethod } from "@/types/schema";
import {
  cleanMerchantName,
  extractCardLastDigits,
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
import { isInvalidPartyCandidate, isPixReceipt, parsePixReceipt } from "./pix-receipt-parser";
import {
  extractSovereignReceiptAmountCents,
  scoreSovereignReceiptAmount,
} from "./receipt-amount-scorer";
import { getLearnedReceiptPreferences } from "./receipt-learning";
import type {
  ConfidenceLevel,
  ReceiptFieldConfidence,
  ReceiptKind,
  ReceiptUserContext,
  UniversalReceiptData,
} from "./receipt-types";
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
 * Extrai o valor monetário soberano de recibos genéricos via scorer único.
 */
export function extractGenericReceiptTotalCents(text: string): number | null {
  return extractSovereignReceiptAmountCents(text);
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
  const cents = extractSovereignReceiptAmountCents(cleanedText);
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

const PORTUGUESE_NAME_STOPWORDS = new Set(["de", "da", "do", "dos", "das", "e"]);

function extractSignificantNameTokens(name?: string | null): string[] {
  if (!name || typeof name !== "string") return [];
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !PORTUGUESE_NAME_STOPWORDS.has(token));
}

function matchesUserFullName(
  partyName: string | undefined,
  userFullName?: string | null,
): boolean {
  const userTokens = extractSignificantNameTokens(userFullName);
  const partyTokens = extractSignificantNameTokens(partyName);
  if (userTokens.length === 0 || partyTokens.length === 0) {
    return false;
  }

  const partySet = new Set(partyTokens);
  let matchedTokens = 0;
  for (const token of userTokens) {
    if (partySet.has(token)) {
      matchedTokens++;
    }
  }

  // Ajuste técnico 2: perfis com nome composto exigem >= 2 tokens significativos (evita colisão homônima)
  if (userTokens.length >= 2) {
    return matchedTokens >= 2;
  }

  const singleUserToken = userTokens[0]!;
  return singleUserToken.length >= 3 && partySet.has(singleUserToken);
}

function matchesUserCpf(partyTaxId: string | undefined, userCpf?: string | null): boolean {
  if (!partyTaxId || !userCpf) return false;
  if (partyTaxId.includes("/")) return false;

  const userDigits = cleanCPF(userCpf);
  if (userDigits.length !== 11) return false;

  const stripped = partyTaxId.replace(/[^0-9*\u2022]/g, "");
  if (stripped.length === 11) {
    let matchedDigits = 0;
    for (let i = 0; i < 11; i++) {
      const ch = stripped.charAt(i);
      if (/\d/.test(ch)) {
        if (ch !== userDigits.charAt(i)) {
          return false;
        }
        matchedDigits++;
      }
    }
    return matchedDigits >= 4;
  }

  // Suporta máscaras parciais com ruído de OCR (ex.: "....282.464--.-") comparando miolo de 6 dígitos
  const rawDigitsOnly = partyTaxId.replace(/\D/g, "");
  const middleSix = userDigits.slice(3, 9);
  return rawDigitsOnly.length >= 6 && rawDigitsOnly.length <= 9 && rawDigitsOnly.includes(middleSix);
}

function matchesUserParty(
  partyName: string | undefined,
  partyTaxId: string | undefined,
  userContext?: ReceiptUserContext,
): boolean {
  if (!userContext) return false;
  if (matchesUserCpf(partyTaxId, userContext.userCpf)) return true;
  if (matchesUserFullName(partyName, userContext.userFullName)) return true;
  return false;
}

function arePartiesIdentical(a?: string, b?: string): boolean {
  const tokensA = extractSignificantNameTokens(a);
  const tokensB = extractSignificantNameTokens(b);
  if (tokensA.length < 2 || tokensA.length !== tokensB.length) {
    return false;
  }
  return tokensA.every((token, idx) => token === tokensB[idx]);
}

function applyTitularityResolution(
  receipt: UniversalReceiptData,
  cleanedText: string,
  userContext?: ReceiptUserContext,
): boolean {
  const isP2PTransfer =
    receipt.kind === "pix" ||
    receipt.kind === "wire_transfer" ||
    (receipt.kind === "generic" && /\b(?:pix|transfer[êe]ncia|ted|doc|dep[óo]sito)\b/i.test(cleanedText));

  if (!isP2PTransfer) {
    return false;
  }

  // Mesmo sem userContext, nomes completos idênticos em origem e destino sinalizam mesma titularidade
  if (
    !userContext?.userFullName &&
    !userContext?.userCpf &&
    arePartiesIdentical(receipt.merchantOrBeneficiary, receipt.payerOrSource)
  ) {
    receipt.isSameTitularity = true;
    return false;
  }

  const isRecipientUser = matchesUserParty(
    receipt.merchantOrBeneficiary,
    receipt.recipientTaxId,
    userContext,
  );
  const isPayerUser = matchesUserParty(
    receipt.payerOrSource,
    receipt.payerTaxId,
    userContext,
  );

  if (isRecipientUser && isPayerUser) {
    receipt.isSameTitularity = true;
    return false;
  }

  if (isRecipientUser && !isPayerUser) {
    receipt.nature = "income";
    receipt.isSameTitularity = false;
    const counterpart = receipt.payerOrSource;
    const bankLabel = receipt.bankName || (receipt.kind === "wire_transfer" ? "Banco" : "Pix");
    if (receipt.kind === "pix") {
      receipt.description = counterpart
        ? `Pix Recebido: ${counterpart}`
        : `Pix Recebido (${bankLabel})`;
    } else if (receipt.kind === "wire_transfer") {
      receipt.description = counterpart
        ? `TED Recebida: ${counterpart}`
        : `TED Recebida (${bankLabel})`;
    } else if (counterpart) {
      receipt.description = `Transferência Recebida: ${counterpart}`;
    }
    return true;
  }

  if (isPayerUser && !isRecipientUser) {
    receipt.nature = "expense";
    receipt.isSameTitularity = false;
    const counterpart = receipt.merchantOrBeneficiary;
    const bankLabel = receipt.bankName || (receipt.kind === "wire_transfer" ? "Banco" : "Pix");
    if (receipt.kind === "pix") {
      receipt.description = receipt.isScheduled
        ? counterpart
          ? `Pix Agendado: ${counterpart}`
          : `Pix Agendado (${bankLabel})`
        : counterpart
          ? `Pix para ${counterpart}`
          : `Pix (${bankLabel})`;
    } else if (receipt.kind === "wire_transfer") {
      receipt.description = counterpart
        ? `TED para ${counterpart}`
        : `Transferência TED (${bankLabel})`;
    }
    return true;
  }

  return false;
}

const EXPLICIT_DATE_IN_TEXT_REGEX =
  /\b\d{2}[/.-]\d{2}[/.-]\d{2,4}\b|\b\d{1,2}\s+(?:de\s+)?(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:[çc]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)(?:\s+(?:de\s+)?\d{2,4})?\b/i;

function computeReceiptConfidence(
  receipt: UniversalReceiptData,
  cleanedText: string,
  natureResolvedByTitularity: boolean,
): {
  confidence: ConfidenceLevel;
  confidenceScore: number;
  fieldConfidence: ReceiptFieldConfidence;
} {
  // 1. Confiança do valor monetário
  let amountConf: ConfidenceLevel;
  if (receipt.kind === "invoice_danfe" || receipt.kind === "card_slip") {
    amountConf = receipt.amountCents > 0 ? "high" : "low";
  } else {
    const scored = scoreSovereignReceiptAmount(cleanedText);
    amountConf = scored?.confidence ?? (receipt.amountCents > 0 ? "medium" : "low");
  }

  // 2. Confiança da contraparte (recebedor em saída, pagador em entrada)
  const activeCounterparty =
    receipt.nature === "income"
      ? receipt.payerOrSource || receipt.merchantOrBeneficiary
      : receipt.merchantOrBeneficiary;

  let counterpartyConf: ConfidenceLevel = "low";
  if (activeCounterparty && activeCounterparty.trim().length >= 3 && !isInvalidPartyCandidate(activeCounterparty)) {
    counterpartyConf = "high";
  } else if (isInvoicePaymentReceipt(cleanedText) && receipt.payerOrSource) {
    counterpartyConf = "medium";
  }

  // 3. Confiança da natureza (Receita vs. Despesa)
  let natureConf: ConfidenceLevel = "medium";
  if (
    natureResolvedByTitularity ||
    receipt.kind === "bank_slip_payment" ||
    receipt.kind === "invoice_danfe" ||
    receipt.kind === "card_slip"
  ) {
    natureConf = "high";
  } else if (
    /\b(?:pix\s+(?:enviado|recebido)|comprovante\s+de\s+(?:envio|pagamento|recebimento)|ted\s+(?:enviad[ao]|recebid[ao])|voc[êe]\s+(?:recebeu|pagou|transferiu|enviou)|recebemos\s+um\s+pix|recebi\s+de)\b/i.test(
      cleanedText,
    )
  ) {
    natureConf = "high";
  } else if (receipt.kind === "generic") {
    natureConf = "low";
  }

  // 4. Confiança da data
  const dateConf: ConfidenceLevel = EXPLICIT_DATE_IN_TEXT_REGEX.test(cleanedText)
    ? "high"
    : "low";

  const amountWeight = amountConf === "high" ? 0.4 : amountConf === "medium" ? 0.28 : 0.1;
  const counterpartyWeight =
    counterpartyConf === "high" ? 0.25 : counterpartyConf === "medium" ? 0.14 : 0;
  const natureWeight = natureConf === "high" ? 0.15 : natureConf === "medium" ? 0.09 : 0.04;
  const dateWeight = dateConf === "high" ? 0.1 : 0.02;
  const structureWeight = receipt.kind === "generic" ? 0.04 : 0.1;

  const rawScore = amountWeight + counterpartyWeight + natureWeight + dateWeight + structureWeight;
  const confidenceScore = Math.min(1, Math.max(0, Math.round(rawScore * 100) / 100));

  const confidence: ConfidenceLevel =
    confidenceScore >= 0.85 ? "high" : confidenceScore >= 0.6 ? "medium" : "low";

  return {
    confidence,
    confidenceScore,
    fieldConfidence: {
      amount: amountConf,
      counterparty: counterpartyConf,
      nature: natureConf,
      date: dateConf,
    },
  };
}

/**
 * Pós-processamento que garante resolução de titularidade, memória adaptativa,
 * parcelamento e score determinístico de confiança.
 */
function postProcessReceipt(
  receipt: UniversalReceiptData,
  cleanedText: string,
  userContext?: ReceiptUserContext,
): UniversalReceiptData {
  // 1. Resolução de titularidade (receita vs. despesa / mesma titularidade)
  const natureResolvedByTitularity = applyTitularityResolution(receipt, cleanedText, userContext);

  // 2. Tenta enriquecer com aprendizado histórico do usuário se disponível
  const lookupName =
    receipt.nature === "income" && receipt.payerOrSource
      ? receipt.payerOrSource
      : receipt.merchantOrBeneficiary;

  const learned = getLearnedReceiptPreferences({
    cnpj: receipt.taxId,
    merchantName: lookupName,
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

  // 3. Se ainda não tiver parcelamento detectado, tenta extrair do texto limpo
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

  // 4. Score determinístico de confiança e origem da extração
  const conf = computeReceiptConfidence(receipt, cleanedText, natureResolvedByTitularity);
  receipt.confidence = conf.confidence;
  receipt.confidenceScore = conf.confidenceScore;
  receipt.fieldConfidence = conf.fieldConfidence;
  receipt.extractionSource = receipt.extractionSource ?? "local_deterministic";

  return receipt;
}

/**
 * Função orquestradora que limpa, analisa e extrai dados consolidados de qualquer comprovante.
 */
export function parseUniversalReceipt(
  rawText: string,
  isManualUpload = false,
  userContext?: ReceiptUserContext,
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
    if (invoice) return postProcessReceipt(invoice, cleaned, userContext);
  }

  // B. Cupons fiscais eletrônicos ao consumidor (DANFE NFC-e / SAT / ECF / PDV)
  if (isDanfeNfcReceipt(cleaned)) {
    const parsed = parseDanfeNfcReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned, userContext);
  }

  // C. Boletos bancários, títulos e tributos (DARF / GPS / Concessionárias)
  if (isBankSlipReceipt(cleaned)) {
    const parsed = parseBankSlipReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned, userContext);
  }

  // D. Comprovantes de transferências e pagamentos Pix
  if (isPixReceipt(cleaned)) {
    const parsed = parsePixReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned, userContext);
  }

  // E. Slips de maquininhas de cartão (POS / TEF)
  if (isCardSlipReceipt(cleaned) || extractTerminalAcquirer(cleaned)) {
    const parsed = parseCardSlipReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned, userContext);
  }

  // F. Transferências bancárias tradicionais (TED / DOC / Entre Contas)
  if (isWireTransferReceipt(cleaned)) {
    const parsed = parseWireTransferReceipt(cleaned);
    if (parsed) return postProcessReceipt(parsed, cleaned, userContext);
  }

  // G. Fallback semântico para recibos avulsos ou não-estruturados
  const generic = parseGenericReceipt(cleaned);
  if (generic) return postProcessReceipt(generic, cleaned, userContext);

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
