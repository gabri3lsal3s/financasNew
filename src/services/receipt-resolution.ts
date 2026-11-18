/**
 * Serviço unificado de resolução, OCR, compressão e hash SHA-256 de comprovantes.
 *
 * Consolida os pipelines anteriormente duplicados em `AttachReceiptDialog`,
 * `LaunchWizard` e `ShareTargetPage` em um ponto único testável e tipado.
 */

import {
  formatReceiptItemsObservation,
  getReceiptKindLabel,
  parseBankNotification,
  parsePixShareText,
  parseUniversalReceipt,
  resolveBestMatchingCard,
  resolveMerchantIdentity,
  type CardDigitsMapping,
  type MerchantLearningMemory,
  type ParsedBankTransaction,
  type ResolvedMerchantIdentity,
  type UniversalReceiptData,
} from "@/domain/notifications";
import {
  getBankCardMapping,
  getCardDigitsMapping,
  getMerchantLearningMemory,
} from "@/services/merchant-learning";
import {
  extractReceiptTextFromFile,
  MAX_RECEIPT_FILE_SIZE_BYTES,
  processPixShare,
} from "@/services/native";
import type { CreditCard } from "@/types/schema";

const DEFAULT_COMPRESS_MAX_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_COMPRESS_MAX_DIMENSION = 2000;
const DEFAULT_COMPRESS_QUALITY = 0.85;

export type ReceiptScanStatus =
  | "success"
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
  /** Se true, calcula checksum SHA-256 do arquivo (padrão: true). */
  computeHash?: boolean;
  /** Limite máximo de tamanho permitido (padrão: 15 MB). */
  maxSizeBytes?: number;
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
  errorMessage?: string;
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
  if (typeof crypto === "undefined" || !crypto.subtle?.digest) {
    return null;
  }

  try {
    const buffer = await readBlobAsArrayBuffer(file);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
    ? universal.merchantOrBeneficiary || universal.description
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
      identity.defaultNature || (universal.nature === "income" ? "income" : "expense");

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

  const universal = parseUniversalReceipt(trimmed, Boolean(options?.isManualAttachment));
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

/**
 * Pipeline único de resolução e varredura de arquivo de comprovante (PDF ou imagem):
 * 1. Valida tamanho (15 MB padrão) e bloqueia SVG;
 * 2. Comprime imagens grandes quando aplicável;
 * 3. Calcula hash criptográfico SHA-256;
 * 4. Extrai texto via OCR (ML Kit nativo, unpdf ou Tesseract Web);
 * 5. Interpreta o comprovante e resolve identidade de estabelecimento e cartão.
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

  const shouldCompress = options?.compressImage !== false;
  const preparedFile = shouldCompress
    ? await compressReceiptImageIfNeeded(file, options?.compression)
    : file;

  const shouldComputeHash = options?.computeHash !== false;
  const sha256 = shouldComputeHash ? await computeFileSha256(preparedFile) : null;

  try {
    const extractedRaw = await extractReceiptTextFromFile(preparedFile);
    const trimmed = extractedRaw.trim();

    if (!trimmed) {
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

    const resolved = resolveReceiptFromText(trimmed, {
      ...options,
      isManualAttachment: options?.isManualAttachment ?? true,
    });

    if (!resolved) {
      return {
        status: "unrecognized",
        ok: false,
        file: preparedFile,
        sha256,
        extractedText: trimmed,
        parsed: null,
        identity: null,
        errorMessage:
          "Não foi possível identificar informações financeiras válidas (valor, data e destinatário) no comprovante. Verifique o arquivo e tente novamente.",
      };
    }

    return {
      status: "success",
      ok: true,
      file: preparedFile,
      sha256,
      extractedText: trimmed,
      parsed: resolved.parsed,
      identity: resolved.identity,
      matchedCard: resolved.matchedCard,
      kindLabel: resolved.kindLabel,
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
