import {
  normalizeRawEntries,
  type ColumnMapping,
  type RawExtractedEntry,
  type RawParsedRow,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { formatAiQuotaResetHint } from "@/services/ai-assistant";
import type { AiStatementPdfRow } from "../../../../../supabase/functions/_shared/ai-schemas";
import {
  MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
  type AiDetectedMetaSnapshot,
  type StatementAiStatusNotice,
} from "./statement-import-types";

export const CANONICAL_AI_MAPPING: ColumnMapping = {
  dateColIndex: 0,
  descriptionColIndex: 1,
  amountColIndex: 2,
  hasHeader: false,
  startRowIndex: 0,
};

export type MergedAiMeta = AiDetectedMetaSnapshot;

export function mergeAiMetaFields(target: MergedAiMeta, incoming: MergedAiMeta): void {
  if (!target.detectedCompetenceMonth && incoming.detectedCompetenceMonth) {
    target.detectedCompetenceMonth = incoming.detectedCompetenceMonth;
  }
  if (!target.detectedDueDate && incoming.detectedDueDate) {
    target.detectedDueDate = incoming.detectedDueDate;
  }
  if (!target.detectedCardLast4 && incoming.detectedCardLast4) {
    target.detectedCardLast4 = incoming.detectedCardLast4;
  }
  if (!target.detectedCardBrandOrBank && incoming.detectedCardBrandOrBank) {
    target.detectedCardBrandOrBank = incoming.detectedCardBrandOrBank;
  }
  if (
    target.detectedTotalInvoiceCents == null &&
    incoming.detectedTotalInvoiceCents != null
  ) {
    target.detectedTotalInvoiceCents = incoming.detectedTotalInvoiceCents;
  }
}

export function hasAnyMergedAiMeta(meta: MergedAiMeta): boolean {
  return Boolean(
    meta.detectedCompetenceMonth ||
      meta.detectedDueDate ||
      meta.detectedCardLast4 ||
      meta.detectedCardBrandOrBank ||
      meta.detectedTotalInvoiceCents != null,
  );
}

export function buildAiStatusNoticeFromReason(
  reason: string,
  quotaResetAt?: string,
): StatementAiStatusNotice | undefined {
  if (reason === "quota_exceeded") {
    return {
      kind: "quota_exceeded",
      quotaResetAt,
      message: `Limite de IA atingido. Sua cota renova em ${formatAiQuotaResetHint(quotaResetAt)}.`,
    };
  }
  if (reason === "offline") {
    return {
      kind: "offline",
      message: "Sem conexão no momento. A fatura foi processada apenas localmente.",
    };
  }
  return undefined;
}

const VISION_CANDIDATE_DATE_REGEX =
  /(?:\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b)/i;
const VISION_CANDIDATE_MONEY_REGEX = /(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/;
const VISION_CANDIDATE_SECTION_REGEX =
  /\b(?:lan[çc]amentos|compras|detalhamento|extrato\s+referente|hist[óo]rico\s+de\s+transa[çc][õo]es|despesas\s+do\s+cart[ãa]o)\b/i;

const VISION_SUMMARY_ONLY_LINE_REGEX =
  /\b(?:total\s+(?:da\s+fatura|a\s+pagar|anterior|de\s+compras|do\s+cart[aã]o)|pagamento\s+m[ií]nimo|dispon[ií]vel|limite|per[ií]odo\s+de\s+compras|hist[oó]rico\s+de\s+fatura)\b/i;

function scorePdfPageForVision(pageText: string): number {
  const lines = pageText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let txLineCount = 0;
  for (const line of lines) {
    if (VISION_SUMMARY_ONLY_LINE_REGEX.test(line)) continue;
    if (VISION_CANDIDATE_DATE_REGEX.test(line) && VISION_CANDIDATE_MONEY_REGEX.test(line)) {
      txLineCount++;
    }
  }
  const hasSection = VISION_CANDIDATE_SECTION_REGEX.test(pageText);
  const isSummaryCover = /\b(?:resumo\s+da\s+fatura|informa[çc][õo]es\s+essenciais)\b/i.test(pageText);
  let score = txLineCount * 10 + (hasSection ? 8 : 0);
  if (isSummaryCover && txLineCount < 2) {
    score -= 12;
  }
  return score;
}

export function selectCandidatePdfVisionPagesWithOverflow(
  pageTexts: readonly string[],
  totalPages?: number,
): { pages: number[]; totalCandidateCount: number; hasOverflow: boolean } {
  const effectiveTotal = Math.max(
    1,
    totalPages && totalPages > 0 ? totalPages : pageTexts.length || 1,
  );
  const scoredCandidates: Array<{ page: number; score: number }> = [];

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i] ?? "";
    const hasDate = VISION_CANDIDATE_DATE_REGEX.test(pageText);
    const hasMoney = VISION_CANDIDATE_MONEY_REGEX.test(pageText);
    const hasSection = VISION_CANDIDATE_SECTION_REGEX.test(pageText);
    if ((hasDate && hasMoney) || (hasSection && (hasDate || hasMoney))) {
      scoredCandidates.push({
        page: i + 1,
        score: scorePdfPageForVision(pageText),
      });
    }
  }

  if (scoredCandidates.length > 0) {
    scoredCandidates.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.page - b.page));
    const orderedPages = scoredCandidates.map((c) => c.page);
    return {
      pages: orderedPages.slice(0, MAX_STATEMENT_VISION_PAGES_OR_IMAGES),
      totalCandidateCount: orderedPages.length,
      hasOverflow: orderedPages.length > MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
    };
  }

  const fallbackLimit = Math.min(MAX_STATEMENT_VISION_PAGES_OR_IMAGES, effectiveTotal);
  return {
    pages: Array.from({ length: fallbackLimit }, (_, idx) => idx + 1),
    totalCandidateCount: effectiveTotal,
    hasOverflow: effectiveTotal > MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
  };
}

