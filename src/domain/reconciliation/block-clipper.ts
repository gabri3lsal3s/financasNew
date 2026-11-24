import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import {
  classifyTransactionNature,
  cleanDescription,
  isInvoicePayment,
} from "./clean";
import { generateStatementHash } from "./hash";
import { extractInstallmentInfo } from "./installments";
import { extractBrlAmountFromLine } from "./parsers/spatial-pdf-parser";
import { normalizeDateToISO, parseAmountToCents } from "./parsers/type-sniffer";
import type { StatementTransaction, StatementTransactionNature } from "./types";

const CLIPPER_DATE_REGEX =
  /\b(?:(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?|(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*)\b/i;

export interface ClipperLinePreview {
  lineIndex: number;
  rawText: string;
  isCandidate: boolean;
  parsedTransaction: StatementTransaction | null;
}

export interface ClippedSelectionResult {
  transactions: StatementTransaction[];
  selectedLineIndices: number[];
  selectedNetCents: number;
}

function parseSingleClipperLine(
  rawLine: string,
  lineIndex: number,
  params: { cardId: string; competenceMonth: string },
): StatementTransaction | null {
  const text = rawLine.trim();
  if (!text) return null;

  const dateMatch = CLIPPER_DATE_REGEX.exec(text);
  const amountExtracted = extractBrlAmountFromLine(text);
  if (!dateMatch || !amountExtracted) return null;

  const compYear =
    Number.parseInt(params.competenceMonth.slice(0, 4), 10) || new Date().getFullYear();
  const compMonth = Number.parseInt(params.competenceMonth.slice(5, 7), 10) || undefined;
  const dateIso = normalizeDateToISO(dateMatch[0], compYear, compMonth);
  if (!dateIso) return null;

  const parsedAmt = parseAmountToCents(amountExtracted.valueStr);
  if (!parsedAmt || parsedAmt.amountCents === 0) return null;

  const suffixLower = amountExtracted.suffix?.toLowerCase();
  const isCreditSuffix = suffixLower === "c" || parsedAmt.isCreditSuffix;
  const isDebitSuffix = suffixLower === "d" || suffixLower === "-" || parsedAmt.isDebitSuffix;
  const isCredit = Boolean(isCreditSuffix || (parsedAmt.isNegative && !isDebitSuffix));

  const rawDesc = text
    .replace(dateMatch[0], "")
    .replace(amountExtracted.fullMatch, "")
    .replace(/\b[cd]\b/i, "")
    .trim();
  if (!rawDesc) return null;

  const isPayment = isInvoicePayment(rawDesc, isCredit);
  const isRefund = isCredit && !isPayment;
  const cleanDesc = cleanDescription(rawDesc) || rawDesc;
  const installment = extractInstallmentInfo(rawDesc, dateIso);

  const APP_START_DATE = "2026-01-01";
  let effectiveDate = dateIso;
  let originalDate: string | undefined;
  if (dateIso < APP_START_DATE) {
    originalDate = dateIso;
    effectiveDate = APP_START_DATE;
  }

  const hashDate = originalDate || effectiveDate;
  const statementHash = generateStatementHash({
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    date: hashDate,
    amountCents: parsedAmt.amountCents,
    cleanDescription: cleanDesc,
    occurrenceIndex: 0,
  });

  const inferredChargeKind = inferChargeKindFromDescription(text);
  const nature: StatementTransactionNature = classifyTransactionNature({
    rawDescription: text,
    isCredit,
    isPayment,
    isRefund,
    hasChargeKind: inferredChargeKind != null && inferredChargeKind !== "regular",
  });

  return {
    id: `clip-${lineIndex}`,
    index: lineIndex,
    occurrenceIndex: 0,
    date: effectiveDate,
    originalDate,
    nature,
    rawDescription: text,
    cleanDescription: cleanDesc,
    amountCents: parsedAmt.amountCents,
    isRefund,
    isPayment,
    installment,
    statementHash,
    inferredChargeKind,
  };
}

/**
 * Converte as linhas brutas do arquivo em pré-visualizações estruturadas para o
 * `StatementBlockClipperStep`, identificando quais linhas possuem Data + Valor válidos.
 */
export function buildClipperLinePreviews(params: {
  rawLines: readonly string[];
  cardId: string;
  competenceMonth: string;
}): ClipperLinePreview[] {
  const { rawLines, cardId, competenceMonth } = params;
  const previews: ClipperLinePreview[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawText = (rawLines[i] ?? "").trim();
    if (!rawText) continue;

    const parsed = parseSingleClipperLine(rawText, i, { cardId, competenceMonth });

    previews.push({
      lineIndex: i,
      rawText,
      isCandidate: parsed !== null,
      parsedTransaction: parsed,
    });
  }

  return previews;
}

/**
 * Calcula ao vivo as transações selecionadas dentro do intervalo `[startIndex..endIndex]`,
 * respeitando exclusões pontuais (`excludedLineIndices`), com soma líquida em centavos inteiros.
 */
export function computeClippedSelection(params: {
  previews: readonly ClipperLinePreview[];
  startIndex: number | null;
  endIndex: number | null;
  excludedLineIndices: ReadonlySet<number>;
  cardId: string;
  competenceMonth: string;
}): ClippedSelectionResult {
  const {
    previews,
    startIndex,
    endIndex,
    excludedLineIndices,
    cardId,
    competenceMonth,
  } = params;

  if (startIndex === null) {
    return { transactions: [], selectedLineIndices: [], selectedNetCents: 0 };
  }

  const effectiveEnd = endIndex === null ? startIndex : endIndex;
  const rangeMin = Math.min(startIndex, effectiveEnd);
  const rangeMax = Math.max(startIndex, effectiveEnd);

  const transactions: StatementTransaction[] = [];
  const selectedLineIndices: number[] = [];
  const occurrenceCounter = new Map<string, number>();
  let selectedNetCents = 0;
  let txIndex = 0;

  for (const preview of previews) {
    if (preview.lineIndex < rangeMin || preview.lineIndex > rangeMax) continue;
    if (excludedLineIndices.has(preview.lineIndex)) continue;
    if (!preview.parsedTransaction) continue;

    const baseTx = preview.parsedTransaction;
    const hashDate = baseTx.originalDate || baseTx.date;
    const occKey = `${hashDate}|${baseTx.amountCents}|${baseTx.cleanDescription.toLowerCase()}`;
    const occIndex = occurrenceCounter.get(occKey) ?? 0;
    occurrenceCounter.set(occKey, occIndex + 1);

    const statementHash = generateStatementHash({
      cardId,
      competenceMonth,
      date: hashDate,
      amountCents: baseTx.amountCents,
      cleanDescription: baseTx.cleanDescription,
      occurrenceIndex: occIndex,
    });

    const normalizedTx: StatementTransaction = {
      ...baseTx,
      id: `stmt-${txIndex}`,
      index: txIndex++,
      occurrenceIndex: occIndex,
      statementHash,
    };

    transactions.push(normalizedTx);
    selectedLineIndices.push(preview.lineIndex);

    if (!normalizedTx.isPayment && normalizedTx.nature !== "invoice_payment") {
      if (normalizedTx.isRefund || normalizedTx.nature === "refund") {
        selectedNetCents -= normalizedTx.amountCents;
      } else {
        selectedNetCents += normalizedTx.amountCents;
      }
    }
  }

  return {
    transactions,
    selectedLineIndices,
    selectedNetCents,
  };
}
