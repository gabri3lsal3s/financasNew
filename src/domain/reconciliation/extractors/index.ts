import type {
  ColumnMapping,
  RawEntrySignHint,
  RawExtractedEntry,
  RawParsedRow,
  StatementTransaction,
} from "../contracts";
import { isInvoicePayment, isStatementNoiseOrSummary, isSubcardHeader } from "../clean";
import { normalizeRawEntries } from "../normalize-entries";
import { parseAmountToCents, sniffColumnMapping } from "./type-sniffer";
import { decodeBufferToString, parseCsvToRows } from "./csv-extractor";
import { extractRawEntriesFromOfx, parseOfxToTransactions } from "./ofx-extractor";
import { parseTextToRows } from "./text-extractor";

export * from "./type-sniffer";
export * from "./magic-bytes";
export * from "./csv-extractor";
export * from "./ofx-extractor";
export * from "./text-extractor";
export * from "./biff8-xls-extractor";
export * from "./spreadsheet-extractor";
export * from "./spatial-pdf-extractor";
export * from "./issuer-profiles";

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
 * retorna `true` (`negative_purchase`) para inverter a interpretação padrão.
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

    if (isInvoicePayment(rawDesc, false)) {
      if (parsedAmt.isNegative) negPaymentCount++;
      else posPaymentCount++;
    } else if (parsedAmt.isNegative) {
      negPurchaseCount++;
    } else {
      posPurchaseCount++;
    }
  }

  if (negPurchaseCount > posPurchaseCount && negPurchaseCount >= 1) {
    if (posPaymentCount >= negPaymentCount) {
      return true;
    }
  }
  return false;
}

/**
 * Extrator tabular "burro" (Estágio 0): converte linhas tabulares + mapeamento de colunas
 * exclusivamente em `RawExtractedEntry[]`, delegando datas, parcelas, encargos e hashes
 * ao Normalizador Canônico (`normalizeRawEntries`).
 */
export function extractRawEntriesFromTabularRows(
  rows: RawParsedRow[],
  mapping: ColumnMapping,
  sourceKind: RawExtractedEntry["sourceKind"] = "csv",
): { entries: RawExtractedEntry[]; defaultSignHint: RawEntrySignHint } {
  const dataRows = rows.slice(mapping.startRowIndex);
  const preferDotDecimal = inferPreferDotDecimal(dataRows, mapping);
  const negativeMeansPurchase = inferNegativeMeansPurchase(dataRows, mapping, preferDotDecimal);
  const defaultSignHint: RawEntrySignHint = negativeMeansPurchase
    ? "negative_purchase"
    : "positive_purchase";

  const entries: RawExtractedEntry[] = [];

  for (const row of dataRows) {
    const rawDate = (row.cells[mapping.dateColIndex] ?? "").trim();
    const rawDesc = row.cells[mapping.descriptionColIndex] ?? "";
    if (!rawDate || !rawDesc.trim()) continue;
    if (isStatementNoiseOrSummary(rawDesc) || isSubcardHeader(rawDesc)) continue;

    const rawLine = row.rawText || rawDesc;

    if (mapping.debitColIndex !== undefined && mapping.creditColIndex !== undefined) {
      const rawDebit = row.cells[mapping.debitColIndex] ?? "";
      const rawCredit = row.cells[mapping.creditColIndex] ?? "";
      const parsedDebit = parseAmountToCents(rawDebit, { preferDotDecimal });
      const parsedCredit = parseAmountToCents(rawCredit, { preferDotDecimal });

      if (parsedDebit && parsedDebit.amountCents > 0) {
        entries.push({
          rawDate,
          merchantRaw: rawDesc,
          rawLine,
          amountCents: parsedDebit.amountCents,
          isNegative: false,
          isDebitSuffix: true,
          signHint: "positive_purchase",
          sourceIndex: row.rowIndex,
          sourceKind,
        });
      } else if (parsedCredit && parsedCredit.amountCents > 0) {
        entries.push({
          rawDate,
          merchantRaw: rawDesc,
          rawLine,
          amountCents: parsedCredit.amountCents,
          isNegative: true,
          isCreditSuffix: true,
          signHint: "positive_purchase",
          sourceIndex: row.rowIndex,
          sourceKind,
        });
      }
      continue;
    }

    const rawAmt = row.cells[mapping.amountColIndex] ?? "";
    const parsedAmt = parseAmountToCents(rawAmt, { preferDotDecimal });
    if (!parsedAmt || parsedAmt.amountCents <= 0) continue;

    let isCreditSuffix = parsedAmt.isCreditSuffix;
    let isDebitSuffix = parsedAmt.isDebitSuffix;
    let signHint: RawEntrySignHint = defaultSignHint;

    if (!isCreditSuffix && !isDebitSuffix && mapping.typeColIndex !== undefined) {
      const typeVal = (row.cells[mapping.typeColIndex] ?? "").trim().toLowerCase();
      if (
        typeVal === "c" ||
        typeVal === "credito" ||
        typeVal === "crédito" ||
        typeVal === "entrada" ||
        typeVal === "+"
      ) {
        isCreditSuffix = true;
      } else if (
        typeVal === "d" ||
        typeVal === "debito" ||
        typeVal === "débito" ||
        typeVal === "saida" ||
        typeVal === "saída" ||
        typeVal === "-"
      ) {
        isDebitSuffix = true;
      } else {
        signHint = "positive_purchase";
      }
    }

    entries.push({
      rawDate,
      merchantRaw: rawDesc,
      rawLine,
      amountCents: parsedAmt.amountCents,
      isNegative: parsedAmt.isNegative,
      isCreditSuffix,
      isDebitSuffix,
      signHint,
      sourceIndex: row.rowIndex,
      sourceKind,
    });
  }

  return { entries, defaultSignHint };
}

