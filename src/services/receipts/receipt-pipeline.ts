/**
 * Pipeline unificado de resolução, OCR, QR Code, leitura espacial de PDF,
 * fallback Vision cancelável e cache local LGPD por SHA-256.
 */

import { detectDocumentMultiplicity, type DocumentMultiplicity } from "@/domain/notifications/document-multiplicity";
import { parseBankNotification, parsePixShareText, type ParsedBankTransaction } from "@/domain/notifications/bank-parser";
import { parseUniversalReceipt } from "@/domain/notifications/universal-receipt-parser";
import { resolveBestMatchingCard } from "@/domain/notifications/card-resolution";
import {
  getBankCardMapping,
  getCardDigitsMapping,
} from "@/services/merchant-learning";
import { extractReceiptTextFromFile, MAX_RECEIPT_FILE_SIZE_BYTES } from "@/services/native/receipt-extractor";
import { isNativePlatform } from "@/services/native/platform";
import { processPixShare } from "@/services/native/bank-listener";
import {
  isPdfPasswordProtectedError,
  PdfPasswordProtectedError,
} from "@/services/native/receipt-extractor";
import type { CreditCard } from "@/types/schema";
import type { AiFallbackReason } from "../../../supabase/functions/_shared/ai-schemas";
import {
  computeFileSha256,
  lookupLocalReceiptCache,
  saveLocalReceiptCache,
} from "./receipt-cache";
import {
  compressReceiptImageIfNeeded,
  detectReceiptFileFormat,
  loadReceiptPdfWithSession,
  type CompressReceiptImageOptions,
  type LoadedReceiptPdfSession,
} from "./receipt-file-loader";
import { tryDecodeReceiptQrFromBlob } from "./receipt-qr-decoder";
import {
  buildAiFailureFallbackMessage,
  canAttemptAiFallback,
  resolveReceiptTransaction,
  tryAiReceiptFallback,
  type ResolvedReceiptResult,
  type ResolveReceiptOptions,
} from "./receipt-vision-runner";

export const AI_FALLBACK_CONFIDENCE_THRESHOLD = 0.85;

export type ReceiptScanStatus =
  | "success"
  | "multi_statement"
  | "file_too_large"
  | "unsupported_format"
  | "password_required"
  | "cancelled"
  | "empty_text"
  | "unrecognized"
  | "error";

export type ReceiptScanProgressStage =
  | "cache"
  | "qr"
  | "reading_pdf"
  | "ocr"
  | "parsing"
  | "ai_vision";

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
  /**
   * Acelera imagens na Web/PWA enviando direto para IA Vision em 1 passagem (evitando download/CPU de Tesseract),
   * degradando para o pipeline local em caso de falha/cota. Em PDFs, mantém texto digital local e pula OCR lento.
   */
  preferFastAiVisionForWebImages?: boolean;
  /** Senha opcional fornecida pelo usuário para desbloqueio de PDF protegido. */
  pdfPassword?: string;
  /** Signal para cancelamento real da leitura/Vision. */
  signal?: AbortSignal;
  /** Callback opcional de progresso calmo para feedback na UI. */
  onProgress?: (stage: ReceiptScanProgressStage, message: string) => void;
}

export interface ScanReceiptFileResult {
  status: ReceiptScanStatus;
  ok: boolean;
  file: File;
  sha256: string | null;
  extractedText: string;
  parsed: ParsedBankTransaction | null;
  identity: ResolvedReceiptResult["identity"] | null;
  matchedCard?: CreditCard;
  kindLabel?: string;
  multiplicity?: DocumentMultiplicity;
  aiFallbackReason?: AiFallbackReason;
  quotaResetAt?: string;
  errorMessage?: string;
}

