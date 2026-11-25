import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildTransactionsFromRows, distillStatementBlueprintDraft, extractStatementSummaryAmounts, isSpreadsheetOrHtmlFileName, sniffColumnMapping,
  type ChecksumGateResult, type ColumnMapping, type ParsedSpreadsheetSheet, type RawEntrySignHint,
  type RawExtractedEntry, type RawParsedRow, type SpatialPdfLine, type StatementLayoutBlueprint, type StatementTransaction,
} from "@/domain/reconciliation";
import { getErrorMessage } from "@/services/errors";
import { renderScannedPdfPageToBlob } from "@/services/native/receipt-extractor";
import type { PdfDocumentSession } from "@/services/pdf-session";
import { pushToast } from "@/services/toast";
import type { CreditCard } from "@/types";
import { isStatementPasswordPromptError, readStatementFileContent } from "./statement-file-loader";
import { parseStatementWithPdfAiFallback } from "./statement-import-pipeline";
import type { DraftStatementBlueprintSession, LoadedStatementSource, StatementAiStatusNotice, StatementSessionSnapshot } from "./statement-import-types";
import { executeVisionWaveIngestion, partitionAndPrepareVisionImages, reNormalizeSessionSnapshot, toCardMetadataContext, type ExtractedStatementPayload } from "./statement-ingestion-runner";
import { CANONICAL_AI_MAPPING, selectCandidatePdfVisionPagesWithOverflow, type VisionSlotInput } from "./statement-vision-runner";

export type { ExtractedStatementPayload } from "./statement-ingestion-runner";

export interface UseStatementIngestionParams {
  activeCard: CreditCard;
  activeCompetenceMonth: string;
  userId?: string | null;
  isReadOnlyMode: boolean;
  aiExtractionEnabled: boolean;
  availableBatchCalls: number | null;
  learnedBlueprints: readonly StatementLayoutBlueprint[];
  onRecordBlueprintOutcome: (outcome: { blueprintId: string; exactChecksumHit: boolean }) => void;
  onCompetenceConflict: (payload: ExtractedStatementPayload) => void;
  onMappingRequired: (payload: ExtractedStatementPayload) => void;
  onExtractionReady: (payload: ExtractedStatementPayload) => Promise<void> | void;
  onError: (msg: string | null) => void;
  onStatusNotice: (notice: StatementAiStatusNotice | null) => void;
  onUploadStepRequested: () => void;
}

