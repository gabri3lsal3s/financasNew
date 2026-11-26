import {
  buildSpatialLinesFromRawLines,
  buildTransactionsFromRows,
  computeStatementFingerprint,
  detectFileKindFromBytes,
  detectStatementMetadata,
  distillStatementBlueprintDraft,
  evaluateMappingConfidence,
  evaluateStatementExtractionQuality,
  extractOfxMetadata,
  extractStatementSummaryAmounts,
  extractTransactionsFromSpatialLines,
  findBestStatementBlueprint,
  getStatementIngestionErrorMessage,
  isSpreadsheetOrHtmlFileName,
  MAX_STATEMENT_AI_CHUNKS,
  parseStatementInput,
  preprocessStatementTextForAi,
  sniffColumnMapping,
  toSpatialBlueprintHints,
  type BlueprintFileKind,
  type BlueprintOrigin,
  type CardContextForMetadata,
  type ChecksumGateResult,
  type ColumnMapping,
  type DetectedStatementMetadata,
  type ParsedSpreadsheetSheet,
  type RawEntrySignHint,
  type RawExtractedEntry,
  type RawParsedRow,
  type SpatialPdfLine,
  type StatementLayoutBlueprint,
  type StatementQualityGateResult,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { extractStatementPdfRowsWithAi, maskSensitivePiiForAi } from "@/services/ai-assistant";
import { renderScannedPdfPageToBlob } from "@/services/native/receipt-extractor";
import type { PdfDocumentSession } from "@/services/pdf-session";
import type { AiStatementPdfRow } from "../../../../../supabase/functions/_shared/ai-schemas";
import { computeDeterministicSha256Hex, isStructuredTabularFileName } from "./statement-file-loader";
import {
  MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
  type AiDetectedMetaSnapshot,
  type DraftStatementBlueprintSession,
  type StatementAiStatusNotice,
  type StatementExtractionOrigin,
} from "./statement-import-types";
import {
  buildAiStatusNoticeFromReason,
  buildTransactionsFromAiRows,
  CANONICAL_AI_MAPPING,
  hasAnyMergedAiMeta,
  mergeAiMetaFields,
  runVisionWavesWithAi,
  selectCandidatePdfVisionPagesWithOverflow,
  type MergedAiMeta,
} from "./statement-vision-runner";

export { runSyncBatchCategorization, type SyncBatchCategorizationParams } from "./statement-categorization-stage";

export interface ParseStatementWithFallbackParams {
  content: string | ArrayBuffer;
  fileNameOrType: string;
  cardId: string;
  competenceMonth: string;
  card?: CardContextForMetadata | null;
  fileSha256?: string | null;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
  signal?: AbortSignal;
  availableBatchCalls?: number | null;
  onStatusMessage?: (msg: string) => void;
  learnedBlueprints?: readonly StatementLayoutBlueprint[];
  spatialTransactions?: StatementTransaction[];
  spatialRawEntries?: RawExtractedEntry[];
  defaultSignHint?: RawEntrySignHint;
  checksumGate?: ChecksumGateResult;
  spatialLinesCount?: number;
  discardedMoneyLines?: number;
  spatialRawLines?: string[];
  spatialLines?: SpatialPdfLine[];
  rawFullText?: string;
  pdfSession?: PdfDocumentSession;
  pdfBuffer?: ArrayBuffer;
  pdfPageTexts?: string[];
  pdfTotalPages?: number;
  pdfPassword?: string;
  skipVisionEscalation?: boolean;
  appliedBlueprintId?: string;
  appliedBlueprintFingerprint?: string;
  appliedBlueprintOrigin?: BlueprintOrigin;
}

export interface ParsedStatementWithFallbackResult {
  transactions: StatementTransaction[];
  rawEntries?: RawExtractedEntry[];
  defaultSignHint?: RawEntrySignHint;
  aiDetectedMeta?: AiDetectedMetaSnapshot | null;
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  spreadsheetSheets?: ParsedSpreadsheetSheet[];
  activeSheetIndex?: number;
  failureMessage?: string;
  isOfx: boolean;
  usedAiFallback: boolean;
  extractionOrigin?: StatementExtractionOrigin;
  qualityGate?: StatementQualityGateResult;
  aiStatusNotice?: StatementAiStatusNotice;
  appliedBlueprintId?: string;
  appliedBlueprintFingerprint?: string;
  appliedBlueprintOrigin?: BlueprintOrigin;
  blueprintOutcome?: { blueprintId: string; exactChecksumHit: boolean };
  draftBlueprint?: DraftStatementBlueprintSession;
  printedTotalCents: number | null;
  detectedMeta?: DetectedStatementMetadata;
  isCacheHit?: boolean;
  mappingConfidence?: number;
  visionTruncationWarning?: string;
}

export function detectSpatialCollapseAnomaly(params: { allLinesCount: number; transactionsCount: number; discardedMoneyLines: number }): boolean {
  const { allLinesCount, transactionsCount, discardedMoneyLines } = params;
  return (transactionsCount === 0 && discardedMoneyLines >= 3) || (transactionsCount <= 1 && discardedMoneyLines >= 4 && allLinesCount >= 6);
}

export function shouldPreferAiCandidateByQuality(params: {
  aiTransactionsCount: number;
  aiQuality: StatementQualityGateResult;
  localQuality: StatementQualityGateResult;
}): boolean {
  const { aiTransactionsCount, aiQuality, localQuality } = params;
  if (aiTransactionsCount === 0) return false;
  if (aiQuality.score > localQuality.score) return true;
  if (aiQuality.score === localQuality.score) return aiQuality.passed && !localQuality.passed;
  return false;
}

async function runProactiveTextAiChunks(params: {
  chunks: readonly string[];
  competenceMonth: string;
  fileSha256?: string | null;
  saltScope?: string;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
  signal?: AbortSignal;
}) {
  const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);
  const collectedRows: AiStatementPdfRow[] = [];
  const mergedMeta: MergedAiMeta = {};
  let aiStatusNotice: StatementAiStatusNotice | undefined;

  if (params.chunks.length > MAX_STATEMENT_AI_CHUNKS) {
    aiStatusNotice = {
      kind: "chunks_truncated",
      message: `A fatura excedeu ${MAX_STATEMENT_AI_CHUNKS} blocos de leitura (75.000 caracteres). Apenas os primeiros ${MAX_STATEMENT_AI_CHUNKS} blocos foram analisados.`,
    };
  }
  const limited = params.chunks.slice(0, MAX_STATEMENT_AI_CHUNKS);
  for (let idx = 0; idx < limited.length; idx++) {
    if (params.signal?.aborted) break;
    const chunkText = limited[idx]?.trim() ?? "";
    if (!chunkText) continue;

    const baseKey = limited.length === 1 && params.fileSha256 ? params.fileSha256 : `stmt_chunk_${idx}:${params.competenceMonth}:${chunkText}`;
    const chunkSha = await computeDeterministicSha256Hex(baseKey, limited.length === 1 && params.fileSha256 ? null : params.saltScope);
    const aiRes = await extractStatementPdfRowsWithAi({
      sha256: chunkSha,
      text: chunkText,
      referenceYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
      competenceMonth: params.competenceMonth,
      userId: params.userId,
      isReadOnlyMode: params.isReadOnlyMode,
      featureEnabled: params.aiFallbackEnabled,
      signal: params.signal,
    });
    if (!aiRes.ok) {
      aiStatusNotice = buildAiStatusNoticeFromReason(aiRes.reason, aiRes.quotaResetAt) ?? aiStatusNotice;
      break;
    }
    mergeAiMetaFields(mergedMeta, aiRes.data);
    collectedRows.push(...aiRes.data.rows);
  }
  return { rows: collectedRows, mergedMeta, aiStatusNotice };
}

