/**
 * Parser puro de CSV / B3 / planilhas e plano de consolidação para importação.
 */

import type {
  AssetCurrency,
  FixedIncomeMetadata,
  FixedIncomeRateType,
  PortfolioAsset,
  PortfolioTransactionType,
} from "@/types";
import {
  detectPortfolioColumns,
  parsePortfolioFromMapping,
  parsePortfolioInput,
  type ParsedPortfolioImportRow,
  type PortfolioColumnMapping,
  type RawPortfolioRow,
} from "./import-parser";
import { applyOperation, computeLedger } from "@/domain/portfolio/index";
import { isFixedIncomeClass, isTesouroAsset } from "./valuation";

export { detectPortfolioColumns, parsePortfolioFromMapping, parsePortfolioInput };
export type { ParsedPortfolioImportRow, PortfolioColumnMapping, RawPortfolioRow };

const SPREADSHEET_HEADER_PATTERN =
  /data\s+do\s+negocio|data\s+do\s+negócio|codigo\s+de\s+negociacao|código\s+de\s+negociação|preco\s+medio|preço\s+médio|tipo\s+de\s+movimentacao|tipo\s+de\s+movimentação|quantidade\s+disponivel|quantidade\s+disponível/i;

export type B3ImportSourceResult =
  | { kind: "empty" }
  | { kind: "mapping"; rows: RawPortfolioRow[]; mapping: PortfolioColumnMapping }
  | { kind: "rows"; rows: ParsedPortfolioImportRow[] };

export interface PlannedAssetCreation {
  ticker: string;
  asset_class: string;
  currency: AssetCurrency;
  quantity: number;
  average_price: number;
  fixed_income_metadata: FixedIncomeMetadata | null;
}

export interface PlannedAssetUpdate {
  id: string;
  patch: { quantity: number; average_price: number; asset_class: string | null };
}

export interface PlannedImportTransaction {
  ticker: string;
  type: PortfolioTransactionType;
  date: string;
  quantity: number;
  price: number;
  total: number;
}

export interface PortfolioImportPlan {
  assetsToCreate: PlannedAssetCreation[];
  assetsToUpdate: PlannedAssetUpdate[];
  transactions: PlannedImportTransaction[];
}

/** Remove BOM UTF-8 e verifica se o conteúdo tabular requer passo de mapeamento de colunas. */
export function isB3SpreadsheetContent(inputText: string): boolean {
  const cleaned = inputText.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return false;

  const nonBlankLines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstLine = nonBlankLines[0] ?? "";
  return (
    nonBlankLines.length > 1 &&
    (firstLine.includes(";") ||
      firstLine.includes("\t") ||
      firstLine.includes("|") ||
      SPREADSHEET_HEADER_PATTERN.test(firstLine))
  );
}

/** Classifica e interpreta texto colado ou conteúdo CSV/XLSX convertido da B3 e corretoras. */
export function parseB3ImportSource(
  inputText: string,
  defaultYear = new Date().getFullYear(),
): B3ImportSourceResult {
  const cleaned = inputText.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return { kind: "empty" };

  if (isB3SpreadsheetContent(cleaned)) {
    const detection = detectPortfolioColumns(cleaned);
    if (detection.rows.length > 0 && (detection.rows[0]?.cells.length ?? 0) > 1) {
      return { kind: "mapping", rows: detection.rows, mapping: detection.mapping };
    }
  }

  return { kind: "rows", rows: parsePortfolioInput(cleaned, defaultYear) };
}

/** Recalcula total ou preço unitário mantendo consistência aritmética da linha editada. */
export function recalculateImportRowValues(
  row: ParsedPortfolioImportRow,
  updates: Partial<ParsedPortfolioImportRow>,
): ParsedPortfolioImportRow {
  const updated: ParsedPortfolioImportRow = { ...row, ...updates };
  if (updates.quantity !== undefined || updates.price !== undefined) {
    if (updated.quantity > 0 && updated.price > 0) {
      updated.total = Math.round(updated.quantity * updated.price * 100) / 100;
    }
  } else if (updates.total !== undefined && updated.quantity > 0 && updated.total > 0) {
    updated.price = Math.round((updated.total / updated.quantity) * 10000) / 10000;
  }
  return updated;
}