/**
 * Converte linhas tabulares parseadas em transações normalizadas de extrato
 * usando o Normalizador Canônico Único (`normalizeRawEntries`).
 */
export function buildTransactionsFromRows(
  rows: RawParsedRow[],
  mapping: ColumnMapping,
  params: { cardId: string; competenceMonth: string; closingDay?: number | null },
  sourceKind: RawExtractedEntry["sourceKind"] = "csv",
): StatementTransaction[] {
  const { entries, defaultSignHint } = extractRawEntriesFromTabularRows(
    rows,
    mapping,
    sourceKind,
  );
  return normalizeRawEntries(entries, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    closingDay: params.closingDay,
    defaultSignHint,
  });
}

/**
 * Hub universal de parsing a partir de arquivo binário ou string de texto.
 */
export function parseStatementInput(
  input: string | ArrayBuffer,
  fileNameOrType: string,
  params: { cardId: string; competenceMonth: string; closingDay?: number | null },
): {
  transactions: StatementTransaction[];
  rawEntries: RawExtractedEntry[];
  defaultSignHint: RawEntrySignHint;
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  isOfx: boolean;
} {
  const isBuffer = typeof input !== "string";
  const textContent = isBuffer ? decodeBufferToString(input) : input;
  const lowerName = fileNameOrType.toLowerCase();

  const headSample = textContent.slice(0, 4096).replace(/^[\uFEFF\uFFFE\s]+/, "");
  if (
    lowerName.endsWith(".ofx") ||
    lowerName.endsWith(".qfx") ||
    /^OFXHEADER\s*:/i.test(headSample) ||
    /<OFX[\s>]/i.test(headSample) ||
    /<STMTTRN[\s>]/i.test(textContent)
  ) {
    const rawEntries = extractRawEntriesFromOfx(textContent);
    const transactions =
      rawEntries.length > 0
        ? normalizeRawEntries(rawEntries, {
            cardId: params.cardId,
            competenceMonth: params.competenceMonth,
            closingDay: params.closingDay,
          })
        : parseOfxToTransactions(textContent, params);
    return {
      transactions,
      rawEntries,
      defaultSignHint: "auto",
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

  const startYear =
    Number.parseInt(params.competenceMonth.slice(0, 4), 10) || new Date().getFullYear();
  const isPdfText = lowerName.endsWith(".pdf") || lowerName.includes("application/pdf");
  const isCsv = lowerName.endsWith(".csv") || lowerName.endsWith(".tsv");
  const sourceKind: RawExtractedEntry["sourceKind"] = isCsv ? "csv" : "text";
  const rows = isCsv
    ? parseCsvToRows(textContent)
    : parseTextToRows(textContent, startYear, {
        mode: isPdfText ? "strict_statement" : "auto",
      });
  const mapping = sniffColumnMapping(rows);
  const { entries: rawEntries, defaultSignHint } = extractRawEntriesFromTabularRows(
    rows,
    mapping,
    sourceKind,
  );
  const transactions = normalizeRawEntries(rawEntries, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    closingDay: params.closingDay,
    defaultSignHint,
  });

  return {
    transactions,
    rawEntries,
    defaultSignHint,
    rows,
    mapping,
    isOfx: false,
  };
}