export function selectCandidatePdfVisionPages(
  pageTexts: readonly string[],
  totalPages?: number,
): number[] {
  return selectCandidatePdfVisionPagesWithOverflow(pageTexts, totalPages).pages;
}

function formatStatementAmountCell(amountCents: number): string {
  const absFormatted = (Math.abs(amountCents) / 100).toFixed(2).replace(".", ",");
  return amountCents < 0 ? `-${absFormatted}` : absFormatted;
}

export function convertAiStatementRowsToRawParsedRows(
  rows: readonly AiStatementPdfRow[],
): RawParsedRow[] {
  return rows.map((row, index) => {
    const hasInstallment =
      typeof row.installmentCurrent === "number" &&
      typeof row.installmentTotal === "number" &&
      row.installmentTotal > 1;
    const alreadyHasInstallmentTag = /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(row.description);
    const descriptionCell =
      hasInstallment && !alreadyHasInstallmentTag
        ? `${row.description.trim()} ${row.installmentCurrent}/${row.installmentTotal}`
        : row.description.trim();
    const signedCents =
      row.entryType === "refund" || row.entryType === "payment"
        ? -Math.abs(row.amountCents)
        : row.amountCents;
    const amountCell = formatStatementAmountCell(signedCents);
    return {
      rowIndex: index,
      rawText: `${row.date}\t${descriptionCell}\t${amountCell}`,
      cells: [row.date, descriptionCell, amountCell],
    };
  });
}

export function buildTransactionsFromAiRows(
  aiRowsData: readonly AiStatementPdfRow[],
  params: { cardId: string; competenceMonth: string; closingDay?: number | null },
): {
  rows: RawParsedRow[];
  transactions: StatementTransaction[];
  rawEntries: RawExtractedEntry[];
  mapping: ColumnMapping;
} {
  const rawRows = convertAiStatementRowsToRawParsedRows(aiRowsData);
  const rawEntries: RawExtractedEntry[] = aiRowsData.map((row, idx) => {
    const hasInstallment =
      typeof row.installmentCurrent === "number" &&
      typeof row.installmentTotal === "number" &&
      row.installmentTotal > 1;
    const installmentTag =
      hasInstallment && !/\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(row.description)
        ? ` ${row.installmentCurrent}/${row.installmentTotal}`
        : "";
    const merchantRaw = `${row.description.trim()}${installmentTag}`;

    return {
      sourceIndex: idx,
      rawDate: row.date.trim(),
      merchantRaw,
      rawLine: rawRows[idx]?.rawText || merchantRaw,
      amountCents: Math.abs(row.amountCents),
      isNegative: row.entryType === "refund" || row.entryType === "payment",
      signHint: "positive_purchase",
      dateFormatHint: "ymd",
      explicitEntryType: row.entryType ?? undefined,
      explicitInstallment: hasInstallment
        ? { current: row.installmentCurrent!, total: row.installmentTotal! }
        : undefined,
      sourceKind: "ai_row",
    };
  });

  const transactions = normalizeRawEntries(rawEntries, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    closingDay: params.closingDay,
    defaultSignHint: "positive_purchase",
  });

  return { rows: rawRows, transactions, rawEntries, mapping: CANONICAL_AI_MAPPING };
}

function buildVisionRowDedupKey(row: AiStatementPdfRow): string {
  const normalizedDesc = row.description
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return `${row.date.trim()}|${row.amountCents}|${normalizedDesc}`;
}

export function deduplicateConsecutiveVisionRows(
  pagesRows: readonly (readonly AiStatementPdfRow[])[],
): AiStatementPdfRow[] {
  const merged: AiStatementPdfRow[] = [];
  for (const page of pagesRows) {
    if (page.length === 0) continue;
    if (merged.length === 0) {
      merged.push(...page);
      continue;
    }
    const maxOverlap = Math.min(merged.length, page.length, 6);
    let overlapLen = 0;
    for (let k = maxOverlap; k >= 1; k--) {
      let allMatch = true;
      for (let i = 0; i < k; i++) {
        if (
          buildVisionRowDedupKey(merged[merged.length - k + i]!) !==
          buildVisionRowDedupKey(page[i]!)
        ) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        overlapLen = k;
        break;
      }
    }
    merged.push(...page.slice(overlapLen));
  }
  return merged;
}