function buildMeta(params: ParseStatementWithFallbackParams, rawText: string, txs: StatementTransaction[], totalCents: number | null, aiMeta?: MergedAiMeta | null) {
  return detectStatementMetadata({ rawText, transactions: txs, activeCompetenceMonth: params.competenceMonth, card: params.card, printedTotalCents: totalCents, aiDetectedMeta: aiMeta && hasAnyMergedAiMeta(aiMeta) ? aiMeta : null });
}

async function maybeUpgradeDigitalPdfWithVision(params: ParseStatementWithFallbackParams, current: ParsedStatementWithFallbackResult, rawText: string): Promise<ParsedStatementWithFallbackResult> {
  const isPdf = params.fileNameOrType.trim().toLowerCase().endsWith(".pdf");
  const blocked = params.signal?.aborted || params.skipVisionEscalation || current.aiStatusNotice?.kind === "quota_exceeded" || current.aiStatusNotice?.kind === "offline" || params.isReadOnlyMode || params.aiFallbackEnabled === false;
  if (!isPdf || !(params.pdfSession || params.pdfBuffer) || blocked) return current;
  const gateFailed = current.qualityGate ? !current.qualityGate.passed : current.transactions.length === 0;
  if (!gateFailed) return current;

  const { pages, totalCandidateCount, hasOverflow } = selectCandidatePdfVisionPagesWithOverflow(params.pdfPageTexts ?? [], params.pdfTotalPages);
  if (pages.length === 0 || params.availableBatchCalls === 0) return current;

  params.onStatusMessage?.("Conferindo valores e parcelas...");
  const slots = pages.map((pageNum) => ({
    sha256: params.fileSha256 ? (pages.length === 1 && pageNum === 1 ? params.fileSha256 : `${params.fileSha256}:p${pageNum}`) : null,
    render: async () => params.pdfSession ? params.pdfSession.renderPageToBlob(pageNum) : params.pdfBuffer ? renderScannedPdfPageToBlob(params.pdfBuffer, pageNum, params.pdfPassword ? { password: params.pdfPassword } : undefined) : null,
  }));

  const visionRes = await runVisionWavesWithAi({ slots, totalUploadedCount: hasOverflow ? totalCandidateCount : pages.length, cardId: params.cardId, competenceMonth: params.competenceMonth, card: params.card, userId: params.userId, isReadOnlyMode: params.isReadOnlyMode, aiFallbackEnabled: params.aiFallbackEnabled, signal: params.signal, availableBatchCalls: params.availableBatchCalls, stopAfterWave1IfClosed: true, officialTotalCents: current.printedTotalCents, rawTextForLearning: rawText, rawLinesForLearning: params.spatialRawLines, fileName: params.fileNameOrType });
  const bestNotice = visionRes.aiStatusNotice ?? current.aiStatusNotice;
  if (visionRes.transactions.length > 0 && current.qualityGate && visionRes.qualityGate && shouldPreferAiCandidateByQuality({ aiTransactionsCount: visionRes.transactions.length, aiQuality: visionRes.qualityGate, localQuality: current.qualityGate })) {
    return { ...visionRes, aiStatusNotice: bestNotice };
  }
  return bestNotice ? { ...current, aiStatusNotice: bestNotice, ...(hasOverflow ? { visionTruncationWarning: `Mais de ${MAX_STATEMENT_VISION_PAGES_OR_IMAGES} páginas com lançamentos; apenas as ${MAX_STATEMENT_VISION_PAGES_OR_IMAGES} primeiras foram examinadas.` } : {}) } : current;
}