export function useStatementIngestion(params: UseStatementIngestionParams) {
  const { activeCard, activeCompetenceMonth, userId, isReadOnlyMode, aiExtractionEnabled, availableBatchCalls, learnedBlueprints, onRecordBlueprintOutcome, onCompetenceConflict, onMappingRequired, onExtractionReady, onError, onStatusNotice, onUploadStepRequested } = params;

  const [parsedRows, setParsedRows] = useState<RawParsedRow[]>([]);
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<ParsedSpreadsheetSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [pendingPasswordFile, setPendingPasswordFile] = useState<File | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [readingStatusMessage, setReadingStatusMessage] = useState<string | null>(null);
  const [isTabularOfflineSource, setIsTabularOfflineSource] = useState(false);

  const pdfSessionRef = useRef<PdfDocumentSession | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const ingestionRunIdRef = useRef(0);
  const pdfPasswordRef = useRef<string | null>(null);
  const draftBlueprintRef = useRef<DraftStatementBlueprintSession | null>(null);
  const loadedSessionRef = useRef<StatementSessionSnapshot | null>(null);
  const pendingConflictRef = useRef<ExtractedStatementPayload | null>(null);

  const disposePdfSession = useCallback(() => {
    const current = pdfSessionRef.current;
    pdfSessionRef.current = null;
    if (current) void current.dispose();
  }, []);

  const beginRun = useCallback(() => {
    const runId = ++ingestionRunIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return { runId, controller };
  }, []);

  useEffect(() => () => {
    ingestionRunIdRef.current += 1;
    abortControllerRef.current?.abort();
    pdfPasswordRef.current = null;
    draftBlueprintRef.current = null;
    disposePdfSession();
  }, [disposePdfSession]);

  const handleCancelProcessing = useCallback(() => {
    ingestionRunIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setReadingStatusMessage(null);
    setIsReadingFile(false);
    setPendingPasswordFile(null);
    setPasswordError(null);
    onStatusNotice(null);
    onError(null);
    disposePdfSession();
  }, [disposePdfSession, onError, onStatusNotice]);

  const finalizeExtractionResult = useCallback(
    async (runId: number, controller: AbortController, payload: ExtractedStatementPayload & { rows: RawParsedRow[]; mapping: ColumnMapping }, isTabularOffline = false) => {
      if (ingestionRunIdRef.current !== runId || controller.signal.aborted) return;
      setParsedRows(payload.rows);
      setColumnMapping(payload.mapping);
      setIsTabularOfflineSource(isTabularOffline);
      onStatusNotice(payload.aiStatusNotice);
      if (payload.detectedMeta?.hasCompetenceMismatch && payload.detectedMeta.detectedCompetenceMonth) {
        pendingConflictRef.current = payload;
        onCompetenceConflict(payload);
        return;
      }
      if (payload.shouldAutoAdvance) await onExtractionReady(payload);
      else onMappingRequired(payload);
    },
    [onCompetenceConflict, onExtractionReady, onMappingRequired, onStatusNotice],
  );

  const runVisionSlots = useCallback(
    async (runId: number, controller: AbortController, slots: readonly VisionSlotInput[], opts: { totalUploadedCount?: number; isMultiImageOverlapRisk?: boolean; emptyErrorMessage: string; sessionBase: Partial<StatementSessionSnapshot> & { content: string | ArrayBuffer; fileNameOrType: string } }) => {
      const outcome = await executeVisionWaveIngestion({
        slots, totalUploadedCount: opts.totalUploadedCount, isMultiImageOverlapRisk: opts.isMultiImageOverlapRisk,
        activeCard, activeCompetenceMonth, userId, isReadOnlyMode, aiExtractionEnabled, availableBatchCalls,
        signal: controller.signal, emptyErrorMessage: opts.emptyErrorMessage, sessionBase: opts.sessionBase,
      });
      if (!outcome.ok) {
        if (!outcome.aborted) {
          if (outcome.aiStatusNotice !== undefined) onStatusNotice(outcome.aiStatusNotice);
          if (outcome.errorMessage) onError(outcome.errorMessage);
        }
        return false;
      }
      loadedSessionRef.current = outcome.session;
      await finalizeExtractionResult(runId, controller, outcome.payload);
      return true;
    },
    [activeCard, activeCompetenceMonth, aiExtractionEnabled, availableBatchCalls, finalizeExtractionResult, isReadOnlyMode, onError, onStatusNotice, userId],
  );

  const handleProcessInput = useCallback(
    async (
      content: string | ArrayBuffer, fileNameOrType: string, fileSha256?: string | null, spatialTransactions?: StatementTransaction[], checksumGate?: ChecksumGateResult,
      extras?: {
        spatialLinesCount?: number; discardedMoneyLines?: number; spatialRawLines?: string[]; spatialLines?: SpatialPdfLine[];
        rawFullText?: string; rawEntries?: RawExtractedEntry[]; defaultSignHint?: RawEntrySignHint;
        pdfSession?: PdfDocumentSession; pdfBuffer?: ArrayBuffer; pdfPageTexts?: string[]; pdfTotalPages?: number;
        appliedBlueprintId?: string; appliedBlueprintFingerprint?: string; appliedBlueprintOrigin?: import("@/domain/reconciliation").BlueprintOrigin; skipVisionEscalation?: boolean;
      },
    ) => {
      const { runId, controller } = beginRun();
      onError(null);
      onStatusNotice(null);
      draftBlueprintRef.current = null;
      setReadingStatusMessage("Analisando fatura...");
      loadedSessionRef.current = {
        content, rawFullText: extras?.rawFullText, rawEntries: extras?.rawEntries, defaultSignHint: extras?.defaultSignHint,
        pdfSession: extras?.pdfSession, pdfBuffer: extras?.pdfBuffer, pdfPageTexts: extras?.pdfPageTexts, pdfTotalPages: extras?.pdfTotalPages,
        fileNameOrType, fileSha256, spatialTransactions, checksumGate, spatialLinesCount: extras?.spatialLinesCount,
        discardedMoneyLines: extras?.discardedMoneyLines, spatialRawLines: extras?.spatialRawLines, spatialLines: extras?.spatialLines,
        appliedBlueprintId: extras?.appliedBlueprintId, appliedBlueprintFingerprint: extras?.appliedBlueprintFingerprint,
        appliedBlueprintOrigin: extras?.appliedBlueprintOrigin, sourceCompetenceMonth: activeCompetenceMonth,
      };
      try {
        const result = await parseStatementWithPdfAiFallback({
          content, fileNameOrType, cardId: activeCard.id, competenceMonth: activeCompetenceMonth, card: toCardMetadataContext(activeCard),
          fileSha256, userId, isReadOnlyMode, aiFallbackEnabled: aiExtractionEnabled, signal: controller.signal, availableBatchCalls,
          onStatusMessage: (msg) => { if (ingestionRunIdRef.current === runId && !controller.signal.aborted) setReadingStatusMessage(msg); },
          learnedBlueprints, spatialTransactions, spatialRawEntries: extras?.rawEntries, defaultSignHint: extras?.defaultSignHint,
          checksumGate, spatialLinesCount: extras?.spatialLinesCount, discardedMoneyLines: extras?.discardedMoneyLines,
          spatialRawLines: extras?.spatialRawLines, spatialLines: extras?.spatialLines, rawFullText: extras?.rawFullText,
          pdfSession: extras?.pdfSession, pdfBuffer: extras?.pdfBuffer, pdfPageTexts: extras?.pdfPageTexts, pdfTotalPages: extras?.pdfTotalPages,
          pdfPassword: pdfPasswordRef.current ?? undefined, skipVisionEscalation: extras?.skipVisionEscalation,
          appliedBlueprintId: extras?.appliedBlueprintId, appliedBlueprintFingerprint: extras?.appliedBlueprintFingerprint, appliedBlueprintOrigin: extras?.appliedBlueprintOrigin,
        });
        if (ingestionRunIdRef.current !== runId || controller.signal.aborted) return;
        if (result.blueprintOutcome) onRecordBlueprintOutcome(result.blueprintOutcome);
        draftBlueprintRef.current = result.draftBlueprint ?? null;
        if (result.aiStatusNotice) onStatusNotice(result.aiStatusNotice);
        if (result.visionTruncationWarning) pushToast({ title: "Limite de páginas por envio", description: result.visionTruncationWarning, variant: "default" });
        setSpreadsheetSheets(result.spreadsheetSheets ?? []);
        setActiveSheetIndex(result.activeSheetIndex ?? 0);
        if (result.transactions.length === 0 && result.rows.length === 0) {
          onError(
            result.aiStatusNotice?.kind === "quota_exceeded"
              ? result.aiStatusNotice.message
              : result.failureMessage ?? "Nenhuma linha de transação válida foi encontrada nos dados informados.",
          );
          return;
        }
        const isPdf = fileNameOrType.trim().toLowerCase().endsWith(".pdf");
        const shouldAutoAdvance =
          isPdf ||
          result.isOfx ||
          result.usedAiFallback ||
          result.rows.length === 0 ||
          (result.transactions.length > 0 &&
            (result.mapping.hasHeader ?? false) &&
            ((result.isCacheHit ?? false) || (result.mappingConfidence ?? 0) >= 85));
        loadedSessionRef.current = {
          ...loadedSessionRef.current, extractedTransactions: result.transactions, rawEntries: result.rawEntries ?? loadedSessionRef.current?.rawEntries,
          defaultSignHint: result.defaultSignHint ?? loadedSessionRef.current?.defaultSignHint, aiDetectedMeta: result.aiDetectedMeta ?? null,
          usedAiStructurer: result.usedAiFallback, extractionOrigin: result.extractionOrigin, qualityGate: result.qualityGate, aiStatusNotice: result.aiStatusNotice,
          printedTotalCents: result.printedTotalCents, rows: result.rows, spreadsheetSheets: result.spreadsheetSheets, activeSheetIndex: result.activeSheetIndex, selectedSheetName: result.activeSheetIndex !== undefined && result.activeSheetIndex >= 0 ? result.spreadsheetSheets?.[result.activeSheetIndex]?.name ?? null : null, mapping: result.mapping, shouldAutoAdvance,
        };
        await finalizeExtractionResult(runId, controller, {
          transactions: result.transactions, usedAiStructurer: result.usedAiFallback, extractionOrigin: result.extractionOrigin ?? null,
          qualityGate: result.qualityGate ?? null, aiStatusNotice: result.aiStatusNotice ?? null, printedTotalCents: result.printedTotalCents,
          detectedMeta: result.detectedMeta ?? null, shouldAutoAdvance, rows: result.rows, mapping: result.mapping,
        }, !isPdf && !result.isOfx && !result.usedAiFallback && result.rows.length > 0);
      } catch (err) {
        if (!controller.signal.aborted) onError(getErrorMessage(err));
      } finally {
        if (ingestionRunIdRef.current === runId) setReadingStatusMessage(null);
      }
    },
    [activeCard, activeCompetenceMonth, aiExtractionEnabled, availableBatchCalls, beginRun, finalizeExtractionResult, isReadOnlyMode, learnedBlueprints, onError, onRecordBlueprintOutcome, onStatusNotice, userId],
  );

  const processLoadedStatementSource = useCallback(
    async (loaded: LoadedStatementSource) => {
      draftBlueprintRef.current = null;
      onStatusNotice(null);
      if (loaded.kind === "image") {
        disposePdfSession();
        const { runId, controller } = beginRun();
        setReadingStatusMessage("Analisando fatura...");
        const blobsWithSha = [{ blob: loaded.file, sha256: loaded.sha256 }];
        await runVisionSlots(runId, controller, blobsWithSha, { emptyErrorMessage: "Não foi possível extrair lançamentos das imagens enviadas.", sessionBase: { content: "", fileNameOrType: "images", visionBlobs: blobsWithSha } });
        return;
      }
      if (loaded.kind === "pdf_scanned") {
        pdfSessionRef.current = loaded.pdfSession ?? null;
        const { runId, controller } = beginRun();
        setReadingStatusMessage("Conferindo valores e parcelas...");
        const { pages, totalCandidateCount, hasOverflow } = selectCandidatePdfVisionPagesWithOverflow(loaded.pdfPageTexts ?? [], loaded.pdfTotalPages);
        const ok = await runVisionSlots(runId, controller, pages.map((pageNum) => ({
          sha256: pageNum === 1 && loaded.sha256 ? loaded.sha256 : loaded.sha256 ? `${loaded.sha256}:p${pageNum}` : null,
          render: async () =>
            loaded.pdfSession
              ? loaded.pdfSession.renderPageToBlob(pageNum)
              : renderScannedPdfPageToBlob(
                  loaded.buffer,
                  pageNum,
                  pdfPasswordRef.current ? { password: pdfPasswordRef.current } : undefined,
                ),
        })), {
          totalUploadedCount: hasOverflow ? totalCandidateCount : pages.length,
          emptyErrorMessage: "Não foi possível extrair os dados da fatura em PDF. Se o arquivo estiver protegido por senha, desbloqueie-o ou exporte em CSV/OFX.",
          sessionBase: { content: "", fileNameOrType: "scanned_pdf", pdfSession: loaded.pdfSession, pdfBuffer: loaded.buffer, pdfPageTexts: loaded.pdfPageTexts, pdfTotalPages: loaded.pdfTotalPages },
        });
        if (!ok && loaded.fallbackRawText?.trim() && !controller.signal.aborted) {
          await handleProcessInput(loaded.fallbackRawText, loaded.fileName, loaded.sha256, undefined, undefined, { rawFullText: loaded.fallbackRawText, pdfSession: loaded.pdfSession, pdfBuffer: loaded.buffer, pdfPageTexts: loaded.pdfPageTexts, pdfTotalPages: loaded.pdfTotalPages, skipVisionEscalation: true });
        }
        return;
      }
      if (loaded.kind === "pdf_text") {
        pdfSessionRef.current = loaded.pdfSession ?? null;
        await handleProcessInput(loaded.text, loaded.fileName, loaded.sha256, loaded.spatialTransactions, loaded.checksumGate, {
          spatialLinesCount: loaded.spatialLinesCount, discardedMoneyLines: loaded.discardedMoneyLines, spatialRawLines: loaded.spatialRawLines, spatialLines: loaded.spatialLines,
          rawFullText: loaded.rawFullText, rawEntries: loaded.spatialRawEntries, defaultSignHint: loaded.defaultSignHint, pdfSession: loaded.pdfSession,
          pdfBuffer: loaded.buffer, pdfPageTexts: loaded.pdfPageTexts, pdfTotalPages: loaded.pdfTotalPages,
          appliedBlueprintId: loaded.appliedBlueprintId, appliedBlueprintFingerprint: loaded.appliedBlueprintFingerprint, appliedBlueprintOrigin: loaded.appliedBlueprintOrigin,
        });
        return;
      }
      disposePdfSession();
      await handleProcessInput(loaded.kind === "spreadsheet" ? loaded.buffer : loaded.content, loaded.fileName, loaded.kind === "spreadsheet" ? (loaded.sha256 ?? null) : null);
    },
    [beginRun, disposePdfSession, handleProcessInput, onStatusNotice, runVisionSlots],
  );

  const handleFilesSelect = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      onError(null);
      onStatusNotice(null);
      draftBlueprintRef.current = null;
      pdfPasswordRef.current = null;
      disposePdfSession();
      setIsReadingFile(true);
      setReadingStatusMessage("Analisando fatura...");
      try {
        const prep = await partitionAndPrepareVisionImages(files);
        if (prep.hasImages) {
          const { runId, controller } = beginRun();
          await runVisionSlots(runId, controller, prep.blobsWithSha, { totalUploadedCount: prep.totalImageCount, isMultiImageOverlapRisk: prep.totalImageCount > 1, emptyErrorMessage: "Não foi possível extrair lançamentos das imagens enviadas.", sessionBase: { content: "", fileNameOrType: "images", visionBlobs: prep.blobsWithSha } });
          return;
        }
        const primary = files[0]!;
        let loaded: LoadedStatementSource;
        try {
          loaded = await readStatementFileContent(primary, { cardId: activeCard.id, competenceMonth: activeCompetenceMonth, closingDay: activeCard.closing_day, learnedBlueprints });
        } catch (err: unknown) {
          if (isStatementPasswordPromptError(err)) { setPendingPasswordFile(primary); setPasswordError(null); return; }
          throw err;
        }
        await processLoadedStatementSource(loaded);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) onError(getErrorMessage(err));
      } finally {
        setIsReadingFile(false);
        setReadingStatusMessage(null);
      }
    },
    [activeCard, activeCompetenceMonth, beginRun, disposePdfSession, learnedBlueprints, onError, onStatusNotice, processLoadedStatementSource, runVisionSlots],
  );

  const handlePasswordSubmit = useCallback(async (password: string) => {
    if (!pendingPasswordFile) return;
    setIsReadingFile(true);
    setPasswordError(null);
    try {
      const loaded = await readStatementFileContent(pendingPasswordFile, { cardId: activeCard.id, competenceMonth: activeCompetenceMonth, closingDay: activeCard.closing_day, learnedBlueprints, password });
      pdfPasswordRef.current = password;
      setPendingPasswordFile(null);
      setPasswordError(null);
      await processLoadedStatementSource(loaded);
    } catch (err: unknown) {
      if (isStatementPasswordPromptError(err)) { pdfPasswordRef.current = null; setPasswordError("Senha incorreta. Verifique e tente novamente."); }
      else { onError(getErrorMessage(err)); setPendingPasswordFile(null); }
    } finally { setIsReadingFile(false); setReadingStatusMessage(null); }
  }, [activeCard, activeCompetenceMonth, learnedBlueprints, onError, pendingPasswordFile, processLoadedStatementSource]);

  const reNormalizeLoadedEntries = useCallback((reTarget: { targetCard: CreditCard; targetCompetenceMonth: string }): ExtractedStatementPayload | null => {
    const session = loadedSessionRef.current;
    if (!session) return null;
    const { updatedSession, payload } = reNormalizeSessionSnapshot({ session, ...reTarget });
    loadedSessionRef.current = updatedSession;
    return payload;
  }, []);

  const handleSelectSpreadsheetSheet = useCallback((sheetIndex: number) => {
    const targetSheet = spreadsheetSheets[sheetIndex];
    if (!targetSheet) return;
    const nextRows = targetSheet.rows;
    const nextMapping = sniffColumnMapping(nextRows);
    setActiveSheetIndex(sheetIndex);
    setParsedRows(nextRows);
    setColumnMapping(nextMapping);
    onError(null);
    if (loadedSessionRef.current) {
      loadedSessionRef.current = {
        ...loadedSessionRef.current,
        rows: nextRows,
        mapping: nextMapping,
        activeSheetIndex: sheetIndex,
        selectedSheetName: targetSheet.name,
      };
    }
  }, [onError, spreadsheetSheets]);

  const handleConfirmMapping = useCallback(async (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    onError(null);
    setIsReadingFile(true);
    try {
      const fileName = loadedSessionRef.current?.fileNameOrType ?? "";
      const isSheet = isSpreadsheetOrHtmlFileName(fileName) || spreadsheetSheets.length > 0;
      const sourceKind = isSheet ? "spreadsheet" : "csv";
      const transactions = buildTransactionsFromRows(parsedRows, mapping, { cardId: activeCard.id, competenceMonth: activeCompetenceMonth, closingDay: activeCard.closing_day }, sourceKind);
      if (parsedRows.length > 0 && transactions.length === 0) {
        onError("Nenhuma transação válida encontrada com este mapeamento. Ajuste as colunas ou a linha inicial.");
        return;
      }
      const rawTextSample = parsedRows.slice(0, 60).map((r) => r.rawText).join("\n");
      const summary = extractStatementSummaryAmounts(rawTextSample);
      const headerIdx = mapping.headerRowIndex ?? Math.max(0, mapping.startRowIndex - 1);
      const headerSig = mapping.hasHeader
        ? (parsedRows[headerIdx]?.cells ?? []).map((c) => c.trim()).filter(Boolean).join("|").slice(0, 200) || undefined
        : undefined;
      const selectedSheetName = activeSheetIndex >= 0 ? spreadsheetSheets[activeSheetIndex]?.name : undefined;
      const distilled = transactions.length > 0
        ? distillStatementBlueprintDraft({
            rawText: rawTextSample,
            rawLines: parsedRows.map((r) => r.rawText),
            extractedTransactions: transactions,
            fileKind: isSheet ? "xlsx" : "csv",
            fileName,
            extractionSource: "user_manual",
            officialTotalCents: loadedSessionRef.current?.printedTotalCents ?? summary.invoiceTotalCents,
            cycleNetTargetCents: summary.cycleNetTargetCents,
            columnMapping: mapping,
            headerSignature: headerSig,
            sheetName: selectedSheetName,
          })
        : null;
      if (distilled?.blueprint) {
        draftBlueprintRef.current = {
          blueprint: distilled.blueprint,
          rawLines: parsedRows.map((r) => r.rawText),
          rows: parsedRows,
          officialTotalCents: loadedSessionRef.current?.printedTotalCents ?? summary.invoiceTotalCents,
          cycleNetTargetCents: summary.cycleNetTargetCents,
          previousBalanceCents: summary.previousBalanceCents,
          paymentsCents: summary.paymentsCents,
        };
      }
      if (loadedSessionRef.current) loadedSessionRef.current = { ...loadedSessionRef.current, mapping, extractedTransactions: transactions, shouldAutoAdvance: true };
      await onExtractionReady({ transactions, usedAiStructurer: false, extractionOrigin: null, qualityGate: null, aiStatusNotice: null, printedTotalCents: loadedSessionRef.current?.printedTotalCents ?? summary.invoiceTotalCents, detectedMeta: null, shouldAutoAdvance: true });
    } catch (err) { onError(getErrorMessage(err)); } finally { setIsReadingFile(false); }
  }, [activeCard, activeCompetenceMonth, activeSheetIndex, onError, onExtractionReady, parsedRows, spreadsheetSheets]);

  const clearPendingConflict = useCallback(() => { pendingConflictRef.current = null; }, []);
  const consumePendingConflict = useCallback(() => {
    const pending = pendingConflictRef.current; pendingConflictRef.current = null; return pending;
  }, []);
  const getDraftBlueprint = useCallback(() => draftBlueprintRef.current, []);
  const clearDraftBlueprint = useCallback(() => { draftBlueprintRef.current = null; }, []);

  return {
    parsedRows, columnMapping: columnMapping ?? CANONICAL_AI_MAPPING, spreadsheetSheets, activeSheetIndex, handleSelectSpreadsheetSheet, hasMapping: columnMapping !== null,
    canOpenMapping: parsedRows.length > 0, canAdjustColumns: parsedRows.length > 0 && isTabularOfflineSource,
    pendingPasswordFile, passwordError, isReadingFile, readingStatusMessage, loadedSessionRef,
    clearPendingConflict, consumePendingConflict, getDraftBlueprint, clearDraftBlueprint,
    handleFileSelect: useCallback((file: File) => handleFilesSelect([file]), [handleFilesSelect]),
    handleFilesSelect,
    handleTextSubmit: useCallback(async (text: string) => {
      if (!text.trim()) { onError("Cole os lançamentos ou o conteúdo da fatura antes de processar."); return; }
      setIsReadingFile(true);
      try { await handleProcessInput(text.trim(), "pasted-statement.txt", null); } finally { setIsReadingFile(false); }
    }, [handleProcessInput, onError]),
    handlePasswordSubmit,
    handlePasswordCancel: useCallback(() => { pdfPasswordRef.current = null; setPendingPasswordFile(null); setPasswordError(null); }, []),
    handleCancelProcessing, handleConfirmMapping, reNormalizeLoadedEntries,
    resetIngestionSession: useCallback(() => {
      pendingConflictRef.current = null; loadedSessionRef.current = null; draftBlueprintRef.current = null; pdfPasswordRef.current = null;
      disposePdfSession(); setParsedRows([]); setSpreadsheetSheets([]); setActiveSheetIndex(0); setColumnMapping(null); setIsTabularOfflineSource(false); onStatusNotice(null); onError(null); onUploadStepRequested();
    }, [disposePdfSession, onError, onStatusNotice, onUploadStepRequested]),
  };
}
