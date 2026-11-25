import type { CommitStatementReconciliationParams, CommitStatementReconciliationResult } from "@/state";
import type {
  BlueprintOrigin,
  ChecksumGateResult,
  ColumnMapping,
  RawEntrySignHint,
  RawExtractedEntry,
  ParsedSpreadsheetSheet,
  RawParsedRow,
  SpatialPdfLine,
  StatementLayoutBlueprint,
  StatementQualityGateResult,
  StatementTransaction,
} from "@/domain/reconciliation";
import type { PdfDocumentSession } from "@/services/pdf-session";
import type { AiStatementPdfRow } from "../../../../../supabase/functions/_shared/ai-schemas";

export const MAX_STATEMENT_VISION_PAGES_OR_IMAGES = 6;
export const VISION_WAVE_SIZE = 3;
export const STATEMENT_INCREMENTAL_PAGE_SIZE = 80;

export type StatementWizardStep =
  | "upload"
  | "competence_conflict"
  | "mapping"
  | "reconcile"
  | "success";

export type ReconcileCanonicalTab = "import" | "attention" | "matched" | "app_only";
export type ReconcileSortMode = "statement" | "recent" | "amount_desc";

export interface StatementImportProgress {
  currentChunk: number;
  totalChunks: number;
  percent: number;
  processedItems: number;
  totalItems: number;
}

export interface StatementItemPatch {
  date: string;
  cleanDescription: string;
  amountCents: number;
  selectedCategoryId: string;
  installment?: { current: number; total: number };
  isRefund?: boolean;
  isTaxDeductible?: boolean;
}

export type StatementExtractionOrigin =
  | "local_verified"
  | "local_learned_blueprint"
  | "local_unverified"
  | "ai_text"
  | "ai_vision";

export interface StatementAiStatusNotice {
  kind: "quota_exceeded" | "offline" | "vision_truncated" | "chunks_truncated";
  message: string;
  quotaResetAt?: string;
}

export interface DraftStatementBlueprintSession {
  blueprint: StatementLayoutBlueprint;
  rawLines: string[];
  rows?: RawParsedRow[];
  spatialLines?: SpatialPdfLine[];
  officialTotalCents: number | null;
  cycleNetTargetCents: number | null;
  previousBalanceCents: number | null;
  paymentsCents: number | null;
}

export interface AiDetectedMetaSnapshot {
  detectedCompetenceMonth?: string | null;
  detectedDueDate?: string | null;
  detectedCardLast4?: string | null;
  detectedCardBrandOrBank?: string | null;
  detectedTotalInvoiceCents?: number | null;
}

export type LoadedStatementSource =
  | {
      kind: "pdf_text";
      text: string;
      rawFullText: string;
      pdfSession?: PdfDocumentSession;
      pdfPageTexts?: string[];
      pdfTotalPages?: number;
      buffer: ArrayBuffer;
      fileName: string;
      sha256: string | null;
      spatialTransactions?: StatementTransaction[];
      spatialRawEntries?: RawExtractedEntry[];
      defaultSignHint?: RawEntrySignHint;
      checksumGate?: ChecksumGateResult;
      spatialLinesCount?: number;
      discardedMoneyLines?: number;
      spatialRawLines?: string[];
      spatialLines?: SpatialPdfLine[];
      appliedBlueprintId?: string;
      appliedBlueprintFingerprint?: string;
      appliedBlueprintOrigin?: BlueprintOrigin;
    }
  | {
      kind: "pdf_scanned";
      pdfSession?: PdfDocumentSession;
      buffer: ArrayBuffer;
      fileName: string;
      sha256: string | null;
      fallbackRawText?: string;
      pdfPageTexts?: string[];
      pdfTotalPages?: number;
    }
  | { kind: "image"; file: File; sha256: string | null; fileName: string }
  | { kind: "spreadsheet"; buffer: ArrayBuffer; fileName: string; sha256?: string | null }
  | { kind: "binary_or_text"; content: ArrayBuffer | string; fileName: string };

export interface StatementSessionSnapshot {
  content: string | ArrayBuffer;
  rawFullText?: string;
  pdfSession?: PdfDocumentSession;
  pdfBuffer?: ArrayBuffer;
  pdfPageTexts?: string[];
  pdfTotalPages?: number;
  visionBlobs?: Array<{ blob: Blob; sha256?: string | null }>;
  visionRows?: AiStatementPdfRow[];
  rawEntries?: RawExtractedEntry[];
  defaultSignHint?: RawEntrySignHint;
  aiDetectedMeta?: AiDetectedMetaSnapshot | null;
  fileNameOrType: string;
  fileSha256?: string | null;
  spatialTransactions?: StatementTransaction[];
  checksumGate?: ChecksumGateResult;
  spatialLinesCount?: number;
  discardedMoneyLines?: number;
  spatialRawLines?: string[];
  spatialLines?: SpatialPdfLine[];
  appliedBlueprintId?: string;
  appliedBlueprintFingerprint?: string;
  appliedBlueprintOrigin?: BlueprintOrigin;
  extractedTransactions?: StatementTransaction[];
  usedAiStructurer?: boolean;
  extractionOrigin?: StatementExtractionOrigin;
  qualityGate?: StatementQualityGateResult;
  aiStatusNotice?: StatementAiStatusNotice;
  printedTotalCents?: number | null;
  rows?: RawParsedRow[];
  spreadsheetSheets?: ParsedSpreadsheetSheet[];
  activeSheetIndex?: number;
  selectedSheetName?: string | null;
  mapping?: ColumnMapping;
  shouldAutoAdvance?: boolean;
  sourceCompetenceMonth?: string;
}

export interface BillProtectionState {
  isRolledOver: boolean;
  isPaidBill: boolean;
  openBalanceCents: number;
  lockedCompetences: Set<string>;
}

export interface StatementCommitSummary {
  insertedCount: number;
  projectedCount: number;
  skippedCount: number;
  adjustedCount: number;
  movedCount: number;
  refundsCount: number;
  deletedCount: number;
  openBalanceAfterCents: number;
}

export interface StatementCommitRetryState {
  pendingChunkIndex: number;
  totalChunks: number;
  chunks: CommitStatementReconciliationParams[];
  accumulated: CommitStatementReconciliationResult;
  lastError: string;
  cardId: string;
  competenceMonth: string;
  openBalanceAfterCents: number;
  itemsForLearning: ReadonlyArray<{
    cleanDescription: string;
    merchantCleanRaw?: string;
    selectedCategoryId: string;
  }>;
  draftBlueprint: DraftStatementBlueprintSession | null;
}