export async function parseStatementWithPdfAiFallback(params: ParseStatementWithFallbackParams): Promise<ParsedStatementWithFallbackResult> {
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const canUseAi = params.aiFallbackEnabled !== false && !params.isReadOnlyMode && !isOffline;
  const offlineNotice: StatementAiStatusNotice | undefined = isOffline ? { kind: "offline", message: "Sem conexão no momento. A fatura foi processada apenas localmente." } : undefined;
  const closingDay = params.card?.closing_day;
  const lowerName = params.fileNameOrType.trim().toLowerCase();

  const matchedCloudBpId = params.appliedBlueprintId ?? (params.appliedBlueprintFingerprint ? params.learnedBlueprints?.find((bp) => bp.fingerprint === params.appliedBlueprintFingerprint)?.cloudId : undefined);
  const activeBpForLabels = params.appliedBlueprintFingerprint ? [...(params.learnedBlueprints ?? [])].find((bp) => bp.fingerprint === params.appliedBlueprintFingerprint) : undefined;
  const summaryHints = activeBpForLabels?.pdfRules ? { totalLabels: activeBpForLabels.pdfRules.totalLabels, ignoredTotalLabels: activeBpForLabels.pdfRules.ignoredTotalLabels } : undefined;
  const isCollapse = detectSpatialCollapseAnomaly({ allLinesCount: params.spatialLinesCount ?? 0, transactionsCount: params.spatialTransactions?.length ?? 0, discardedMoneyLines: params.discardedMoneyLines ?? 0 });

  if ((params.spatialTransactions?.length ?? 0) > 0 || (isCollapse && params.spatialRawLines?.length)) {
    const metadataRawText = params.rawFullText || params.spatialRawLines?.join("\n") || (typeof params.content === "string" ? params.content : "");
    const summaryAmounts = extractStatementSummaryAmounts(metadataRawText, summaryHints);
    const officialTotal = params.checksumGate?.officialTotalCents ?? summaryAmounts.invoiceTotalCents;
    const activeTxs = params.spatialTransactions ?? [];
    const activeQuality = evaluateStatementExtractionQuality({ transactions: activeTxs, officialTotalCents: officialTotal, cycleNetTargetCents: summaryAmounts.cycleNetTargetCents, previousBalanceCents: summaryAmounts.previousBalanceCents, paymentsCents: summaryAmounts.paymentsCents, allLinesCount: params.spatialLinesCount ?? 0, discardedMoneyLines: params.discardedMoneyLines ?? 0 });
    let aiNotice: StatementAiStatusNotice | undefined = !canUseAi ? offlineNotice : undefined;

    if ((isCollapse || !activeQuality.passed) && canUseAi) {
      const sanitizedText = params.spatialRawLines?.length ? params.spatialRawLines.map((l) => maskSensitivePiiForAi(l)).filter((l) => l.trim().length > 0).join("\n") : maskSensitivePiiForAi(metadataRawText).trim();
      if (sanitizedText) {
        const pre = preprocessStatementTextForAi(sanitizedText);
        const aiRun = await runProactiveTextAiChunks({ chunks: pre.chunks.length > 0 ? pre.chunks : [pre.compactedText || sanitizedText], competenceMonth: params.competenceMonth, fileSha256: params.fileSha256, saltScope: isCollapse ? "collapse-rescue" : "spatial-rescue", userId: params.userId, isReadOnlyMode: params.isReadOnlyMode, aiFallbackEnabled: params.aiFallbackEnabled, signal: params.signal });
        aiNotice = aiRun.aiStatusNotice ?? aiNotice;
        if (aiRun.rows.length > 0) {
          const built = buildTransactionsFromAiRows(aiRun.rows, { cardId: params.cardId, competenceMonth: params.competenceMonth, closingDay });
          const aiTotal = aiRun.mergedMeta.detectedTotalInvoiceCents ?? officialTotal;
          const aiQuality = evaluateStatementExtractionQuality({ transactions: built.transactions, officialTotalCents: aiTotal, cycleNetTargetCents: summaryAmounts.cycleNetTargetCents, previousBalanceCents: summaryAmounts.previousBalanceCents, paymentsCents: summaryAmounts.paymentsCents });
          if (shouldPreferAiCandidateByQuality({ aiTransactionsCount: built.transactions.length, aiQuality, localQuality: activeQuality })) {
            const learningLines = params.spatialRawLines?.length ? params.spatialRawLines : metadataRawText.split(/\r?\n/);
            const distilled = distillStatementBlueprintDraft({ rawText: metadataRawText, rawLines: learningLines, extractedTransactions: built.transactions, fileKind: "pdf_text", fileName: params.fileNameOrType, extractionSource: "ai_text", officialTotalCents: aiTotal, cycleNetTargetCents: summaryAmounts.cycleNetTargetCents });
            return maybeUpgradeDigitalPdfWithVision(params, {
              transactions: built.transactions, rawEntries: built.rawEntries, defaultSignHint: "positive_purchase", aiDetectedMeta: aiRun.mergedMeta, rows: built.rows, mapping: built.mapping, isOfx: false, usedAiFallback: true, extractionOrigin: "ai_text", qualityGate: aiQuality, aiStatusNotice: aiNotice,
              ...(matchedCloudBpId ? { blueprintOutcome: { blueprintId: matchedCloudBpId, exactChecksumHit: false } } : {}),
              ...(distilled.blueprint ? { draftBlueprint: { blueprint: distilled.blueprint, rawLines: learningLines, spatialLines: params.spatialLines, officialTotalCents: aiTotal, cycleNetTargetCents: summaryAmounts.cycleNetTargetCents, previousBalanceCents: summaryAmounts.previousBalanceCents, paymentsCents: summaryAmounts.paymentsCents } } : {}),
              printedTotalCents: aiTotal, detectedMeta: buildMeta(params, metadataRawText, built.transactions, aiTotal, aiRun.mergedMeta), isCacheHit: true, mappingConfidence: 100,
            }, metadataRawText);
          }
        }
      }
    }
    if (activeTxs.length > 0) {
      const isLearnedBp = Boolean(params.appliedBlueprintFingerprint) && params.appliedBlueprintOrigin !== undefined && params.appliedBlueprintOrigin !== "builtin";
      return maybeUpgradeDigitalPdfWithVision(params, {
        transactions: activeTxs, rawEntries: params.spatialRawEntries, defaultSignHint: params.defaultSignHint ?? "auto", rows: [], mapping: CANONICAL_AI_MAPPING, isOfx: false, usedAiFallback: false, extractionOrigin: activeQuality.passed ? (isLearnedBp ? "local_learned_blueprint" : "local_verified") : "local_unverified", qualityGate: activeQuality, aiStatusNotice: aiNotice, appliedBlueprintId: matchedCloudBpId, appliedBlueprintFingerprint: params.appliedBlueprintFingerprint, appliedBlueprintOrigin: params.appliedBlueprintOrigin,
        ...(matchedCloudBpId ? { blueprintOutcome: { blueprintId: matchedCloudBpId, exactChecksumHit: activeQuality.passed && activeQuality.diffCents <= 5 } } : {}),
        printedTotalCents: officialTotal, detectedMeta: buildMeta(params, metadataRawText, activeTxs, officialTotal), isCacheHit: true, mappingConfidence: 100,
      }, metadataRawText);
    }
  }

  const contentKind = typeof params.content !== "string" ? detectFileKindFromBytes(new Uint8Array(params.content), lowerName) : null;
  if (
    isSpreadsheetOrHtmlFileName(lowerName) ||
    contentKind === "xlsx" ||
    contentKind === "ods" ||
    contentKind === "xls_biff8" ||
    contentKind === "html_or_xml_sheet"
  ) {
    const { parseSpreadsheetWorkbook } = await import("@/domain/reconciliation/extractors/spreadsheet-extractor");
    const workbook = await parseSpreadsheetWorkbook(params.content);
    if (workbook.rows.length === 0) {
      return {
        transactions: [],
        rows: [],
        mapping: CANONICAL_AI_MAPPING,
        spreadsheetSheets: workbook.sheets,
        activeSheetIndex: workbook.activeSheetIndex,
        isOfx: false,
        usedAiFallback: false,
        extractionOrigin: "local_unverified",
        failureMessage: getStatementIngestionErrorMessage("no_tabular_rows_found"),
        printedTotalCents: null,
        isCacheHit: false,
        mappingConfidence: 0,
      };
    }

    let activeSheetIndex = workbook.activeSheetIndex;
    let sheetRows = workbook.rows;
    const rawTextSample = sheetRows.slice(0, 60).map((r) => r.rawText).join("\n");
    let rawLines = sheetRows.map((r) => r.rawText);

    const sheetFingerprint = computeStatementFingerprint({
      rawText: rawTextSample,
      fileKind: "xlsx",
      fileName: params.fileNameOrType,
      headerLines: rawLines,
    });
    let matchedSheetBp = findBestStatementBlueprint({
      fingerprint: sheetFingerprint,
      learnedBlueprints: params.learnedBlueprints ?? [],
      fileKind: "xlsx",
    });

    if (!matchedSheetBp && workbook.sheets.length > 1 && (params.learnedBlueprints?.length ?? 0) > 0) {
      for (let sIdx = 0; sIdx < workbook.sheets.length; sIdx++) {
        const candSheet = workbook.sheets[sIdx]!;
        const candLines = candSheet.rows.map((r) => r.rawText);
        const candFp = computeStatementFingerprint({
          rawText: candLines.slice(0, 60).join("\n"),
          fileKind: "xlsx",
          fileName: params.fileNameOrType,
          headerLines: candLines,
        });
        const candMatch = findBestStatementBlueprint({
          fingerprint: candFp,
          learnedBlueprints: params.learnedBlueprints ?? [],
          fileKind: "xlsx",
        });
        if (candMatch?.blueprint.tabularRules?.columnMapping) {
          matchedSheetBp = candMatch;
          activeSheetIndex = sIdx;
          sheetRows = candSheet.rows;
          rawLines = candLines;
          break;
        }
      }
    } else if (matchedSheetBp?.blueprint.tabularRules?.sheetName && workbook.sheets.length > 1) {
      const targetIdx = workbook.sheets.findIndex(
        (sheet) => sheet.name === matchedSheetBp?.blueprint.tabularRules?.sheetName,
      );
      if (targetIdx >= 0 && targetIdx !== activeSheetIndex) {
        activeSheetIndex = targetIdx;
        sheetRows = workbook.sheets[targetIdx]!.rows;
        rawLines = sheetRows.map((r) => r.rawText);
      }
    }

    const sniffedMapping = sniffColumnMapping(sheetRows);
    const sniffedConf = evaluateMappingConfidence({ rows: sheetRows, mapping: sniffedMapping, isCacheHit: false });
    const sniffedTxs = buildTransactionsFromRows(
      sheetRows,
      sniffedMapping,
      { cardId: params.cardId, competenceMonth: params.competenceMonth, closingDay },
      "spreadsheet",
    );

    const learnedMapping = matchedSheetBp?.blueprint.tabularRules?.columnMapping;
    let finalMapping = sniffedMapping;
    let finalConf = sniffedConf;
    let finalTxs = sniffedTxs;
    let usedLearnedBp = false;

    if (matchedSheetBp && learnedMapping) {
      const bpTxs = buildTransactionsFromRows(
        sheetRows,
        learnedMapping,
        { cardId: params.cardId, competenceMonth: params.competenceMonth, closingDay },
        "spreadsheet",
      );
      if (bpTxs.length > 0 && bpTxs.length >= sniffedTxs.length) {
        finalMapping = learnedMapping;
        finalConf = 100;
        finalTxs = bpTxs;
        usedLearnedBp = true;
      }
    }

    const summary = extractStatementSummaryAmounts(rawLines.join("\n"));
    const localQuality = evaluateStatementExtractionQuality({
      transactions: finalTxs,
      officialTotalCents: summary.invoiceTotalCents,
      cycleNetTargetCents: summary.cycleNetTargetCents,
      previousBalanceCents: summary.previousBalanceCents,
      paymentsCents: summary.paymentsCents,
      mappingConfidence: finalConf,
      columnMapping: finalMapping,
    });
    const bp = matchedSheetBp?.blueprint;
    return {
      transactions: finalTxs,
      rows: sheetRows,
      mapping: finalMapping,
      spreadsheetSheets: workbook.sheets,
      activeSheetIndex,
      isOfx: false,
      usedAiFallback: false,
      extractionOrigin: usedLearnedBp
        ? "local_learned_blueprint"
        : localQuality.passed
          ? "local_verified"
          : "local_unverified",
      qualityGate: localQuality,
      ...(usedLearnedBp && bp
        ? {
            appliedBlueprintId: bp.cloudId,
            appliedBlueprintFingerprint: bp.fingerprint,
            appliedBlueprintOrigin: bp.origin,
          }
        : {}),
      ...(bp?.cloudId
        ? {
            blueprintOutcome: {
              blueprintId: bp.cloudId,
              exactChecksumHit: usedLearnedBp && localQuality.passed && localQuality.diffCents <= 5,
            },
          }
        : {}),
      printedTotalCents: summary.invoiceTotalCents,
      detectedMeta: buildMeta(params, sheetRows.slice(0, 15).map((r) => r.rawText).join("\n"), finalTxs, summary.invoiceTotalCents),
      isCacheHit: usedLearnedBp,
      mappingConfidence: finalConf,
    };
  }

  const deterministic = parseStatementInput(params.content, params.fileNameOrType, { cardId: params.cardId, competenceMonth: params.competenceMonth, closingDay });
  const textContent = typeof params.content === "string" ? params.content : new TextDecoder("utf-8", { fatal: false }).decode(params.content);
  const metadataRawText = params.rawFullText || textContent;

  if (deterministic.isOfx) {
    const ofxMeta = extractOfxMetadata(textContent);
    const enrichedOfx = [ofxMeta.org ? `Emissor: ${ofxMeta.org}` : "", ofxMeta.acctLast4 ? `Cartão final ${ofxMeta.acctLast4}` : "", textContent].filter(Boolean).join("\n");
    const ofxQuality = evaluateStatementExtractionQuality({ transactions: deterministic.transactions, officialTotalCents: ofxMeta.ledgerBalanceCents, isOfx: true });
    return { ...deterministic, usedAiFallback: false, extractionOrigin: ofxQuality.passed ? "local_verified" : "local_unverified", qualityGate: ofxQuality, printedTotalCents: ofxMeta.ledgerBalanceCents, detectedMeta: buildMeta(params, enrichedOfx, deterministic.transactions, ofxMeta.ledgerBalanceCents), isCacheHit: true, mappingConfidence: 100 };
  }

  const isCsvOrTsv = lowerName.endsWith(".csv") || lowerName.endsWith(".tsv");
  if (isCsvOrTsv && deterministic.rows.length === 0) {
    return {
      ...deterministic,
      usedAiFallback: false,
      extractionOrigin: "local_unverified",
      failureMessage: getStatementIngestionErrorMessage("no_tabular_rows_found"),
      printedTotalCents: null,
      isCacheHit: false,
      mappingConfidence: 0,
    };
  }
  if (isCsvOrTsv && deterministic.rows.length > 0 && (params.learnedBlueprints?.length ?? 0) > 0) {
    const csvLines = deterministic.rows.map((r) => r.rawText);
    const csvSample = csvLines.slice(0, 60).join("\n");
    const csvFp = computeStatementFingerprint({
      rawText: csvSample,
      fileKind: "csv",
      fileName: params.fileNameOrType,
      headerLines: csvLines,
    });
    const matchedCsvBp = findBestStatementBlueprint({
      fingerprint: csvFp,
      learnedBlueprints: params.learnedBlueprints ?? [],
      fileKind: "csv",
    });
    const csvBpMapping = matchedCsvBp?.blueprint.tabularRules?.columnMapping;
    if (matchedCsvBp && csvBpMapping) {
      const bpTxs = buildTransactionsFromRows(
        deterministic.rows,
        csvBpMapping,
        { cardId: params.cardId, competenceMonth: params.competenceMonth, closingDay },
        "csv",
      );
      if (bpTxs.length > 0 && bpTxs.length >= deterministic.transactions.length) {
        const csvSummary = extractStatementSummaryAmounts(metadataRawText);
        const csvQuality = evaluateStatementExtractionQuality({
          transactions: bpTxs,
          officialTotalCents: csvSummary.invoiceTotalCents,
          cycleNetTargetCents: csvSummary.cycleNetTargetCents,
          previousBalanceCents: csvSummary.previousBalanceCents,
          paymentsCents: csvSummary.paymentsCents,
          mappingConfidence: 100,
          columnMapping: csvBpMapping,
        });
        const bp = matchedCsvBp.blueprint;
        return {
          transactions: bpTxs,
          rows: deterministic.rows,
          mapping: csvBpMapping,
          isOfx: false,
          usedAiFallback: false,
          extractionOrigin: "local_learned_blueprint",
          qualityGate: csvQuality,
          appliedBlueprintId: bp.cloudId,
          appliedBlueprintFingerprint: bp.fingerprint,
          appliedBlueprintOrigin: bp.origin,
          ...(bp.cloudId
            ? { blueprintOutcome: { blueprintId: bp.cloudId, exactChecksumHit: csvQuality.passed && csvQuality.diffCents <= 5 } }
            : {}),
          printedTotalCents: csvSummary.invoiceTotalCents,
          detectedMeta: buildMeta(params, metadataRawText, bpTxs, csvSummary.invoiceTotalCents),
          isCacheHit: true,
          mappingConfidence: 100,
        };
      }
    }
  }

  const textBpKind: BlueprintFileKind = lowerName.endsWith(".pdf") ? "pdf_text" : "text";
  const rawLines = metadataRawText.split(/\r?\n/);
  const matchedTextBp = !isStructuredTabularFileName(params.fileNameOrType, params.content)
    ? findBestStatementBlueprint({ fingerprint: computeStatementFingerprint({ rawText: metadataRawText, fileKind: textBpKind, fileName: params.fileNameOrType, headerLines: rawLines }), learnedBlueprints: params.learnedBlueprints ?? [], fileKind: textBpKind })
    : null;
  if (matchedTextBp?.blueprint.pdfRules) {
    const bp = matchedTextBp.blueprint;
    const bpSummary = extractStatementSummaryAmounts(metadataRawText, { totalLabels: bp.pdfRules!.totalLabels, ignoredTotalLabels: bp.pdfRules!.ignoredTotalLabels });
    const spLines = buildSpatialLinesFromRawLines(rawLines);
    const bpExt = extractTransactionsFromSpatialLines(spLines, { cardId: params.cardId, competenceMonth: params.competenceMonth, closingDay, blueprintHints: toSpatialBlueprintHints(bp) });
    const bpQuality = evaluateStatementExtractionQuality({ transactions: bpExt.transactions, officialTotalCents: bpSummary.invoiceTotalCents, cycleNetTargetCents: bpSummary.cycleNetTargetCents, previousBalanceCents: bpSummary.previousBalanceCents, paymentsCents: bpSummary.paymentsCents, allLinesCount: spLines.length, discardedMoneyLines: bpExt.discardedMoneyLines });
    if (bpExt.transactions.length > 0 && bpQuality.passed) {
      return { transactions: bpExt.transactions, rawEntries: bpExt.entries, defaultSignHint: bp.polarity, rows: [], mapping: CANONICAL_AI_MAPPING, isOfx: false, usedAiFallback: false, extractionOrigin: bp.origin !== "builtin" ? "local_learned_blueprint" : "local_verified", qualityGate: bpQuality, appliedBlueprintId: bp.cloudId, appliedBlueprintFingerprint: bp.fingerprint, appliedBlueprintOrigin: bp.origin, ...(bp.cloudId ? { blueprintOutcome: { blueprintId: bp.cloudId, exactChecksumHit: bpQuality.diffCents <= 5 } } : {}), printedTotalCents: bpSummary.invoiceTotalCents, detectedMeta: buildMeta(params, metadataRawText, bpExt.transactions, bpSummary.invoiceTotalCents), isCacheHit: true, mappingConfidence: 100 };
    }
  }

  const pre = preprocessStatementTextForAi(textContent);
  const summary = extractStatementSummaryAmounts(metadataRawText, summaryHints);
  const officialTotal = summary.invoiceTotalCents ?? pre.printedTotalCents;
  const localMapConf = evaluateMappingConfidence({ rows: deterministic.rows, mapping: deterministic.mapping });
  const localQuality = evaluateStatementExtractionQuality({ transactions: deterministic.transactions, officialTotalCents: officialTotal, cycleNetTargetCents: summary.cycleNetTargetCents, previousBalanceCents: summary.previousBalanceCents, paymentsCents: summary.paymentsCents, mappingConfidence: deterministic.rows.length > 0 ? localMapConf : undefined, columnMapping: deterministic.rows.length > 0 ? deterministic.mapping : null });

  if (localQuality.passed || !textContent.trim() || !canUseAi) {
    const localCandidate: ParsedStatementWithFallbackResult = { ...deterministic, usedAiFallback: false, extractionOrigin: localQuality.passed ? "local_verified" : "local_unverified", qualityGate: localQuality, ...(!localQuality.passed && offlineNotice ? { aiStatusNotice: offlineNotice } : {}), ...(matchedTextBp?.blueprint.cloudId && !localQuality.passed ? { blueprintOutcome: { blueprintId: matchedTextBp.blueprint.cloudId, exactChecksumHit: false } } : {}), printedTotalCents: officialTotal, detectedMeta: buildMeta(params, metadataRawText, deterministic.transactions, officialTotal), mappingConfidence: localMapConf };
    return localQuality.passed ? localCandidate : maybeUpgradeDigitalPdfWithVision(params, localCandidate, metadataRawText);
  }

  const aiRun = await runProactiveTextAiChunks({ chunks: pre.chunks.length > 0 ? pre.chunks : [pre.compactedText], competenceMonth: params.competenceMonth, fileSha256: params.fileSha256, userId: params.userId, isReadOnlyMode: params.isReadOnlyMode, aiFallbackEnabled: params.aiFallbackEnabled, signal: params.signal });
  const built = aiRun.rows.length > 0 ? buildTransactionsFromAiRows(aiRun.rows, { cardId: params.cardId, competenceMonth: params.competenceMonth, closingDay }) : null;
  const finalTotal = aiRun.mergedMeta.detectedTotalInvoiceCents ?? officialTotal;
  const aiQuality = built ? evaluateStatementExtractionQuality({ transactions: built.transactions, officialTotalCents: finalTotal, cycleNetTargetCents: summary.cycleNetTargetCents, previousBalanceCents: summary.previousBalanceCents, paymentsCents: summary.paymentsCents }) : null;

  if (!built || !aiQuality || !shouldPreferAiCandidateByQuality({ aiTransactionsCount: built.transactions.length, aiQuality, localQuality })) {
    return maybeUpgradeDigitalPdfWithVision(params, { ...deterministic, usedAiFallback: false, extractionOrigin: localQuality.passed ? "local_verified" : "local_unverified", qualityGate: localQuality, aiStatusNotice: aiRun.aiStatusNotice, ...(matchedTextBp?.blueprint.cloudId ? { blueprintOutcome: { blueprintId: matchedTextBp.blueprint.cloudId, exactChecksumHit: false } } : {}), printedTotalCents: finalTotal, detectedMeta: buildMeta(params, metadataRawText, deterministic.transactions, finalTotal, aiRun.mergedMeta), mappingConfidence: localMapConf }, metadataRawText);
  }

  const distilled = distillStatementBlueprintDraft({ rawText: metadataRawText, rawLines, extractedTransactions: built.transactions, fileKind: textBpKind, fileName: params.fileNameOrType, extractionSource: "ai_text", officialTotalCents: finalTotal, cycleNetTargetCents: summary.cycleNetTargetCents });
  return maybeUpgradeDigitalPdfWithVision(params, {
    transactions: built.transactions, rawEntries: built.rawEntries, defaultSignHint: "positive_purchase", aiDetectedMeta: aiRun.mergedMeta, rows: built.rows, mapping: built.mapping, isOfx: false, usedAiFallback: true, extractionOrigin: "ai_text", qualityGate: aiQuality, aiStatusNotice: aiRun.aiStatusNotice,
    ...(matchedTextBp?.blueprint.cloudId ? { blueprintOutcome: { blueprintId: matchedTextBp.blueprint.cloudId, exactChecksumHit: false } } : {}),
    ...(distilled.blueprint ? { draftBlueprint: { blueprint: distilled.blueprint, rawLines, spatialLines: params.spatialLines, officialTotalCents: finalTotal, cycleNetTargetCents: summary.cycleNetTargetCents, previousBalanceCents: summary.previousBalanceCents, paymentsCents: summary.paymentsCents } } : {}),
    printedTotalCents: finalTotal, detectedMeta: buildMeta(params, metadataRawText, built.transactions, finalTotal, aiRun.mergedMeta), isCacheHit: false, mappingConfidence: 100,
  }, metadataRawText);
}
