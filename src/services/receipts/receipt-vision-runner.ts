import type {
  CardDigitsMapping,
  MerchantLearningMemory,
  ParsedBankTransaction,
  ReceiptUserContext,
  ResolvedMerchantIdentity,
  UniversalReceiptData,
} from "@/domain/notifications";
import { getReceiptKindLabel } from "@/domain/notifications/universal-receipt-parser";
import { resolveBestMatchingCard } from "@/domain/notifications/card-resolution";
import { resolveMerchantIdentity } from "@/domain/notifications/merchant-resolver";
import { formatReceiptItemsObservation } from "@/domain/notifications/receipt-item-extractor";
import {
  convertAiReceiptToUniversalData,
  extractSingleReceiptWithAi,
  type AiCategoryOptionInput,
  type AiSingleReceiptClientResult,
} from "@/services/ai-assistant";
import {
  getBankCardMapping,
  getCardDigitsMapping,
  getMerchantLearningMemory,
} from "@/services/merchant-learning";
import type { CreditCard } from "@/types/schema";
import type { AiFallbackReason } from "../../../supabase/functions/_shared/ai-schemas";
import { saveLocalReceiptCache } from "./receipt-cache";

export interface ResolveReceiptOptions {
  /** Flag indicando anexo manual explícito (aumenta tolerância de parsing). */
  isManualAttachment?: boolean;
  /** Cartões de crédito ativos para auto-vínculo. */
  cards?: CreditCard[];
  /** Contexto opcional do titular autenticado (profiles.name / CPF). */
  userContext?: ReceiptUserContext;
  /** Identificador explícito do usuário ativo para isolamento de cache local. */
  userId?: string | null;
  /** Memória de aprendizado de estabelecimentos (padrão: lida do serviço). */
  userMemory?: MerchantLearningMemory;
  /** Mapeamento de 4 dígitos finais -> cardId. */
  cardDigitsMapping?: CardDigitsMapping;
  /** Mapeamento de pacote/banco -> cardId. */
  bankCardMapping?: Record<string, string>;
  /** Nome de banco padrão caso não identificado. */
  defaultBankName?: string;
  /** Categorias reais do usuário enviadas à IA para dedução direta por itens/produtos. */
  categories?: readonly AiCategoryOptionInput[];
}

export interface ResolvedReceiptResult {
  parsed: ParsedBankTransaction;
  identity: ResolvedMerchantIdentity;
  matchedCard?: CreditCard;
  kindLabel: string;
  installmentCount?: number;
}

function isUniversalReceipt(
  data: ParsedBankTransaction | UniversalReceiptData,
): data is UniversalReceiptData {
  return "rawCleanText" in data;
}

/**
 * Enriquece um comprovante já extraído (`UniversalReceiptData` ou `ParsedBankTransaction`)
 * com resolução de identidade de estabelecimento (3 camadas) e vínculo de cartão (5+ camadas).
 */
