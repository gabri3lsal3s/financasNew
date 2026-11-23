/**
 * Serviço unificado de resolução, OCR, compressão e hash SHA-256 de comprovantes.
 *
 * Consolida os pipelines de extração e parsing determinístico, com cache local LGPD
 * por SHA-256 sobre o arquivo bruto (sem armazenar imagem ou texto bruto).
 */

import {
  detectDocumentMultiplicity,
  formatReceiptItemsObservation,
  getReceiptKindLabel,
  parseBankNotification,
  parsePixShareText,
  parseUniversalReceipt,
  resolveBestMatchingCard,
  resolveMerchantIdentity,
  type CardDigitsMapping,
  type DocumentMultiplicity,
  type MerchantLearningMemory,
  type ParsedBankTransaction,
  type ReceiptUserContext,
  type ResolvedMerchantIdentity,
  type UniversalReceiptData,
} from "@/domain/notifications";
import {
  getBankCardMapping,
  getCardDigitsMapping,
  getMerchantLearningMemory,
} from "@/services/merchant-learning";
import {
  convertAiReceiptToUniversalData,
  extractSingleReceiptWithAi,
  formatAiQuotaResetHint,
  type AiSingleReceiptClientResult,
} from "@/services/ai-assistant";
import { computeSha256Hex } from "@/services/sha256-fallback";
import {
  extractReceiptTextFromFile,
  MAX_RECEIPT_FILE_SIZE_BYTES,
  processPixShare,
} from "@/services/native";
import {
  getUserStorageItem,
  removeUserStorageItem,
  setUserStorageItem,
} from "@/services/user-storage";
import type { CreditCard } from "@/types/schema";
import type { AiFallbackReason } from "../../supabase/functions/_shared/ai-schemas";

export const AI_FALLBACK_CONFIDENCE_THRESHOLD = 0.85;

const DEFAULT_COMPRESS_MAX_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_COMPRESS_MAX_DIMENSION = 2000;
const DEFAULT_COMPRESS_QUALITY = 0.85;

const RECEIPT_SCAN_CACHE_STORAGE_KEY = "receipt_scan_cache_v1";
const RECEIPT_SCAN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const RECEIPT_SCAN_CACHE_MAX_ENTRIES = 50;

export type ReceiptScanStatus =
  | "success"
  | "multi_statement"
  | "file_too_large"
  | "unsupported_format"
  | "empty_text"
  | "unrecognized"
  | "error";

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
}

export interface CompressReceiptImageOptions {
  /** Tamanho máximo alvo em bytes antes de comprimir (padrão: 1,5 MB). */
  maxBytes?: number;
  /** Dimensão máxima de largura/altura em pixels (padrão: 2000px). */
  maxDimension?: number;
  /** Qualidade JPEG/WebP entre 0 e 1 (padrão: 0.85). */
  quality?: number;
}

export interface ResolveAndScanReceiptFileOptions extends ResolveReceiptOptions {
  /** Se true, tenta comprimir imagens raster grandes antes da extração/retorno (padrão: true). */
  compressImage?: boolean;
  /** Opções de compressão de imagem. */
  compression?: CompressReceiptImageOptions;
  /** Se true, calcula checksum SHA-256 do arquivo bruto original (padrão: true). */
  computeHash?: boolean;
  /** Se true, consulta e grava cache estruturado local por SHA-256 (padrão: true). */
  useLocalCache?: boolean;
  /** Limite máximo de tamanho permitido (padrão: 15 MB). */
  maxSizeBytes?: number;
  /** Permite fallback seletivo para Micro-IA quando confiança local < 0.85 ou OCR vazio (padrão: true). */
  aiFallbackEnabled?: boolean;
  /** Bloqueia chamada de rede à Micro-IA quando conta está em modo somente leitura. */
  isReadOnlyMode?: boolean;
}

export interface ResolvedReceiptResult {
  parsed: ParsedBankTransaction;
  identity: ResolvedMerchantIdentity;
  matchedCard?: CreditCard;
  kindLabel: string;
  installmentCount?: number;
}

export interface ScanReceiptFileResult {
  status: ReceiptScanStatus;
  ok: boolean;
  file: File;
  sha256: string | null;
  extractedText: string;
  parsed: ParsedBankTransaction | null;
  identity: ResolvedMerchantIdentity | null;
  matchedCard?: CreditCard;
  kindLabel?: string;
  multiplicity?: DocumentMultiplicity;
  aiFallbackReason?: AiFallbackReason;
  quotaResetAt?: string;
  errorMessage?: string;
}

