import type { ColumnMapping, RawParsedRow, StatementTransaction } from "../types";
import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import {
  classifyTransactionNature,
  cleanDescription,
  isInvoicePayment,
  isLikelyIncomeDescription,
  isPaymentOrSettlement,
  isStatementNoiseOrSummary,
  isSubcardHeader,
} from "../clean";
import { extractInstallmentInfo } from "../installments";
import { generateStatementHash } from "../hash";
import { normalizeDateToISO, parseAmountToCents, sniffColumnMapping } from "./type-sniffer";
import { decodeBufferToString, parseCsvToRows } from "./csv-parser";
import { parseOfxToTransactions } from "./ofx-parser";
import { parseTextToRows } from "./text-parser";

export * from "./type-sniffer";
export * from "./magic-bytes";
export * from "./csv-parser";
export * from "./ofx-parser";
export * from "./text-parser";
export * from "./spreadsheet-parser";
export * from "./spatial-pdf-parser";
export * from "./line-curator";

function hasExplicitYearToken(rawDate: string): boolean {
  const t = rawDate.trim();
  if (/\b\d{4}\b/.test(t)) return true;
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2}$/.test(t)) return true;
  if (/[a-zç]{3,9}\s*(?:de\s+|[/-])?\s*\d{2,4}$/i.test(t)) return true;
  return false;
}

function resolveDateWithCompetenceBoundary(rawDate: string, competenceMonth: string): string | null {
  const compYear = Number.parseInt(competenceMonth.slice(0, 4), 10) || new Date().getFullYear();
  const compMonth = Number.parseInt(competenceMonth.slice(5, 7), 10);
  const hasYear = hasExplicitYearToken(rawDate);
  const initialIso = normalizeDateToISO(
    rawDate,
    compYear,
    !hasYear && Number.isFinite(compMonth) ? compMonth : undefined,
  );
  if (!initialIso) return null;

  return initialIso;
}

/**
 * Detecta se a coluna monetária do arquivo segue padrão decimal com ponto (ex.: `12.50`, `45.99`)
 * sem decimais com vírgula, para proteger números como `1.500` em planilhas/CSVs internacionais.
 */
function inferPreferDotDecimal(dataRows: RawParsedRow[], mapping: ColumnMapping): boolean {
  let dotDecimalCount = 0;
  let commaDecimalCount = 0;
  const colsToInspect =
    mapping.debitColIndex !== undefined && mapping.creditColIndex !== undefined
      ? [mapping.debitColIndex, mapping.creditColIndex]
      : [mapping.amountColIndex];

  for (const row of dataRows.slice(0, 40)) {
    for (const colIdx of colsToInspect) {
      const cell = (row.cells[colIdx] ?? "").trim();
      if (!cell) continue;
      if (/R\$|\bBRL\b/i.test(cell)) return false;
      if (/\d,\d{1,2}\s*(?:[dDcC+-])?$/.test(cell)) {
        commaDecimalCount++;
      } else if (/\d\.\d{1,2}\s*(?:[dDcC+-])?$/.test(cell) && !/\d,\d/.test(cell)) {
        dotDecimalCount++;
      }
    }
  }

  return dotDecimalCount > 0 && commaDecimalCount === 0;
}

/**
 * Infere a convenção de polaridade de sinal do arquivo tabular:
 * Se a maioria das compras regulares vier com sinal negativo e as quitações com sinal positivo,
 * inverte a interpretação padrão para que negativo = compra e positivo = crédito/estorno.
 */