export function resolveReceiptTransaction(
  rawParsed: ParsedBankTransaction | UniversalReceiptData,
  options?: ResolveReceiptOptions,
): ResolvedReceiptResult {
  const userMemory = options?.userMemory ?? getMerchantLearningMemory();
  const cardDigitsMapping = options?.cardDigitsMapping ?? getCardDigitsMapping();
  const bankCardMapping = options?.bankCardMapping ?? getBankCardMapping();

  const universal: UniversalReceiptData | null = isUniversalReceipt(rawParsed) ? rawParsed : null;
  const legacy: ParsedBankTransaction | null = universal
    ? null
    : (rawParsed as ParsedBankTransaction);

  const merchantSource = universal
    ? universal.nature === "income" && universal.payerOrSource
      ? universal.payerOrSource
      : universal.merchantOrBeneficiary || universal.description
    : legacy?.merchant || legacy?.description || "";

  const pixKey =
    "pixKey" in rawParsed && typeof rawParsed.pixKey === "string"
      ? rawParsed.pixKey
      : undefined;
  const rawText = universal ? universal.rawCleanText : legacy?.rawText;

  const identity = resolveMerchantIdentity({
    merchantOrDescription: merchantSource,
    pixKey,
    rawText,
    taxId: rawParsed.taxId,
    userMemory,
  });

  const existingCardId = legacy?.cardId;
  const issuerBank =
    "issuerBank" in rawParsed && typeof rawParsed.issuerBank === "string"
      ? rawParsed.issuerBank
      : undefined;
  const packageName =
    "packageName" in rawParsed && typeof rawParsed.packageName === "string"
      ? rawParsed.packageName
      : undefined;

  const matchedCard = resolveBestMatchingCard(options?.cards, {
    cardId: existingCardId || identity.preferredCardId,
    cardLastDigits: rawParsed.cardLastDigits,
    bankName: rawParsed.bankName,
    issuerBank: issuerBank || rawParsed.bankName,
    packageName,
    cardBrand: rawParsed.cardBrand,
    cardDigitsMapping,
    bankCardMapping,
    preferredCardId: identity.preferredCardId,
  });

  const installmentCount = universal
    ? universal.installments?.count
    : legacy?.installments;

  if (universal) {
    const effectivePaymentMethod =
      universal.paymentMethod ||
      identity.preferredPaymentMethod ||
      (matchedCard ? "credit_card" : "pix");

    const itemsNotes =
      universal.items && universal.items.length > 0
        ? formatReceiptItemsObservation(universal.items)
        : undefined;

    const resolvedNature =
      universal.fieldConfidence?.nature === "high" || universal.isSameTitularity
        ? universal.nature === "income"
          ? "income"
          : "expense"
        : identity.defaultNature || (universal.nature === "income" ? "income" : "expense");

    const parsed: ParsedBankTransaction = {
      id: universal.id,
      bankName: universal.bankName || universal.issuerBank || matchedCard?.name || options?.defaultBankName || "Banco",
      nature: resolvedNature,
      type: resolvedNature === "income" ? "income" : "expense",
      amountCents: universal.amountCents,
      description: identity.friendlyName || universal.description,
      date: universal.date,
      dueDate: universal.dueDate,
      documentStatus: universal.documentStatus,
      isScheduled: universal.isScheduled,
      scheduledFor: universal.scheduledFor,
      paymentMethod: effectivePaymentMethod,
      cardId: matchedCard?.id,
      cardLastDigits: universal.cardLastDigits,
      cardBrand: universal.cardBrand || matchedCard?.brand || undefined,
      merchant: identity.friendlyName,
      categorySlug: identity.categorySlug,
      receiptKind: universal.kind,
      rawText: universal.rawCleanText,
      timestamp: Date.now(),
      installments: universal.installments?.count,
      currentInstallment: universal.installments?.currentInstallment,
      installmentAmountCents: universal.installments?.installmentAmountCents,
      issuerBank: universal.issuerBank,
      taxId: universal.taxId,
      pixKey: pixKey || identity.pixKey,
      payerName: universal.payerOrSource,
      recipientName: universal.merchantOrBeneficiary,
      notes: itemsNotes,
      source: "receipt",
      confidence: universal.confidence,
      confidenceScore: universal.confidenceScore,
      fieldConfidence: universal.fieldConfidence,
      isSameTitularity: universal.isSameTitularity,
      extractionSource: universal.extractionSource ?? "local_deterministic",
      aiCategoryId: universal.aiCategoryId,
      originalCurrency: universal.originalCurrency,
      originalAmountCents: universal.originalAmountCents,
      semanticTags: universal.semanticTags,
    };

    return {
      parsed,
      identity,
      matchedCard,
      installmentCount,
      kindLabel: getReceiptKindLabel(parsed.receiptKind, installmentCount),
    };
  }

  const legacyTx = rawParsed as ParsedBankTransaction;
  const resolvedNature =
    identity.defaultNature || (legacyTx.nature === "income" || legacyTx.type === "income" ? "income" : "expense");

  const parsed: ParsedBankTransaction = {
    ...legacyTx,
    nature: resolvedNature,
    type: resolvedNature === "income" ? "income" : "expense",
    description: identity.friendlyName || legacyTx.description,
    merchant: identity.friendlyName || legacyTx.merchant,
    categorySlug: identity.categorySlug || legacyTx.categorySlug,
    cardId: matchedCard?.id || legacyTx.cardId,
    cardBrand: matchedCard?.brand || legacyTx.cardBrand,
    pixKey: pixKey || identity.pixKey,
    extractionSource: legacyTx.extractionSource ?? "local_deterministic",
  };

  return {
    parsed,
    identity,
    matchedCard,
    installmentCount,
    kindLabel: getReceiptKindLabel(parsed.receiptKind, installmentCount),
  };
}

