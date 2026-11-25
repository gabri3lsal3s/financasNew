import {
  buildTransactionsFromRows,
  detectStatementMetadata,
  evaluateStatementExtractionQuality,
  extractOfxMetadata,
  normalizeRawEntries,
  parseStatementInput,
  type CardContextForMetadata,
  type ColumnMapping,
  type DetectedStatementMetadata,
  type RawParsedRow,
  type StatementQualityGateResult,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { computeFileSha256 } from "@/services/receipt-resolution";
import { pushToast } from "@/services/toast";
import type { CreditCard } from "@/types";
import { isRasterStatementImageByContent } from "./statement-file-loader";
import {
  MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
  type StatementAiStatusNotice,
  type StatementExtractionOrigin,
  type StatementSessionSnapshot,
} from "./statement-import-types";
import {
  CANONICAL_AI_MAPPING,
  runVisionWavesWithAi,
  type VisionSlotInput,
} from "./statement-vision-runner";

export interface ExtractedStatementPayload {
  transactions: StatementTransaction[];
  usedAiStructurer: boolean;
  extractionOrigin: StatementExtractionOrigin | null;
  qualityGate: StatementQualityGateResult | null;
  aiStatusNotice: StatementAiStatusNotice | null;
  printedTotalCents: number | null;
  detectedMeta: DetectedStatementMetadata | null;
  shouldAutoAdvance: boolean;
  isMultiImageOverlapRisk?: boolean;
  competenceForReconciliation?: string;
  rows?: RawParsedRow[];
  mapping?: ColumnMapping;
}

export function toCardMetadataContext(card: CreditCard): CardContextForMetadata {
  return {
    id: card.id,
    name: card.name,
    brand: card.brand,
    closing_day: card.closing_day,
    due_day: card.due_day,
    last_four_digits: card.last_four_digits,
  };
}

/**
 * Re-normaliza `RawExtractedEntry[]` retidos em memória em `< 2 ms` com 0 chamadas à IA
 * ao trocar competência ou trocar cartão em 1 clique (G2, D13, D17).
 */
export function reNormalizeSessionSnapshot(params: {
  session: StatementSessionSnapshot;
  targetCard: CreditCard;
  targetCompetenceMonth: string;
}): {
  updatedSession: StatementSessionSnapshot;
  payload: ExtractedStatementPayload;
} {
  const { session, targetCard, targetCompetenceMonth } = params;
  let transactions: StatementTransaction[] = [];

  if (session.rawEntries && session.rawEntries.length > 0) {
    transactions = normalizeRawEntries(session.rawEntries, {
      cardId: targetCard.id,
      competenceMonth: targetCompetenceMonth,
      closingDay: targetCard.closing_day,
      defaultSignHint: session.defaultSignHint ?? "auto",
    });
  } else if (session.rows && session.mapping && session.rows.length > 0) {
    transactions = buildTransactionsFromRows(session.rows, session.mapping, {
      cardId: targetCard.id,
      competenceMonth: targetCompetenceMonth,
      closingDay: targetCard.closing_day,
    });
  } else if (typeof session.content === "string" && session.content.trim().length > 0) {
    const reparsed = parseStatementInput(session.content, session.fileNameOrType, {
      cardId: targetCard.id,
      competenceMonth: targetCompetenceMonth,
      closingDay: targetCard.closing_day,
    });
    transactions = reparsed.transactions;
  } else if (session.extractedTransactions) {
    transactions = session.extractedTransactions;
  }

  const rawText =
    session.rawFullText ??
    (typeof session.content === "string"
      ? session.content
      : session.content instanceof ArrayBuffer
        ? new TextDecoder("utf-8", { fatal: false }).decode(session.content)
        : "");
  const isOfxContent = /<OFX[\s>]/i.test(rawText) || /<STMTTRN[\s>]/i.test(rawText);
  const ofxMeta = isOfxContent ? extractOfxMetadata(rawText) : null;
  const metadataRawText = ofxMeta
    ? [
        ofxMeta.org ? `Emissor: ${ofxMeta.org}` : "",
        ofxMeta.acctLast4 ? `Cartão final ${ofxMeta.acctLast4}` : "",
        rawText,
      ]
        .filter(Boolean)
        .join("\n")
    : rawText;
  const qualityGate = evaluateStatementExtractionQuality({
    transactions,
    officialTotalCents: session.printedTotalCents ?? null,
  });
  const detectedMeta = detectStatementMetadata({
    rawText: metadataRawText,
    transactions,
    activeCompetenceMonth: targetCompetenceMonth,
    card: toCardMetadataContext(targetCard),
    printedTotalCents: session.printedTotalCents ?? null,
    aiDetectedMeta: session.aiDetectedMeta ?? null,
  });

  const updatedSession: StatementSessionSnapshot = {
    ...session,
    extractedTransactions: transactions,
    qualityGate,
    sourceCompetenceMonth: targetCompetenceMonth,
  };

  return {
    updatedSession,
    payload: {
      transactions,
      usedAiStructurer: Boolean(session.usedAiStructurer),
      extractionOrigin: session.extractionOrigin ?? null,
      qualityGate,
      aiStatusNotice: session.aiStatusNotice ?? null,
      printedTotalCents: session.printedTotalCents ?? null,
      detectedMeta,
      shouldAutoAdvance: session.shouldAutoAdvance ?? true,
      competenceForReconciliation: targetCompetenceMonth,
      rows: session.rows,
      mapping: session.mapping ?? CANONICAL_AI_MAPPING,
    },
  };
}

export async function partitionAndPrepareVisionImages(
  files: readonly File[],
): Promise<{
  hasImages: boolean;
  totalImageCount: number;
  blobsWithSha: Array<{ blob: File; sha256: string | null }>;
}> {
  const checks = await Promise.all(
    files.map(async (f) => ({ file: f, isImage: await isRasterStatementImageByContent(f) })),
  );
  const imageFiles = checks.filter((e) => e.isImage).map((e) => e.file);
  if (imageFiles.length === 0) {
    return { hasImages: false, totalImageCount: 0, blobsWithSha: [] };
  }
  const limited = imageFiles.slice(0, MAX_STATEMENT_VISION_PAGES_OR_IMAGES);
  const blobsWithSha = await Promise.all(
    limited.map(async (img) => ({ blob: img, sha256: await computeFileSha256(img) })),
  );
  return { hasImages: true, totalImageCount: imageFiles.length, blobsWithSha };
}

export async function executeVisionWaveIngestion(params: {
  slots: readonly VisionSlotInput[];
  totalUploadedCount?: number;
  isMultiImageOverlapRisk?: boolean;
  activeCard: CreditCard;
  activeCompetenceMonth: string;
  userId?: string | null;
  isReadOnlyMode: boolean;
  aiExtractionEnabled: boolean;
  availableBatchCalls: number | null;
  signal: AbortSignal;
  emptyErrorMessage: string;
  sessionBase: Partial<StatementSessionSnapshot> & {
    content: string | ArrayBuffer;
    fileNameOrType: string;
  };
}): Promise<
  | { ok: true; session: StatementSessionSnapshot; payload: ExtractedStatementPayload & { rows: RawParsedRow[]; mapping: ColumnMapping } }
  | { ok: false; aborted: boolean; aiStatusNotice?: StatementAiStatusNotice | null; errorMessage?: string }
> {
  const res = await runVisionWavesWithAi({
    slots: params.slots,
    totalUploadedCount: params.totalUploadedCount,
    cardId: params.activeCard.id,
    competenceMonth: params.activeCompetenceMonth,
    card: toCardMetadataContext(params.activeCard),
    userId: params.userId,
    isReadOnlyMode: params.isReadOnlyMode,
    aiFallbackEnabled: params.aiExtractionEnabled,
    signal: params.signal,
    availableBatchCalls: params.availableBatchCalls,
  });

  if (params.signal.aborted) {
    return { ok: false, aborted: true };
  }
  if (res.visionTruncationWarning) {
    pushToast({
      title: "Limite de páginas por envio",
      description: res.visionTruncationWarning,
      variant: "default",
    });
  }
  if (res.transactions.length === 0) {
    return {
      ok: false,
      aborted: false,
      aiStatusNotice: res.aiStatusNotice ?? null,
      errorMessage:
        res.aiStatusNotice?.kind === "quota_exceeded"
          ? res.aiStatusNotice.message
          : params.emptyErrorMessage,
    };
  }

  const session: StatementSessionSnapshot = {
    ...params.sessionBase,
    rawEntries: res.rawEntries,
    defaultSignHint: "positive_purchase",
    extractedTransactions: res.transactions,
    usedAiStructurer: true,
    extractionOrigin: "ai_vision",
    qualityGate: res.qualityGate,
    aiStatusNotice: res.aiStatusNotice,
    printedTotalCents: res.printedTotalCents,
    rows: res.rows,
    mapping: res.mapping,
    shouldAutoAdvance: true,
    sourceCompetenceMonth: params.activeCompetenceMonth,
  };

  return {
    ok: true,
    session,
    payload: {
      transactions: res.transactions,
      usedAiStructurer: true,
      extractionOrigin: "ai_vision",
      qualityGate: res.qualityGate ?? null,
      aiStatusNotice: res.aiStatusNotice ?? null,
      printedTotalCents: res.printedTotalCents,
      detectedMeta: res.detectedMeta ?? null,
      shouldAutoAdvance: true,
      isMultiImageOverlapRisk: params.isMultiImageOverlapRisk,
      rows: res.rows,
      mapping: res.mapping,
    },
  };
}