function inferNegativeMeansPurchase(
  dataRows: RawParsedRow[],
  mapping: ColumnMapping,
  preferDotDecimal: boolean,
): boolean {
  if (mapping.debitColIndex !== undefined || mapping.typeColIndex !== undefined) {
    return false;
  }

  let negPurchaseCount = 0;
  let posPurchaseCount = 0;
  let posPaymentCount = 0;
  let negPaymentCount = 0;

  for (const row of dataRows) {
    const rawDesc = row.cells[mapping.descriptionColIndex] ?? "";
    const rawAmt = row.cells[mapping.amountColIndex] ?? "";
    if (!rawDesc.trim() || isStatementNoiseOrSummary(rawDesc) || isSubcardHeader(rawDesc)) {
      continue;
    }
    const parsedAmt = parseAmountToCents(rawAmt, { preferDotDecimal });
    if (!parsedAmt || parsedAmt.amountCents === 0) continue;
    if (parsedAmt.isCreditSuffix || parsedAmt.isDebitSuffix) continue;

    const isUnconditionalPay = isInvoicePayment(rawDesc, false);
    if (isUnconditionalPay) {
      if (parsedAmt.isNegative) negPaymentCount++;
      else posPaymentCount++;
    } else {
      if (parsedAmt.isNegative) negPurchaseCount++;
      else posPurchaseCount++;
    }
  }

  if (negPurchaseCount > posPurchaseCount && negPurchaseCount >= 1) {
    // Confirma que não há pagamentos negativos contradizendo
    if (posPaymentCount >= negPaymentCount) {
      return true;
    }
  }
  return false;
}

/**
 * Converte linhas tabulares parseadas em transações normalizadas de extrato.
 */
export function buildTransactionsFromRows(
  rows: RawParsedRow[],
  mapping: ColumnMapping,
  params: { cardId: string; competenceMonth: string },
): StatementTransaction[] {
  const transactions: StatementTransaction[] = [];
  const occurrenceCounter = new Map<string, number>();
  let index = 0;

  const dataRows = rows.slice(mapping.startRowIndex);
  const preferDotDecimal = inferPreferDotDecimal(dataRows, mapping);
  const negativeMeansPurchase = inferNegativeMeansPurchase(dataRows, mapping, preferDotDecimal);

  for (const row of dataRows) {
    const rawDate = row.cells[mapping.dateColIndex] ?? "";
    const rawDesc = row.cells[mapping.descriptionColIndex] ?? "";

    const date = resolveDateWithCompetenceBoundary(rawDate, params.competenceMonth);
    if (!date || !rawDesc.trim()) {
      continue;
    }

    // Descarte estrutural de saldos, totais de fatura, subtotais e cabeçalhos de subcartões
    if (isStatementNoiseOrSummary(rawDesc) || isSubcardHeader(rawDesc)) {
      continue;
    }

    let amountCents: number;
    let isCredit: boolean;

    if (mapping.debitColIndex !== undefined && mapping.creditColIndex !== undefined) {
      const rawDebit = row.cells[mapping.debitColIndex] ?? "";
      const rawCredit = row.cells[mapping.creditColIndex] ?? "";
      const parsedDebit = parseAmountToCents(rawDebit, { preferDotDecimal });
      const parsedCredit = parseAmountToCents(rawCredit, { preferDotDecimal });

      if (parsedDebit && parsedDebit.amountCents > 0) {
        amountCents = parsedDebit.amountCents;
        isCredit = false;
      } else if (parsedCredit && parsedCredit.amountCents > 0) {
        amountCents = parsedCredit.amountCents;
        isCredit = true;
      } else {
        continue;
      }
    } else {
      const rawAmt = row.cells[mapping.amountColIndex] ?? "";
      const parsedAmt = parseAmountToCents(rawAmt, { preferDotDecimal });
      if (!parsedAmt) {
        continue;
      }

      amountCents = parsedAmt.amountCents;

      if (parsedAmt.isCreditSuffix) {
        isCredit = true;
      } else if (parsedAmt.isDebitSuffix) {
        isCredit = false;
      } else if (mapping.typeColIndex !== undefined) {
        const typeVal = (row.cells[mapping.typeColIndex] ?? "").trim().toLowerCase();
        if (
          typeVal === "c" ||
          typeVal === "credito" ||
          typeVal === "crédito" ||
          typeVal === "entrada" ||
          typeVal === "+"
        ) {
          isCredit = true;
        } else if (
          typeVal === "d" ||
          typeVal === "debito" ||
          typeVal === "débito" ||
          typeVal === "saida" ||
          typeVal === "saída" ||
          typeVal === "-"
        ) {
          isCredit = false;
        } else {
          isCredit = parsedAmt.isNegative;
        }
      } else if (negativeMeansPurchase) {
        isCredit = !parsedAmt.isNegative;
      } else if (!parsedAmt.isNegative) {
        isCredit = isLikelyIncomeDescription(row.rawText);
      } else {
        isCredit = parsedAmt.isNegative;
      }
    }

    const isPayment = isPaymentOrSettlement(rawDesc, isCredit);
    const isRefund = isCredit && !isPayment;

    // rawDescription preserva o texto original da linha para que as palavras-chave
    // de renda estejam disponíveis ao motor de classificação no reconciliador.
    const rawDescForTx = row.rawText || rawDesc;
    const cleanDesc = cleanDescription(rawDesc) || rawDesc.trim() || "Transação";
    const installment = extractInstallmentInfo(rawDesc, date);

    // Clamping de datas anteriores a 2026-01-01 preservando a data original no hash
    const APP_START_DATE = "2026-01-01";
    let effectiveDate = date;
    let originalDate: string | undefined;
    if (date < APP_START_DATE) {
      originalDate = date;
      effectiveDate = APP_START_DATE;
    }

    const hashDate = originalDate || effectiveDate;
    const occKey = `${hashDate}|${amountCents}|${cleanDesc.toLowerCase()}`;
    const occIndex = occurrenceCounter.get(occKey) ?? 0;
    occurrenceCounter.set(occKey, occIndex + 1);

    const statementHash = generateStatementHash({
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
      date: hashDate,
      amountCents,
      cleanDescription: cleanDesc,
      occurrenceIndex: occIndex,
    });

    const inferredChargeKind = inferChargeKindFromDescription(rawDescForTx);
    const nature = classifyTransactionNature({
      rawDescription: rawDescForTx,
      isCredit,
      isPayment,
      isRefund,
      hasChargeKind: inferredChargeKind != null && inferredChargeKind !== "regular",
    });

    transactions.push({
      id: `stmt-${index}`,
      index: index++,
      occurrenceIndex: occIndex,
      date: effectiveDate,
      originalDate,
      nature,
      rawDescription: rawDescForTx,
      cleanDescription: cleanDesc,
      amountCents,
      isRefund,
      isPayment,
      installment,
      statementHash,
      inferredChargeKind,
    });
  }

  return transactions;
}

