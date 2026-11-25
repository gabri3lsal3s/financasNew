import {
  detectStatementMetadata,
  distillStatementBlueprintDraft,
  evaluateStatementExtractionQuality,
  type CardContextForMetadata,
  type ColumnMapping,
  type DetectedStatementMetadata,
  type RawExtractedEntry,
  type RawParsedRow,
  type StatementQualityGateResult,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { extractStatementPdfRowsWithAi } from "@/services/ai-assistant";
import type { AiStatementPdfRow } from "../../../../../supabase/functions/_shared/ai-schemas";
import { computeDeterministicSha256Hex } from "./statement-file-loader";
import {
  MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
  VISION_WAVE_SIZE,
  type DraftStatementBlueprintSession,
  type StatementAiStatusNotice,
  type StatementExtractionOrigin,
} from "./statement-import-types";
import {
  buildAiStatusNoticeFromReason,
  buildTransactionsFromAiRows,
  CANONICAL_AI_MAPPING,
  deduplicateConsecutiveVisionRows,
  hasAnyMergedAiMeta,
  mergeAiMetaFields,
  type MergedAiMeta,
} from "./statement-vision-helpers";

export {
  buildAiStatusNoticeFromReason,
  buildTransactionsFromAiRows,
  CANONICAL_AI_MAPPING,
  convertAiStatementRowsToRawParsedRows,
  deduplicateConsecutiveVisionRows,
  hasAnyMergedAiMeta,
  mergeAiMetaFields,
  selectCandidatePdfVisionPages,
  selectCandidatePdfVisionPagesWithOverflow,
  type MergedAiMeta,
} from "./statement-vision-helpers";

export interface VisionSlotInput {
  blob?: Blob | null;
  render?: () => Promise<Blob | null>;
  sha256?: string | null;
}

export interface RunVisionWavesParams {
  slots: readonly VisionSlotInput[];
  totalUploadedCount?: number;
  cardId: string;
  competenceMonth: string;
  card?: CardContextForMetadata | null;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
  signal?: AbortSignal;
  availableBatchCalls?: number | null;
  stopAfterWave1IfClosed?: boolean;
  officialTotalCents?: number | null;
  rawTextForLearning?: string;
  rawLinesForLearning?: readonly string[];
  fileName?: string;
}

export interface VisionWaveResult {
  transactions: StatementTransaction[];
  rawEntries: RawExtractedEntry[];
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  isOfx: boolean;
  usedAiFallback: boolean;
  extractionOrigin: StatementExtractionOrigin;
  qualityGate?: StatementQualityGateResult;
  aiStatusNotice?: StatementAiStatusNotice;
  draftBlueprint?: DraftStatementBlueprintSession;
  printedTotalCents: number | null;
  detectedMeta?: DetectedStatementMetadata;
  visionTruncationWarning?: string;
  wavesExecuted: number;
}

/**
 * Executa leitura visual (Vision) em até 2 ondas paralelas de 3 imagens/páginas
 * (`MAX_STATEMENT_VISION_PAGES_OR_IMAGES = 6`, `VISION_WAVE_SIZE = 3`) com cancelamento real.
 */
export async function runVisionWavesWithAi(
  params: RunVisionWavesParams,
): Promise<VisionWaveResult> {
  const effectiveTotal = Math.max(params.slots.length, params.totalUploadedCount ?? 0);
  const visionTruncationWarning =
    effectiveTotal > MAX_STATEMENT_VISION_PAGES_OR_IMAGES
      ? `Foram enviadas ${effectiveTotal} imagens/páginas, mas o limite por envio é de ${MAX_STATEMENT_VISION_PAGES_OR_IMAGES}. Apenas as primeiras ${MAX_STATEMENT_VISION_PAGES_OR_IMAGES} foram analisadas.`
      : undefined;

  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const baseStatusNotice: StatementAiStatusNotice | undefined = isOffline
    ? {
        kind: "offline",
        message: "Sem conexão no momento. A leitura visual por IA requer acesso à internet.",
      }
    : visionTruncationWarning
      ? { kind: "vision_truncated", message: visionTruncationWarning }
      : undefined;

  const makeEmpty = (notice = baseStatusNotice, wavesExecuted = 0): VisionWaveResult => ({
    transactions: [],
    rawEntries: [],
    rows: [],
    mapping: CANONICAL_AI_MAPPING,
    isOfx: false,
    usedAiFallback: false,
    extractionOrigin: "local_unverified",
    printedTotalCents: null,
    wavesExecuted,
    ...(notice ? { aiStatusNotice: notice } : {}),
    ...(visionTruncationWarning ? { visionTruncationWarning } : {}),
  });

  if (
    params.slots.length === 0 ||
    params.aiFallbackEnabled === false ||
    params.isReadOnlyMode ||
    isOffline ||
    params.signal?.aborted
  ) {
    return makeEmpty();
  }

  if (params.availableBatchCalls === 0) {
    return makeEmpty(buildAiStatusNoticeFromReason("quota_exceeded"), 0);
  }

  const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);
  const maxByQuota =
    typeof params.availableBatchCalls === "number"
      ? Math.max(0, Math.min(MAX_STATEMENT_VISION_PAGES_OR_IMAGES, params.availableBatchCalls))
      : MAX_STATEMENT_VISION_PAGES_OR_IMAGES;
  const limited = params.slots.slice(0, maxByQuota);
  const waves: Array<readonly VisionSlotInput[]> = [
    limited.slice(0, VISION_WAVE_SIZE),
    limited.slice(VISION_WAVE_SIZE, MAX_STATEMENT_VISION_PAGES_OR_IMAGES),
  ].filter((w) => w.length > 0);

  const collectedPageRows: AiStatementPdfRow[][] = [];
  const mergedAiMeta: MergedAiMeta = {};
  let aiStatusNotice: StatementAiStatusNotice | undefined = visionTruncationWarning
    ? { kind: "vision_truncated", message: visionTruncationWarning }
    : undefined;
  let abortedByQuotaOrOffline = false;
  let wavesExecuted = 0;

  for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
    if (params.signal?.aborted || abortedByQuotaOrOffline) break;
    const waveSlots = waves[waveIdx]!;
    const waveController = new AbortController();
    const onParentAbort = () => waveController.abort();
    params.signal?.addEventListener("abort", onParentAbort, { once: true });

    try {
      const prepared = await Promise.all(
        waveSlots.map(async (slot) => {
          if (waveController.signal.aborted) return null;
          const blob = slot.blob ?? (slot.render ? await slot.render() : null);
          if (!blob || waveController.signal.aborted) return null;
          const resolvedSha = slot.sha256
            ? await computeDeterministicSha256Hex(slot.sha256)
            : undefined;
          return { blob, resolvedSha };
        }),
      );
      if (waveController.signal.aborted) break;

      wavesExecuted += 1;
      const responses = await Promise.all(
        prepared.map(async (item) => {
          if (!item || waveController.signal.aborted) return null;
          try {
            const res = await extractStatementPdfRowsWithAi({
              sha256: item.resolvedSha,
              imageBlob: item.blob,
              referenceYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
              competenceMonth: params.competenceMonth,
              userId: params.userId,
              isReadOnlyMode: params.isReadOnlyMode,
              featureEnabled: params.aiFallbackEnabled,
              signal: waveController.signal,
            });
            if (!res.ok && (res.reason === "quota_exceeded" || res.reason === "offline")) {
              waveController.abort();
            }
            return res;
          } catch (err) {
            if (waveController.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
              return null;
            }
            throw err;
          }
        }),
      );

      for (const aiRes of responses) {
        if (!aiRes) continue;
        if (!aiRes.ok) {
          const reasonNotice = buildAiStatusNoticeFromReason(aiRes.reason, aiRes.quotaResetAt);
          if (reasonNotice) aiStatusNotice = reasonNotice;
          if (aiRes.reason === "quota_exceeded" || aiRes.reason === "offline") {
            abortedByQuotaOrOffline = true;
          }
          continue;
        }
        mergeAiMetaFields(mergedAiMeta, aiRes.data);
        if (aiRes.data.rows.length > 0) collectedPageRows.push(aiRes.data.rows);
      }

      if (
        waveIdx === 0 &&
        params.stopAfterWave1IfClosed &&
        !abortedByQuotaOrOffline &&
        collectedPageRows.length > 0
      ) {
        const wave1Rows = deduplicateConsecutiveVisionRows(collectedPageRows);
        const builtWave1 = buildTransactionsFromAiRows(wave1Rows, {
          cardId: params.cardId,
          competenceMonth: params.competenceMonth,
          closingDay: params.card?.closing_day,
        });
        const target = mergedAiMeta.detectedTotalInvoiceCents ?? params.officialTotalCents ?? null;
        if (target !== null && target > 0 && builtWave1.transactions.length > 0) {
          const qWave1 = evaluateStatementExtractionQuality({
            transactions: builtWave1.transactions,
            officialTotalCents: target,
          });
          if (qWave1.diffCents <= 5 && qWave1.passed) break;
        }
      }
    } finally {
      params.signal?.removeEventListener("abort", onParentAbort);
    }
  }

  const collectedRows = deduplicateConsecutiveVisionRows(collectedPageRows);
  if (collectedRows.length === 0) return makeEmpty(aiStatusNotice, wavesExecuted);

  const built = buildTransactionsFromAiRows(collectedRows, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    closingDay: params.card?.closing_day,
  });
  if (built.transactions.length === 0) return makeEmpty(aiStatusNotice, wavesExecuted);

  const finalOfficialTotal =
    mergedAiMeta.detectedTotalInvoiceCents ?? params.officialTotalCents ?? null;
  const visionQuality = evaluateStatementExtractionQuality({
    transactions: built.transactions,
    officialTotalCents: finalOfficialTotal,
  });
  const detectedMeta = detectStatementMetadata({
    rawText: "",
    transactions: built.transactions,
    activeCompetenceMonth: params.competenceMonth,
    card: params.card,
    printedTotalCents: finalOfficialTotal,
    aiDetectedMeta: hasAnyMergedAiMeta(mergedAiMeta) ? mergedAiMeta : null,
  });

  const visionLearningLines = params.rawLinesForLearning
    ? [...params.rawLinesForLearning]
    : params.rawTextForLearning
      ? params.rawTextForLearning.split(/\r?\n/)
      : [];
  const visionDraft =
    visionLearningLines.length > 0
      ? distillStatementBlueprintDraft({
          rawText: params.rawTextForLearning ?? visionLearningLines.join("\n"),
          rawLines: visionLearningLines,
          extractedTransactions: built.transactions,
          fileKind: "pdf_text",
          fileName: params.fileName,
          extractionSource: "ai_vision",
          officialTotalCents: finalOfficialTotal,
        })
      : null;

  return {
    transactions: built.transactions,
    rawEntries: built.rawEntries,
    rows: built.rows,
    mapping: built.mapping,
    isOfx: false,
    usedAiFallback: true,
    extractionOrigin: "ai_vision",
    qualityGate: visionQuality,
    wavesExecuted,
    ...(visionDraft?.blueprint
      ? {
          draftBlueprint: {
            blueprint: visionDraft.blueprint,
            rawLines: visionLearningLines,
            officialTotalCents: finalOfficialTotal,
            cycleNetTargetCents: null,
            previousBalanceCents: null,
            paymentsCents: null,
          },
        }
      : {}),
    ...(aiStatusNotice ? { aiStatusNotice } : {}),
    printedTotalCents: finalOfficialTotal,
    detectedMeta,
    ...(visionTruncationWarning ? { visionTruncationWarning } : {}),
  };
}

export async function parseStatementVisionBlobsWithAi(params: {
  blobs: readonly { blob: Blob; sha256?: string | null }[];
  totalUploadedCount?: number;
  cardId: string;
  competenceMonth: string;
  card?: CardContextForMetadata | null;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
  signal?: AbortSignal;
  availableBatchCalls?: number | null;
  stopAfterWave1IfClosed?: boolean;
  officialTotalCents?: number | null;
  rawTextForLearning?: string;
  rawLinesForLearning?: readonly string[];
  fileName?: string;
}): Promise<VisionWaveResult> {
  return runVisionWavesWithAi({
    ...params,
    slots: params.blobs.map((b) => ({ blob: b.blob, sha256: b.sha256 })),
  });
}