/**
 * Converte e resolve texto bruto de comprovante, boleto ou notificação bancária
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

function buildCancelledResult(file: File, sha256: string | null): ScanReceiptFileResult {
  return {
    status: "cancelled",
    ok: false,
    file,
    sha256,
    extractedText: "",
    parsed: null,
    identity: null,
  };
}

/**
 * Pipeline único de resolução e varredura de arquivo de comprovante, boleto ou cupom fiscal (PDF ou imagem):
 * 1. Valida tamanho (15 MB padrão), bloqueia SVG/arquivos compactados e identifica tipo via magic bytes;
 * 2. Calcula hash criptográfico SHA-256 sobre o arquivo ORIGINAL bruto (antes do canvas);
 * 3. Consulta cache local LGPD por SHA-256 (0 OCR / 0 compressão / 0 IA em acerto);
 * 4. Tenta decodificador local instantâneo de QR Code (Pix / NFC-e) em imagens;
 * 5. Para PDFs reais, abre 1 única vez via `PdfDocumentSession` (propagando senha + leitura espacial X/Y);
 * 6. Detecta documentos multi-lançamento (extratos/faturas) -> status `multi_statement`;
 * 7. Interpreta com contexto do titular + linha digitável e aciona fallback Vision cancelável quando necessário.
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

  if (options?.signal?.aborted) {
    return buildCancelledResult(file, null);
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

  const format = await detectReceiptFileFormat(file);
  if (format.kind === "unsupported_svg" || format.kind === "unsupported_archive") {
    return {
      status: "unsupported_format",
      ok: false,
      file,
      sha256: null,
      extractedText: "",
      parsed: null,
      identity: null,
      errorMessage:
        format.kind === "unsupported_svg"
          ? "Arquivos SVG não são suportados. Envie uma imagem (JPG, PNG) ou PDF."
          : "Formato compactado não suportado. Envie uma imagem (JPG, PNG) ou PDF.",
    };
  }

  if (format.kind === "empty_file") {
    return {
      status: "empty_text",
      ok: false,
      file,
      sha256: null,
      extractedText: "",
      parsed: null,
      identity: null,
      errorMessage: "O arquivo selecionado está vazio. Verifique o arquivo e tente novamente.",
    };
  }

  // Passo 1: SHA-256 calculado sempre sobre o arquivo bruto original antes de qualquer compressão em <canvas>
  const shouldComputeHash = options?.computeHash !== false;
  const sha256 = shouldComputeHash ? await computeFileSha256(file) : null;
  if (options?.signal?.aborted) {
    return buildCancelledResult(file, sha256);
  }

  const shouldUseLocalCache = Boolean(sha256 && options?.useLocalCache !== false);

  // Passo 2: Consulta cache local estruturado antes de comprimir ou acionar OCR
  if (shouldUseLocalCache && sha256) {
    options?.onProgress?.("cache", "Verificando leitura anterior...");
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

  const isPdf = format.kind === "pdf";
  const isRasterImage = format.isRasterImage;
  const runningNative = typeof isNativePlatform === "function" && isNativePlatform();
  const aiAllowed = canAttemptAiFallback(sha256, {
    aiFallbackEnabled: options?.aiFallbackEnabled,
    isReadOnlyMode: options?.isReadOnlyMode,
    signal: options?.signal,
  });

  // Passo 3: Tenta decodificar QR Code localmente (< 20ms, zero custo de IA) em imagens reais
  let qrMetadata: { taxId?: string; nfeAccessKey?: string; merchantOrBeneficiary?: string } | undefined;
  if (isRasterImage) {
    options?.onProgress?.("qr", "Verificando código QR ou barra...");
    const qrDecoded = await tryDecodeReceiptQrFromBlob(file);
    if (options?.signal?.aborted) {
      return buildCancelledResult(file, sha256);
    }
    if (qrDecoded?.directUniversal) {
      const resolvedQr = resolveReceiptTransaction(qrDecoded.directUniversal, options);
      if (shouldUseLocalCache && sha256) {
        saveLocalReceiptCache(sha256, resolvedQr, options?.userContext, options?.userId);
      }
      return {
        status: "success",
        ok: true,
        file,
        sha256,
        extractedText: qrDecoded.rawPayload,
        parsed: resolvedQr.parsed,
        identity: resolvedQr.identity,
        matchedCard: resolvedQr.matchedCard,
        kindLabel: resolvedQr.kindLabel,
        multiplicity: "single_receipt",
      };
    }
    qrMetadata = qrDecoded?.partialMetadata;
  }

  const shouldCompress = options?.compressImage !== false;
  const preparedFile = shouldCompress
    ? await compressReceiptImageIfNeeded(file, options?.compression)
    : file;

  if (options?.signal?.aborted) {
    return buildCancelledResult(preparedFile, sha256);
  }

  const useFastWebVision = Boolean(
    options?.preferFastAiVisionForWebImages &&
      isRasterImage &&
      !runningNative &&
      aiAllowed,
  );

  let fastAiFailure: { reason: AiFallbackReason; quotaResetAt?: string } | null = null;

  // Caminho rápido para imagens na Web (após compressão inteligente e tentativa de QR local)
  if (useFastWebVision && sha256) {
    options?.onProgress?.("ai_vision", "Lendo comprovante ou cupom...");
    const fastAiAttempt = await tryAiReceiptFallback({
      sha256,
      isRasterImage: true,
      isPdf: false,
      preparedFile,
      rawFile: file,
      shouldUseLocalCache,
      preferVision: true,
      signal: options?.signal,
      options,
    });
    if (options?.signal?.aborted) {
      return buildCancelledResult(preparedFile, sha256);
    }
    if (fastAiAttempt.ok) {
      return {
        status: "success",
        ok: true,
        file: preparedFile,
        sha256,
        extractedText: "",
        parsed: fastAiAttempt.resolved.parsed,
        identity: fastAiAttempt.resolved.identity,
        matchedCard: fastAiAttempt.resolved.matchedCard,
        kindLabel: fastAiAttempt.resolved.kindLabel,
        multiplicity: "single_receipt",
      };
    }
    fastAiFailure = { reason: fastAiAttempt.reason, quotaResetAt: fastAiAttempt.quotaResetAt };
  }

  const shouldSkipPdfWebOcr = Boolean(
    options?.preferFastAiVisionForWebImages && isPdf && !runningNative && aiAllowed,
  );

  let pdfSessionWrapper: LoadedReceiptPdfSession | null = null;

  try {
    let extractedRaw = "";

    // Passo 4: Para PDFs binários reais, usa PdfDocumentSession (abertura única, senha e leitura espacial X/Y)
    if (isPdf && format.hasPdfHeader) {
      options?.onProgress?.("reading_pdf", "Lendo documento PDF...");
      pdfSessionWrapper = await loadReceiptPdfWithSession(file, sha256, options?.pdfPassword);
      if (options?.signal?.aborted) {
        return buildCancelledResult(preparedFile, sha256);
      }
      if (pdfSessionWrapper && pdfSessionWrapper.extractedText.length >= 40) {
        extractedRaw = pdfSessionWrapper.extractedText;
      } else {
        options?.onProgress?.("ocr", "Extraindo texto do comprovante...");
        extractedRaw = shouldSkipPdfWebOcr
          ? pdfSessionWrapper?.extractedText ?? ""
          : await extractReceiptTextFromFile(preparedFile, {
              skipWebImageOcr: shouldSkipPdfWebOcr,
            });
      }
    } else {
      options?.onProgress?.("ocr", "Extraindo texto do comprovante...");
      extractedRaw = shouldSkipPdfWebOcr
        ? await extractReceiptTextFromFile(preparedFile, { skipWebImageOcr: true })
        : await extractReceiptTextFromFile(preparedFile);
    }

    if (options?.signal?.aborted) {
      return buildCancelledResult(preparedFile, sha256);
    }

    const trimmed = extractedRaw.trim();
    const renderPdfVisionBlob = pdfSessionWrapper?.renderPrimaryVisionBlob;

    if (!trimmed) {
      const emptyFallbackAttempt = fastAiFailure
        ? ({ ok: false, ...fastAiFailure } as const)
        : canAttemptAiFallback(sha256, {
              aiFallbackEnabled: options?.aiFallbackEnabled,
              isReadOnlyMode: options?.isReadOnlyMode,
              signal: options?.signal,
            }) &&
            (isRasterImage || isPdf)
          ? (options?.onProgress?.("ai_vision", "Interpretando imagem do documento..."),
            await tryAiReceiptFallback({
              sha256,
              isRasterImage,
              isPdf,
              preparedFile,
              rawFile: file,
              shouldUseLocalCache,
              preferVision: isRasterImage || isPdf,
              signal: options?.signal,
              renderPdfVisionBlob,
              options,
            }))
          : null;

      if (options?.signal?.aborted) {
        return buildCancelledResult(preparedFile, sha256);
      }

      if (emptyFallbackAttempt) {
        if (emptyFallbackAttempt.ok) {
          return {
            status: "success",
            ok: true,
            file: preparedFile,
            sha256,
            extractedText: "",
            parsed: emptyFallbackAttempt.resolved.parsed,
            identity: emptyFallbackAttempt.resolved.identity,
            matchedCard: emptyFallbackAttempt.resolved.matchedCard,
            kindLabel: emptyFallbackAttempt.resolved.kindLabel,
            multiplicity: "single_receipt",
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
          aiFallbackReason: emptyFallbackAttempt.reason,
          quotaResetAt: emptyFallbackAttempt.quotaResetAt,
          errorMessage: buildAiFailureFallbackMessage({
            reason: emptyFallbackAttempt.reason,
            quotaResetAt: emptyFallbackAttempt.quotaResetAt,
            defaultMessage:
              "Não foi possível ler o texto deste arquivo. Certifique-se de que o comprovante esteja nítido ou seja um PDF digital emitido pelo banco.",
            context: "empty_text",
          }),
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

    options?.onProgress?.("parsing", "Identificando valores, datas e beneficiário...");
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

    const enrichedText =
      qrMetadata?.taxId && !trimmed.includes(qrMetadata.taxId)
        ? `${trimmed}\nCNPJ: ${qrMetadata.taxId}`
        : trimmed;

    const resolved = resolveReceiptFromText(enrichedText, {
      ...options,
      isManualAttachment: options?.isManualAttachment ?? true,
    });

    if (!resolved) {
      const unrecognizedAttempt = fastAiFailure
        ? ({ ok: false, ...fastAiFailure } as const)
        : canAttemptAiFallback(sha256, {
              aiFallbackEnabled: options?.aiFallbackEnabled,
              isReadOnlyMode: options?.isReadOnlyMode,
              signal: options?.signal,
            })
          ? (options?.onProgress?.("ai_vision", "Refinando leitura do documento..."),
            await tryAiReceiptFallback({
              sha256,
              trimmedText: enrichedText,
              isRasterImage,
              isPdf,
              preparedFile,
              rawFile: file,
              shouldUseLocalCache,
              preferVision: isRasterImage || isPdf,
              signal: options?.signal,
              renderPdfVisionBlob,
              options,
            }))
          : null;

      if (options?.signal?.aborted) {
        return buildCancelledResult(preparedFile, sha256);
      }

      if (unrecognizedAttempt) {
        if (unrecognizedAttempt.ok) {
          return {
            status: "success",
            ok: true,
            file: preparedFile,
            sha256,
            extractedText: trimmed,
            parsed: unrecognizedAttempt.resolved.parsed,
            identity: unrecognizedAttempt.resolved.identity,
            matchedCard: unrecognizedAttempt.resolved.matchedCard,
            kindLabel: unrecognizedAttempt.resolved.kindLabel,
            multiplicity,
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
          aiFallbackReason: unrecognizedAttempt.reason,
          quotaResetAt: unrecognizedAttempt.quotaResetAt,
          errorMessage: buildAiFailureFallbackMessage({
            reason: unrecognizedAttempt.reason,
            quotaResetAt: unrecognizedAttempt.quotaResetAt,
            defaultMessage:
              "Não foi possível identificar informações financeiras válidas (valor, data e destinatário) no comprovante. Verifique o arquivo e tente novamente.",
            context: "unrecognized",
          }),
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
      !fastAiFailure &&
      localConfidenceScore < AI_FALLBACK_CONFIDENCE_THRESHOLD &&
      canAttemptAiFallback(sha256, {
        aiFallbackEnabled: options?.aiFallbackEnabled,
        isReadOnlyMode: options?.isReadOnlyMode,
        signal: options?.signal,
      })
    ) {
      options?.onProgress?.("ai_vision", "Validando detalhes do comprovante...");
      const aiAttempt = await tryAiReceiptFallback({
        sha256,
        trimmedText: enrichedText,
        isRasterImage,
        isPdf,
        preparedFile,
        rawFile: file,
        shouldUseLocalCache: false,
        preferVision: isRasterImage || isPdf,
        fallbackDateIso: resolved.parsed.date,
        signal: options?.signal,
        renderPdfVisionBlob,
        options,
      });
      if (options?.signal?.aborted) {
        return buildCancelledResult(preparedFile, sha256);
      }
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
  } catch (err: unknown) {
    if (err instanceof PdfPasswordProtectedError || isPdfPasswordProtectedError(err)) {
      return {
        status: "password_required",
        ok: false,
        file: preparedFile,
        sha256,
        extractedText: "",
        parsed: null,
        identity: null,
        errorMessage: options?.pdfPassword
          ? "Senha incorreta para este arquivo PDF. Tente novamente."
          : "Este arquivo PDF está protegido por senha. Digite a senha para continuar.",
      };
    }
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
  } finally {
    if (pdfSessionWrapper) {
      await pdfSessionWrapper.dispose();
    }
  }
}