/**
 * Hub universal de parsing a partir de arquivo binário ou string de texto.
 */
export function parseStatementInput(
  input: string | ArrayBuffer,
  fileNameOrType: string,
  params: { cardId: string; competenceMonth: string },
): {
  transactions: StatementTransaction[];
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  isOfx: boolean;
} {
  const isBuffer = typeof input !== "string";
  const textContent = isBuffer ? decodeBufferToString(input) : input;
  const lowerName = fileNameOrType.toLowerCase();

  // 1. Arquivo OFX
  const headSample = textContent.slice(0, 4096).replace(/^[\uFEFF\uFFFE\s]+/, "");
  if (
    lowerName.endsWith(".ofx") ||
    lowerName.endsWith(".qfx") ||
    /^OFXHEADER\s*:/i.test(headSample) ||
    /<OFX[\s>]/i.test(headSample) ||
    /<STMTTRN[\s>]/i.test(textContent)
  ) {
    const transactions = parseOfxToTransactions(textContent, params);
    return {
      transactions,
      rows: [],
      mapping: {
        dateColIndex: 0,
        descriptionColIndex: 1,
        amountColIndex: 2,
        hasHeader: false,
        startRowIndex: 0,
      },
      isOfx: true,
    };
  }

  // 2. CSV/TSV ou Texto tabular
  const startYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10) || new Date().getFullYear();
  const isPdfText = lowerName.endsWith(".pdf") || lowerName.includes("application/pdf");
  const rows =
    lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")
      ? parseCsvToRows(textContent)
      : parseTextToRows(textContent, startYear, {
          mode: isPdfText ? "strict_statement" : "auto",
        });
  const mapping = sniffColumnMapping(rows);
  const transactions = buildTransactionsFromRows(rows, mapping, params);

  return {
    transactions,
    rows,
    mapping,
    isOfx: false,
  };
}