export function canAttemptAiFallback(
  sha256: string | null,
  options?: {
    aiFallbackEnabled?: boolean;
    isReadOnlyMode?: boolean;
    signal?: AbortSignal;
  },
): sha256 is string {
  if (!sha256) return false;
  if (options?.signal?.aborted) return false;
  if (options?.aiFallbackEnabled === false) return false;
  if (options?.isReadOnlyMode === true) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return true;
}

export function buildAiFailureFallbackMessage(params: {
  reason: AiFallbackReason;
  quotaResetAt?: string;
  defaultMessage: string;
  context: "empty_text" | "unrecognized";
}): string {
  // SilentQuotaShield: nunca exibir mensagens de cota/limite esgotado ao usuario;
  // retornar orientacao neutra de produto para arquivo digital ou preenchimento manual.
  if (params.reason === "quota_exceeded") {
    return params.defaultMessage;
  }

  if (params.reason === "timeout" || params.reason === "upstream_unavailable") {
    return "A leitura automática do arquivo está temporariamente instável. Tente novamente em instantes ou preencha os campos manualmente.";
  }

  if (params.context === "empty_text") {
    if (params.reason === "offline") {
      return "Sem conexão com a internet para leitura do arquivo. Conecte-se e tente novamente ou preencha os campos manualmente.";
    }
    if (params.reason === "read_only") {
      return "Envie um PDF digital emitido pelo banco ou preencha os campos manualmente.";
    }
  }

  return params.defaultMessage;
}

function buildAiResolvedResult(
  aiResult: Extract<AiSingleReceiptClientResult, { ok: true }>,
  options?: ResolveReceiptOptions,
  fallbackDateIso?: string,
): ResolvedReceiptResult {
  const universalAi = convertAiReceiptToUniversalData(
    aiResult.data,
    aiResult.source,
    fallbackDateIso,
  );
  return resolveReceiptTransaction(universalAi, options);
}

export async function tryAiReceiptFallback(params: {
  sha256: string;
  trimmedText?: string;
  isRasterImage: boolean;
  isPdf: boolean;
  preparedFile: File;
  rawFile: File;
  shouldUseLocalCache: boolean;
  preferVision?: boolean;
  fallbackDateIso?: string;
  signal?: AbortSignal;
  renderPdfVisionBlob?: () => Promise<Blob | null>;
  options?: ResolveReceiptOptions & {
    isReadOnlyMode?: boolean;
    aiFallbackEnabled?: boolean;
  };
}): Promise<
  | { ok: true; resolved: ResolvedReceiptResult }
  | { ok: false; reason: AiFallbackReason; quotaResetAt?: string }
> {
  if (params.signal?.aborted) {
    return { ok: false, reason: "upstream_unavailable" };
  }

  let preRenderedPdfBlob: Blob | undefined;
  if (!params.isRasterImage && params.isPdf && params.preferVision && params.renderPdfVisionBlob) {
    try {
      const rendered = await params.renderPdfVisionBlob();
      if (rendered) preRenderedPdfBlob = rendered;
    } catch {
      preRenderedPdfBlob = undefined;
    }
  }

  if (params.signal?.aborted) {
    return { ok: false, reason: "upstream_unavailable" };
  }

  const aiRes = await extractSingleReceiptWithAi({
    sha256: params.sha256,
    text: params.trimmedText,
    imageBlob: params.isRasterImage
      ? params.preparedFile
      : preRenderedPdfBlob,
    pdfFile: params.isPdf && !preRenderedPdfBlob ? params.rawFile : undefined,
    preferVision: params.preferVision,
    userFullName: params.options?.userContext?.userFullName,
    userId: params.options?.userId,
    isReadOnlyMode: params.options?.isReadOnlyMode,
    featureEnabled: params.options?.aiFallbackEnabled,
    categories: params.options?.categories,
    signal: params.signal,
  });

  if (!aiRes.ok) {
    return { ok: false, reason: aiRes.reason, quotaResetAt: aiRes.quotaResetAt };
  }

  const resolvedFromAi = buildAiResolvedResult(aiRes, params.options, params.fallbackDateIso);
  if (params.shouldUseLocalCache) {
    saveLocalReceiptCache(
      params.sha256,
      resolvedFromAi,
      params.options?.userContext,
      params.options?.userId,
    );
  }
  return { ok: true, resolved: resolvedFromAi };
}
