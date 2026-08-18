import type { ColumnMapping, RawParsedRow, StatementTransaction } from "../types";
import { cleanDescription, isLikelyIncomeDescription, isPaymentOrSettlement } from "../clean";
import { extractInstallmentInfo } from "../installments";
import { generateStatementHash } from "../hash";
import { normalizeDateToISO, parseAmountToCents, sniffColumnMapping } from "./type-sniffer";
import { decodeBufferToString, parseCsvToRows } from "./csv-parser";
import { parseOfxToTransactions } from "./ofx-parser";
import { parseTextToRows } from "./text-parser";

export * from "./type-sniffer";
export * from "./csv-parser";
export * from "./ofx-parser";
export * from "./text-parser";

/**
 * Converte linhas tabulares parseadas em transações normalizadas de extrato.
 */
export function buildTransactionsFromRows(
  rows: RawParsedRow[],
  mapping: ColumnMapping,
  params: { cardId: string; competenceMonth: string },
): StatementTransaction[] {
  const transactions: StatementTransaction[] = [];
  const startYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10) || new Date().getFullYear();

  const occurrenceCounter = new Map<string, number>();
  let index = 0;

  const dataRows = rows.slice(mapping.startRowIndex);

  for (const row of dataRows) {
    const rawDate = row.cells[mapping.dateColIndex] ?? "";
    const rawDesc = row.cells[mapping.descriptionColIndex] ?? "";
    const rawAmt = row.cells[mapping.amountColIndex] ?? "";

    const date = normalizeDateToISO(rawDate, startYear);
    const parsedAmt = parseAmountToCents(rawAmt);

    if (!date || !parsedAmt || !rawDesc.trim()) {
      continue;
    }

    const { amountCents, isNegative } = parsedAmt;

    // Determina se é crédito (entrada):
    // 1. Coluna D/C explícita (maior precisão)
    // 2. Valor negativo no texto (ex.: -150,00)
    // 3. Fallback heurístico: texto original contém palavras-chave de renda
    let isCredit = isNegative;

    if (mapping.typeColIndex !== undefined) {
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
      }
    } else if (!isNegative) {
      // Sem coluna D/C e valor positivo: tenta inferir pelo texto completo da linha
      isCredit = isLikelyIncomeDescription(row.rawText);
    }

    const isPayment = isPaymentOrSettlement(rawDesc);
    const isRefund = isCredit && !isPayment;

    // rawDescription preserva o texto original da linha para que as palavras-chave
    // de renda estejam disponíveis ao motor de classificação no reconciliador.
    const rawDescForTx = row.rawText || rawDesc;
    const cleanDesc = cleanDescription(rawDesc) || rawDesc.trim() || "Transação";
    const installment = extractInstallmentInfo(rawDesc);

    const occKey = `${date}|${amountCents}|${cleanDesc.toLowerCase()}`;
    const occIndex = occurrenceCounter.get(occKey) ?? 0;
    occurrenceCounter.set(occKey, occIndex + 1);

    const statementHash = generateStatementHash({
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
      date,
      amountCents,
      cleanDescription: cleanDesc,
      occurrenceIndex: occIndex,
    });

    transactions.push({
      id: `stmt-${index}`,
      index: index++,
      occurrenceIndex: occIndex,
      date,
      rawDescription: rawDescForTx,
      cleanDescription: cleanDesc,
      amountCents,
      isRefund,
      isPayment,
      installment,
      statementHash,
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
  if (lowerName.endsWith(".ofx") || textContent.includes("<OFX>") || textContent.includes("<STMTTRN>")) {
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

  // 2. CSV ou Texto tabular
  const startYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10) || new Date().getFullYear();
  const rows = lowerName.endsWith(".csv") ? parseCsvToRows(textContent) : parseTextToRows(textContent, startYear);
  const mapping = sniffColumnMapping(rows);
  const transactions = buildTransactionsFromRows(rows, mapping, params);

  return {
    transactions,
    rows,
    mapping,
    isOfx: false,
  };
}
