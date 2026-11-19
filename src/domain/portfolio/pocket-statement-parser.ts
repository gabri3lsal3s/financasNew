/**
 * Parser e utilitários puros de custo do bolso (Marcos Históricos e Extrato).
 *
 * Consolida a extração de extratos de corretoras/bancos e o cálculo de
 * resumos/paylods de marcos históricos sem acoplar UI ou camada de dados.
 */

import type { PortfolioContribution } from "@/types";
import { isHistoricalWithdrawal } from "./irr";
import {
  cleanContributionNotes,
  deduplicateStatementRows,
  extractExplicitRateFromNotes,
  parseBRLNumber,
  parseBrokerStatement,
  type DeduplicateStatementRowsResult,
  type ParsedMonthlyRow,
  type StatementParseResult,
} from "./statement-parser";

export {
  cleanContributionNotes,
  deduplicateStatementRows,
  extractExplicitRateFromNotes,
  isHistoricalWithdrawal,
  parseBRLNumber,
  parseBrokerStatement,
};
export type { DeduplicateStatementRowsResult, ParsedMonthlyRow, StatementParseResult };

export interface PocketCostSummary {
  totalAportesBRL: number;
  totalResgatesBRL: number;
  netPocketCapitalBRL: number;
}

export interface BuildPocketNotesInput {
  entryType: "aporte" | "resgate";
  notes: string;
  ratePctText: string;
  existingNotes?: string | null;
  isFirstMarco: boolean;
}

export interface PocketContributionPayload {
  asset_id: null;
  date: string;
  amount: number;
  notes: string;
}

export interface PocketSnapshotPayload {
  month: string;
  total_value: number;
  total_cost: number;
  status: "closed";
  closing_date: string;
}

/** Normaliza espaços não-quebráveis/BOM e processa texto bruto de extrato do bolso. */
export function parsePocketStatementText(rawText: string): StatementParseResult {
  const normalized = rawText
    .replace(/^\uFEFF/, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D]/g, "")
    .replace(/\b([A-Za-zçÇ]+\.?)\s+(\d{4})\b/g, "$1\t$2");
  return parseBrokerStatement(normalized);
}

/** Filtra marcos históricos do bolso e ordena do mais recente para o mais antigo. */
export function filterHistoricalContributions(
  contributions: readonly PortfolioContribution[],
): PortfolioContribution[] {
  return contributions
    .filter((c) => {
      if (c.asset_id) {
        const lower = (c.notes ?? "").toLowerCase();
        return lower.includes("marco") || lower.includes("histórico");
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Calcula totais de aportes, resgates e capital líquido do bolso em BRL. */
export function computePocketCostSummary(
  contributions: readonly Pick<PortfolioContribution, "amount" | "notes">[],
): PocketCostSummary {
  let aportes = 0;
  let resgates = 0;

  for (const item of contributions) {
    const amount = Number(item.amount);
    if (isHistoricalWithdrawal(item)) {
      resgates += amount;
    } else {
      aportes += amount;
    }
  }

  return {
    totalAportesBRL: Math.round(aportes * 100) / 100,
    totalResgatesBRL: Math.round(resgates * 100) / 100,
    netPocketCapitalBRL: Math.round((aportes - resgates) * 100) / 100,
  };
}

/** Monta as notas padronizadas de um marco histórico (com prefixo de resgate e rentabilidade). */
export function buildPocketContributionNotes({
  entryType,
  notes,
  ratePctText,
  existingNotes,
  isFirstMarco,
}: BuildPocketNotesInput): string {
  const isWithdrawal = entryType === "resgate";
  const prefix = isWithdrawal ? "[Resgate] " : "";
  const defaultLabel = isWithdrawal
    ? "Retirada do Bolso"
    : isFirstMarco
      ? "Marco Histórico · Início da Carteira"
      : "Aporte Histórico do Bolso";

  let rateTag = "";
  if (ratePctText.trim()) {
    const parsedRate = parseBRLNumber(ratePctText);
    if (parsedRate !== null && !Number.isNaN(parsedRate)) {
      rateTag = ` [Rent: ${parsedRate > 0 ? "+" : ""}${parsedRate.toFixed(2).replace(".", ",")}%]`;
    }
  } else if (existingNotes) {
    const existingRate = extractExplicitRateFromNotes(existingNotes);
    if (existingRate !== null) {
      rateTag = ` [Rent: ${existingRate > 0 ? "+" : ""}${String(existingRate).replace(".", ",")}%]`;
    }
  }

  return `${prefix}${notes.trim() || defaultLabel}${rateTag}`;
}

/** Constrói payloads prontos para gravação em lote de marcos históricos e snapshots mensais. */
export function buildPocketImportPayloads(
  rowsToImport: readonly ParsedMonthlyRow[],
  allRows: readonly ParsedMonthlyRow[],
): {
  contributionPayloads: PocketContributionPayload[];
  snapshotPayloads: PocketSnapshotPayload[];
} {
  const contributionPayloads: PocketContributionPayload[] = rowsToImport.map((row) => ({
    asset_id: null,
    date: row.date,
    amount: Math.abs(row.delta),
    notes: row.suggestedNotes,
  }));

  const snapshotPayloads: PocketSnapshotPayload[] = allRows
    .filter((r) => r.grossBalance !== undefined || r.appliedValue > 0)
    .map((r) => ({
      month: r.date.slice(0, 7),
      total_value: r.grossBalance ?? r.appliedValue,
      total_cost: r.appliedValue,
      status: "closed" as const,
      closing_date: r.date,
    }));

  return { contributionPayloads, snapshotPayloads };
}