interface CachedReceiptScanEntry {
  sha256: string;
  contextSig: string;
  cachedAt: number;
  parsed: Omit<ParsedBankTransaction, "rawText">;
  identity: ResolvedMerchantIdentity;
  kindLabel: string;
}

function buildContextSignature(userContext?: ReceiptUserContext): string {
  const normalizedName = (userContext?.userFullName ?? "").trim().toLowerCase();
  const hasCpf = Boolean(userContext?.userCpf && userContext.userCpf.trim().length > 0);
  if (!normalizedName && !hasCpf) return "";
  const input = `${normalizedName}|${hasCpf ? "cpf1" : "cpf0"}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function readLocalCacheEntries(userId?: string | null): CachedReceiptScanEntry[] {
  const raw = getUserStorageItem(RECEIPT_SCAN_CACHE_STORAGE_KEY, userId);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RECEIPT_SCAN_CACHE_TTL_MS;
    return parsed.filter(
      (item): item is CachedReceiptScanEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CachedReceiptScanEntry).sha256 === "string" &&
        typeof (item as CachedReceiptScanEntry).cachedAt === "number" &&
        (item as CachedReceiptScanEntry).cachedAt >= cutoff &&
        typeof (item as CachedReceiptScanEntry).parsed === "object" &&
        (item as CachedReceiptScanEntry).parsed !== null &&
        typeof (item as CachedReceiptScanEntry).identity === "object" &&
        (item as CachedReceiptScanEntry).identity !== null,
    );
  } catch {
    return [];
  }
}

function writeLocalCacheEntries(
  entries: CachedReceiptScanEntry[],
  userId?: string | null,
): void {
  const trimmed = [...entries]
    .sort((a, b) => b.cachedAt - a.cachedAt)
    .slice(0, RECEIPT_SCAN_CACHE_MAX_ENTRIES);
  setUserStorageItem(RECEIPT_SCAN_CACHE_STORAGE_KEY, JSON.stringify(trimmed), userId);
}

function lookupLocalReceiptCache(
  sha256: string,
  userContext?: ReceiptUserContext,
  userId?: string | null,
): CachedReceiptScanEntry | null {
  const contextSig = buildContextSignature(userContext);
  const validEntries = readLocalCacheEntries(userId);
  const match = validEntries.find(
    (entry) => entry.sha256 === sha256 && entry.contextSig === contextSig,
  );
  return match ?? null;
}

function saveLocalReceiptCache(
  sha256: string,
  resolved: ResolvedReceiptResult,
  userContext?: ReceiptUserContext,
  userId?: string | null,
): void {
  const contextSig = buildContextSignature(userContext);
  // Política LGPD: nunca persistir rawText nem conteúdo bruto de imagem no localStorage
  const parsedWithoutRawText = { ...resolved.parsed };
  delete (parsedWithoutRawText as { rawText?: string }).rawText;

  const nextEntry: CachedReceiptScanEntry = {
    sha256,
    contextSig,
    cachedAt: Date.now(),
    parsed: parsedWithoutRawText,
    identity: resolved.identity,
    kindLabel: resolved.kindLabel,
  };

  const existing = readLocalCacheEntries(userId).filter(
    (entry) => !(entry.sha256 === sha256 && entry.contextSig === contextSig),
  );
  existing.unshift(nextEntry);
  writeLocalCacheEntries(existing, userId);
}

/**
 * Remove entradas armazenadas em cache local para o usuário ativo (ou userId informado).
 */
export function clearLocalReceiptScanCache(userId?: string | null): void {
  removeUserStorageItem(RECEIPT_SCAN_CACHE_STORAGE_KEY, userId);
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível ler os bytes do arquivo."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha de leitura."));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Calcula o hash SHA-256 em hexadecimal minúsculo de um arquivo ou Blob.
 * Retorna `null` silenciosamente caso Web Crypto Subtle não esteja disponível.
 */
export async function computeFileSha256(file: Blob): Promise<string | null> {
  try {
    const buffer = await readBlobAsArrayBuffer(file);
    return await computeSha256Hex(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

/**
 * Comprime e redimensiona imagens raster grandes (JPG/PNG/WebP) via canvas no navegador.
 * PDFs, arquivos abaixo de `maxBytes` ou ambientes sem DOM/Canvas retornam o arquivo original intacto.
 */
export async function compressReceiptImageIfNeeded(
  file: File,
  options?: CompressReceiptImageOptions,
): Promise<File> {
  const maxBytes = options?.maxBytes ?? DEFAULT_COMPRESS_MAX_BYTES;
  const maxDimension = options?.maxDimension ?? DEFAULT_COMPRESS_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_COMPRESS_QUALITY;

  const isRasterImage =
    file.type.startsWith("image/") && file.type !== "image/svg+xml";

  if (
    !isRasterImage ||
    file.size <= maxBytes ||
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale =
      bitmap.width > maxDimension || bitmap.height > maxDimension
        ? maxDimension / Math.max(bitmap.width, bitmap.height)
        : 1;

    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), outputType, quality);
    });

    if (!compressedBlob || compressedBlob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const ext = outputType === "image/webp" ? "webp" : "jpg";
    return new File([compressedBlob], `${baseName}.${ext}`, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
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

/**
 * Converte e resolve texto bruto de comprovante ou notificação bancária
 * usando o orquestrador universal com fallbacks para parsers legados.
 */
export function resolveReceiptFromText(
  rawText: string,
  options?: ResolveReceiptOptions,
): ResolvedReceiptResult | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  const universal = parseUniversalReceipt(
    trimmed,
    Boolean(options?.isManualAttachment),
    options?.userContext,
  );
  if (universal) {
    return resolveReceiptTransaction(universal, options);
  }

  let legacyParsed: ParsedBankTransaction | null;
  try {
    legacyParsed = processPixShare(trimmed, { skipSuggestion: true });
  } catch {
    legacyParsed = null;
  }

  if (!legacyParsed) {
    legacyParsed =
      parsePixShareText(trimmed) ||
      parseBankNotification({ title: "", text: trimmed });
  }

  if (!legacyParsed) {
    return null;
  }

  return resolveReceiptTransaction(legacyParsed, options);
}

async function tryAiReceiptFallback(params: {
  sha256: string;
  trimmedText?: string;
  isRasterImage: boolean;
  isPdf: boolean;
  preparedFile: File;
  rawFile: File;
  shouldUseLocalCache: boolean;
  preferVision?: boolean;
  fallbackDateIso?: string;
  options?: ResolveAndScanReceiptFileOptions;
}): Promise<
  | { ok: true; resolved: ResolvedReceiptResult }
  | { ok: false; reason: AiFallbackReason; quotaResetAt?: string }
> {
  const aiRes = await extractSingleReceiptWithAi({
    sha256: params.sha256,
    text: params.trimmedText,
    imageBlob: params.isRasterImage ? params.preparedFile : undefined,
    pdfFile: params.isPdf ? params.rawFile : undefined,
    preferVision: params.preferVision,
    userFullName: params.options?.userContext?.userFullName,
    userId: params.options?.userId,
    isReadOnlyMode: params.options?.isReadOnlyMode,
    featureEnabled: params.options?.aiFallbackEnabled,
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

function canAttemptAiFallback(
  sha256: string | null,
  options?: ResolveAndScanReceiptFileOptions,
): sha256 is string {
  if (!sha256) return false;
  if (options?.aiFallbackEnabled === false) return false;
  if (options?.isReadOnlyMode === true) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return true;
}

function buildAiResolvedResult(
  aiResult: Extract<AiSingleReceiptClientResult, { ok: true }>,
  options?: ResolveAndScanReceiptFileOptions,
  fallbackDateIso?: string,
): ResolvedReceiptResult {
  const universalAi = convertAiReceiptToUniversalData(
    aiResult.data,
    aiResult.source,
    fallbackDateIso,
  );
  return resolveReceiptTransaction(universalAi, options);
}

/**
 * Pipeline único de resolução e varredura de arquivo de comprovante (PDF ou imagem):
 * 1. Valida tamanho (15 MB padrão) e bloqueia SVG;
 * 2. Calcula hash criptográfico SHA-256 sobre o arquivo ORIGINAL bruto (antes do canvas);
 * 3. Consulta cache local LGPD por SHA-256 (0 OCR / 0 compressão / 0 IA em acerto);
 * 4. Comprime imagens grandes quando aplicável e extrai texto (unpdf / ML Kit / Tesseract);
 * 5. Detecta documentos multi-lançamento (extratos/faturas) -> status `multi_statement`;
 * 6. Interpreta com contexto do titular e, se confiança < 0.85 ou OCR vazio/não reconhecido,
 *    aciona fallback seletivo de Micro-IA com degradação silenciosa garantida.
 */
export async function resolveAndScanReceiptFile(
  file: File,
  options?: ResolveAndScanReceiptFileOptions,
): Promise<ScanReceiptFileResult> {
  if (!file) {
    return {
      status: "error",
      ok: false,
      file,
      sha256: null,
      extractedText: "",
      parsed: null,
      identity: null,
      errorMessage: "Nenhum arquivo informado para leitura.",
    };
  }

  const maxSizeBytes = options?.maxSizeBytes ?? MAX_RECEIPT_FILE_SIZE_BYTES;
  if (file.size > maxSizeBytes) {
    return {
      status: "file_too_large",
      ok: false,
      file,
      sha256: null,
      extractedText: "",
      parsed: null,
      identity: null,
      errorMessage:
        "O arquivo selecionado excede o limite de 15 MB. Envie um comprovante mais leve.",
    };
  }

  const lowerName = file.name.toLowerCase();
  if (file.type === "image/svg+xml" || lowerName.endsWith(".svg")) {
    return {
      status: "unsupported_format",
      ok: false,
      file,
      sha256: null,
      extractedText: "",
      parsed: null,
      identity: null,
      errorMessage: "Arquivos SVG não são suportados. Envie uma imagem (JPG, PNG) ou PDF.",
    };
  }

  // Passo 1: SHA-256 calculado sempre sobre o arquivo bruto original antes de qualquer compressão em <canvas>
  const shouldComputeHash = options?.computeHash !== false;
  const sha256 = shouldComputeHash ? await computeFileSha256(file) : null;
  const shouldUseLocalCache = Boolean(sha256 && options?.useLocalCache !== false);

  // Passo 2: Consulta cache local estruturado antes de comprimir ou acionar OCR
  if (shouldUseLocalCache && sha256) {
    const cached = lookupLocalReceiptCache(sha256, options?.userContext, options?.userId);
    if (cached) {
      const cardDigitsMapping = options?.cardDigitsMapping ?? getCardDigitsMapping();
      const bankCardMapping = options?.bankCardMapping ?? getBankCardMapping();
      const matchedCard = resolveBestMatchingCard(options?.cards, {
        cardId: cached.parsed.cardId || cached.identity.preferredCardId,
        cardLastDigits: cached.parsed.cardLastDigits,
        bankName: cached.parsed.bankName,
        issuerBank: cached.parsed.issuerBank || cached.parsed.bankName,
        cardBrand: cached.parsed.cardBrand,
        cardDigitsMapping,
        bankCardMapping,
        preferredCardId: cached.identity.preferredCardId,
      });

      const hydratedParsed: ParsedBankTransaction = {
        ...cached.parsed,
        rawText: "",
        cardId: matchedCard?.id || cached.parsed.cardId,
        cardBrand: matchedCard?.brand || cached.parsed.cardBrand,
        extractionSource: "cache_local",
      };

      return {
        status: "success",
        ok: true,
        file,
        sha256,
        extractedText: "",
        parsed: hydratedParsed,
        identity: cached.identity,
        matchedCard,
        kindLabel: cached.kindLabel,
        multiplicity: "single_receipt",
      };
    }
  }

  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isRasterImage =
    (file.type.startsWith("image/") && file.type !== "image/svg+xml") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp");

  const shouldCompress = options?.compressImage !== false;
  const preparedFile = shouldCompress
    ? await compressReceiptImageIfNeeded(file, options?.compression)
    : file;

  try {
    const extractedRaw = await extractReceiptTextFromFile(preparedFile);
    const trimmed = extractedRaw.trim();

    if (!trimmed) {
      if (canAttemptAiFallback(sha256, options) && (isRasterImage || isPdf)) {
        const aiAttempt = await tryAiReceiptFallback({
          sha256,
          isRasterImage,
          isPdf,
          preparedFile,
          rawFile: file,
          shouldUseLocalCache,
          preferVision: isRasterImage || isPdf,
          options,
        });
        if (aiAttempt.ok) {
          return {
            status: "success",
            ok: true,
            file: preparedFile,
            sha256,
            extractedText: "",
            parsed: aiAttempt.resolved.parsed,
            identity: aiAttempt.resolved.identity,
            matchedCard: aiAttempt.resolved.matchedCard,
            kindLabel: aiAttempt.resolved.kindLabel,
            multiplicity: "single_receipt",
          };
        }

        const quotaMessage =
          aiAttempt.reason === "quota_exceeded"
            ? `Não foi possível ler o texto deste arquivo e sua cota de leitura assistida renova em ${formatAiQuotaResetHint(
                aiAttempt.quotaResetAt,
              )}. Preencha manualmente ou envie um PDF digital.`
            : undefined;

        return {
          status: "empty_text",
          ok: false,
          file: preparedFile,
          sha256,
          extractedText: "",
          parsed: null,
          identity: null,
          aiFallbackReason: aiAttempt.reason,
          quotaResetAt: aiAttempt.quotaResetAt,
          errorMessage:
            quotaMessage ??
            "Não foi possível ler o texto deste arquivo. Certifique-se de que o comprovante esteja nítido ou seja um PDF digital emitido pelo banco.",
        };
      }

      return {
        status: "empty_text",
        ok: false,
        file: preparedFile,
        sha256,
        extractedText: "",
        parsed: null,
        identity: null,
        errorMessage:
          "Não foi possível ler o texto deste arquivo. Certifique-se de que o comprovante esteja nítido ou seja um PDF digital emitido pelo banco.",
      };
    }

    const multiplicity = detectDocumentMultiplicity(trimmed);
    if (multiplicity === "multi_statement") {
      return {
        status: "multi_statement",
        ok: false,
        file: preparedFile,
        sha256,
        extractedText: trimmed,
        parsed: null,
        identity: null,
        multiplicity,
        errorMessage:
          "Este arquivo contém vários lançamentos de extrato ou fatura. Use a importação de fatura para importar transações em lote.",
      };
    }

    const resolved = resolveReceiptFromText(trimmed, {
      ...options,
      isManualAttachment: options?.isManualAttachment ?? true,
    });

    if (!resolved) {
      if (canAttemptAiFallback(sha256, options)) {
        const aiAttempt = await tryAiReceiptFallback({
          sha256,
          trimmedText: trimmed,
          isRasterImage,
          isPdf,
          preparedFile,
          rawFile: file,
          shouldUseLocalCache,
          preferVision: isRasterImage || isPdf,
          options,
        });
        if (aiAttempt.ok) {
          return {
            status: "success",
            ok: true,
            file: preparedFile,
            sha256,
            extractedText: trimmed,
            parsed: aiAttempt.resolved.parsed,
            identity: aiAttempt.resolved.identity,
            matchedCard: aiAttempt.resolved.matchedCard,
            kindLabel: aiAttempt.resolved.kindLabel,
            multiplicity,
          };
        }

        const quotaMessage =
          aiAttempt.reason === "quota_exceeded"
            ? `Não foi possível identificar os campos automaticamente e sua cota de leitura assistida renova em ${formatAiQuotaResetHint(
                aiAttempt.quotaResetAt,
              )}. Preencha os campos manualmente.`
            : undefined;

        return {
          status: "unrecognized",
          ok: false,
          file: preparedFile,
          sha256,
          extractedText: trimmed,
          parsed: null,
          identity: null,
          multiplicity,
          aiFallbackReason: aiAttempt.reason,
          quotaResetAt: aiAttempt.quotaResetAt,
          errorMessage:
            quotaMessage ??
            "Não foi possível identificar informações financeiras válidas (valor, data e destinatário) no comprovante. Verifique o arquivo e tente novamente.",
        };
      }

      return {
        status: "unrecognized",
        ok: false,
        file: preparedFile,
        sha256,
        extractedText: trimmed,
        parsed: null,
        identity: null,
        multiplicity,
        errorMessage:
          "Não foi possível identificar informações financeiras válidas (valor, data e destinatário) no comprovante. Verifique o arquivo e tente novamente.",
      };
    }

    let finalResolved = resolved;
    const localConfidenceScore = resolved.parsed.confidenceScore ?? 1;
    if (
      localConfidenceScore < AI_FALLBACK_CONFIDENCE_THRESHOLD &&
      canAttemptAiFallback(sha256, options)
    ) {
      const aiAttempt = await tryAiReceiptFallback({
        sha256,
        trimmedText: trimmed,
        isRasterImage,
        isPdf,
        preparedFile,
        rawFile: file,
        shouldUseLocalCache: false,
        preferVision: isRasterImage || isPdf,
        fallbackDateIso: resolved.parsed.date,
        options,
      });
      if (aiAttempt.ok) {
        const aiScore = aiAttempt.resolved.parsed.confidenceScore ?? 0;
        if (aiScore >= localConfidenceScore) {
          finalResolved = aiAttempt.resolved;
        }
      }
    }

    if (shouldUseLocalCache && sha256) {
      saveLocalReceiptCache(sha256, finalResolved, options?.userContext, options?.userId);
    }

    return {
      status: "success",
      ok: true,
      file: preparedFile,
      sha256,
      extractedText: trimmed,
      parsed: finalResolved.parsed,
      identity: finalResolved.identity,
      matchedCard: finalResolved.matchedCard,
      kindLabel: finalResolved.kindLabel,
      multiplicity,
    };
  } catch {
    return {
      status: "error",
      ok: false,
      file: preparedFile,
      sha256,
      extractedText: "",
      parsed: null,
      identity: null,
      errorMessage:
        "Ocorreu uma falha inesperada ao ler o arquivo do comprovante. Tente novamente.",
    };
  }
}