/** Infere metadados padrão de Renda Fixa pelo padrão do ticker importado. */
export function buildDefaultFixedIncomeMetadata(
  ticker: string,
  initialAveragePrice: number,
  importDate: string,
): FixedIncomeMetadata {
  const upper = ticker.toUpperCase();
  const isExempt = /LCI|LCA|CRI|CRA/.test(upper);
  const rateType: FixedIncomeRateType = upper.includes("SELIC")
    ? "selic"
    : upper.includes("IPCA")
      ? "ipca"
      : upper.includes("PRE")
        ? "pre"
        : "cdi";
  const rateValue = rateType === "cdi" || rateType === "selic" ? 100 : rateType === "ipca" ? 6 : 12;

  return {
    rate_type: rateType,
    rate_value: rateValue,
    base_date: importDate,
    base_value: initialAveragePrice > 0 ? initialAveragePrice : null,
    initial_investment_date: importDate,
    maturity_date: null,
    is_tax_exempt: isExempt,
  };
}

/** Consolida linhas selecionadas por ticker e gera plano puro de criação, atualização e transações. */
export function buildPortfolioImportPlan(params: {
  existingAssets: readonly PortfolioAsset[];
  selectedRows: readonly ParsedPortfolioImportRow[];
  fallbackDate: string;
}): PortfolioImportPlan {
  const { existingAssets, selectedRows, fallbackDate } = params;
  const existingMap = new Map(existingAssets.map((a) => [a.ticker.trim().toUpperCase(), a]));
  const rowsByTicker = new Map<string, ParsedPortfolioImportRow[]>();

  for (const row of selectedRows) {
    const key = row.ticker.trim().toUpperCase();
    const list = rowsByTicker.get(key) ?? [];
    list.push(row);
    rowsByTicker.set(key, list);
  }

  const assetsToCreate: PlannedAssetCreation[] = [];
  const assetsToUpdate: PlannedAssetUpdate[] = [];

  for (const [key, rowsForTicker] of rowsByTicker.entries()) {
    const existing = existingMap.get(key);
    const firstRow = rowsForTicker[0];

    if (!existing && firstRow) {
      const isFi = isFixedIncomeClass(firstRow.assetClass) || isTesouroAsset(key, firstRow.assetClass);
      const ledger = computeLedger(
        rowsForTicker.map((r, i) => ({
          id: `import-${i}`,
          date: r.date || fallbackDate,
          type: r.type,
          quantity: r.quantity,
          price: r.price,
          total: r.total > 0 ? r.total : r.quantity * r.price,
        })),
      );
      const initialQuantity = ledger.quantity > 0 ? ledger.quantity : firstRow.quantity;
      const initialAveragePrice =
        ledger.averageCost > 0 ? Math.round(ledger.averageCost * 10000) / 10000 : firstRow.price;

      assetsToCreate.push({
        ticker: key,
        asset_class: firstRow.assetClass ?? (isFi ? "Renda Fixa" : "Ações"),
        currency: firstRow.currency,
        quantity: initialQuantity,
        average_price: initialAveragePrice,
        fixed_income_metadata: isFi
          ? buildDefaultFixedIncomeMetadata(key, initialAveragePrice, firstRow.date || fallbackDate)
          : null,
      });
      continue;
    }

    if (existing) {
      if (rowsForTicker.length === 1 && firstRow && (firstRow.quantity > 0 || firstRow.price > 0)) {
        assetsToUpdate.push({
          id: existing.id,
          patch: { quantity: firstRow.quantity, average_price: firstRow.price, asset_class: firstRow.assetClass ?? existing.asset_class },
        });
      } else if (rowsForTicker.length > 1) {
        let pos = {
          quantity: existing.quantity,
          averageCost: existing.average_price,
          totalCost: Math.round(existing.quantity * existing.average_price * 100) / 100,
          dividends: 0,
        };
        for (const r of rowsForTicker) {
          pos = applyOperation(pos, { type: r.type, quantity: r.quantity, price: r.price, total: r.total > 0 ? r.total : r.quantity * r.price });
        }
        assetsToUpdate.push({
          id: existing.id,
          patch: { quantity: pos.quantity, average_price: Math.round(pos.averageCost * 10000) / 10000, asset_class: firstRow?.assetClass ?? existing.asset_class },
        });
      }
    }
  }

  const transactions = selectedRows
    .filter((row) => row.quantity > 0 || row.price > 0 || row.total > 0)
    .map((row) => ({
      ticker: row.ticker.trim().toUpperCase(),
      type: row.type,
      date: row.date,
      quantity: row.quantity,
      price: row.price,
      total: row.total,
    }));

  return { assetsToCreate, assetsToUpdate, transactions };
}
