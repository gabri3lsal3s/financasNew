/**
 * Motor puro de agrupamento, filtragem, ordenação, paginação e metadados de exibição
 * para a tabela e cards de posições da carteira.
 *
 * Sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import type { AssetAllocationStatus, AssetCurrency, FixedIncomeMetadata } from "@/types";
import type { PriceSource } from "./valuation";
import {
  calculatePositionClassGroups,
  calculatePositionSectorGroups,
  type CalculatedClassGroup,
  type CalculatedSectorGroup,
  type PositionSectorCalculationRow,
} from "./class-breakdown";
import { calculateYieldOnCost } from "./snowball";
import { inferSectorFromTicker } from "./tickers-catalog";

export type PositionSortKey =
  | "ticker"
  | "quantity"
  | "price"
  | "averageCost"
  | "value"
  | "unrealizedPnl"
  | "unrealizedPct"
  | "pct"
  | "maturityDate";

export type PositionSortDirection = "asc" | "desc";

export interface PositionSortState {
  key: PositionSortKey;
  direction: PositionSortDirection;
}

export interface PositionGroupableRow extends PositionSectorCalculationRow {
  assetId: string;
  currency: AssetCurrency;
  quantity: number;
  averageCost: number;
  priceBRL: number;
  unrealizedPct: number | null;
  totalReturnPct?: number | null;
  totalReturnPnl?: number | null;
  allocationStatus?: AssetAllocationStatus | null;
  score?: number | null;
  source?: PriceSource;
  dividendsNative?: number;
  isCash: boolean;
  isMatured?: boolean;
  maturityDate?: string | null;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
}

export function isPositionRowClosed(row: Pick<PositionGroupableRow, "quantity" | "valueBRL" | "totalCostBRL" | "totalCost" | "averageCost">): boolean {
  const cost = row.totalCostBRL ?? row.totalCost ?? row.averageCost ?? 0;
  return row.quantity <= 0 && row.valueBRL <= 0 && cost <= 0;
}

export interface PositionFilterOptions {
  search: string;
  selectedClass: string | null;
  selectedSector?: string | null;
  governanceStatus?: "all" | "core" | "quarantine" | "exit" | null;
}

export function filterPositionRows<T extends Pick<PositionGroupableRow, "ticker" | "assetClass" | "sector"> & { allocationStatus?: AssetAllocationStatus | null }>(
  rows: readonly T[],
  options: PositionFilterOptions,
): T[] {
  const normalizedSearch = options.search.trim().toLowerCase();
  const normalizedSector = options.selectedSector?.trim().toLowerCase();
  const governance = options.governanceStatus;

  return rows.filter((row) => {
    const rowSector = row.sector?.trim() || inferSectorFromTicker(row.ticker, row.assetClass);
    const matchesSearch =
      normalizedSearch === "" ||
      row.ticker.toLowerCase().includes(normalizedSearch) ||
      (row.assetClass?.toLowerCase().includes(normalizedSearch) ?? false) ||
      (rowSector ? rowSector.toLowerCase().includes(normalizedSearch) : false);
    const matchesClass = options.selectedClass === null || row.assetClass === options.selectedClass;
    const matchesSector =
      !normalizedSector ||
      (rowSector ? rowSector.toLowerCase() === normalizedSector : false);

    let matchesGovernance = true;
    if (governance === "quarantine") {
      matchesGovernance = row.allocationStatus === "quarantine";
    } else if (governance === "exit") {
      matchesGovernance = row.allocationStatus === "exit";
    } else if (governance === "core") {
      matchesGovernance = row.allocationStatus !== "quarantine" && row.allocationStatus !== "exit";
    }

    return matchesSearch && matchesClass && matchesSector && matchesGovernance;
  });
}

export function comparePositionRows(
  a: PositionGroupableRow,
  b: PositionGroupableRow,
  sort: PositionSortState,
): number {
  const { key, direction } = sort;
  let cmp = 0;

  if (key === "ticker") {
    cmp = a.ticker.localeCompare(b.ticker);
  } else if (key === "quantity") {
    cmp = a.quantity - b.quantity;
  } else if (key === "price") {
    cmp = a.priceBRL - b.priceBRL;
  } else if (key === "averageCost") {
    const costA = a.totalCostBRL ?? a.totalCost ?? a.averageCost;
    const costB = b.totalCostBRL ?? b.totalCost ?? b.averageCost;
    cmp = costA - costB;
  } else if (key === "value") {
    cmp = a.valueBRL - b.valueBRL;
  } else if (key === "pct") {
    cmp = a.pct - b.pct;
  } else if (key === "unrealizedPnl") {
    const pnlA = a.totalReturnPnl ?? a.unrealizedPnl ?? 0;
    const pnlB = b.totalReturnPnl ?? b.unrealizedPnl ?? 0;
    cmp = pnlA - pnlB;
  } else if (key === "unrealizedPct") {
    const aVal = a.totalReturnPct ?? a.unrealizedPct ?? -Infinity;
    const bVal = b.totalReturnPct ?? b.unrealizedPct ?? -Infinity;
    cmp = aVal - bVal;
  } else if (key === "maturityDate") {
    const dateA = a.fixedIncomeMetadata?.maturity_date || a.maturityDate || "";
    const dateB = b.fixedIncomeMetadata?.maturity_date || b.maturityDate || "";
    cmp = dateA.localeCompare(dateB);
  }

  return direction === "asc" ? cmp : -cmp;
}

export function sortPositionRows<T extends PositionGroupableRow>(
  items: readonly T[],
  sort: PositionSortState | null,
): T[] {
  if (!sort) return [...items];
  return [...items].sort((a, b) => comparePositionRows(a, b, sort));
}

export function groupPositionsByClass<T extends PositionGroupableRow>(
  rows: readonly T[],
  sort: PositionSortState | null,
): CalculatedClassGroup<T>[] {
  const groups = calculatePositionClassGroups(rows, (items) => sortPositionRows(items, sort));
  if (!sort) return groups;

  return [...groups].sort((a, b) => {
    const firstA = a.rows[0];
    const firstB = b.rows[0];
    if (!firstA || !firstB) return 0;
    return comparePositionRows(firstA, firstB, sort);
  });
}

export function groupPositionsBySector<T extends PositionGroupableRow>(
  rows: readonly T[],
  sort: PositionSortState | null,
): CalculatedSectorGroup<T>[] {
  const groups = calculatePositionSectorGroups(rows, (items) => sortPositionRows(items, sort));
  if (!sort) return groups;

  return [...groups].sort((a, b) => {
    const firstA = a.rows[0];
    const firstB = b.rows[0];
    if (!firstA || !firstB) return 0;
    return comparePositionRows(firstA, firstB, sort);
  });
}

export function resolveHighlightedGroupKey(
  rows: readonly Pick<PositionGroupableRow, "assetId" | "ticker" | "assetClass" | "sector">[],
  highlightId: string | null | undefined,
  groupBy: "class" | "sector",
): string | null {
  if (!highlightId) return null;
  const target = rows.find((r) => r.assetId === highlightId);
  if (!target) return null;
  if (groupBy === "class") {
    return target.assetClass ?? "Sem classe";
  }
  const targetSec = target.sector?.trim() || inferSectorFromTicker(target.ticker, target.assetClass);
  const targetCls = target.assetClass ?? "Outros";
  return `${targetCls}__${targetSec}`;
}

export interface PaginatedPositionsResult<T> {
  items: T[];
  totalPages: number;
  currentPage: number;
  startIndex: number;
  endIndex: number;
}

export function paginatePositionRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginatedPositionsResult<T> {
  if (pageSize === Infinity || !Number.isFinite(pageSize) || pageSize <= 0) {
    return {
      items: [...rows],
      totalPages: 1,
      currentPage: 1,
      startIndex: rows.length > 0 ? 1 : 0,
      endIndex: rows.length,
    };
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * pageSize;
  const items = rows.slice(offset, offset + pageSize);
  return {
    items,
    totalPages,
    currentPage,
    startIndex: rows.length > 0 ? offset + 1 : 0,
    endIndex: Math.min(offset + pageSize, rows.length),
  };
}

export function formatFixedIncomeRateLabel(
  row: Pick<PositionGroupableRow, "isMatured" | "fixedIncomeMetadata"> & { ticker?: string },
  requirePositiveRate = false,
): string | null {
  if (row.isMatured) return "Vencido";
  const ticker = row.ticker?.toUpperCase();
  const isSelicTicker = ticker?.includes("SELIC");
  const meta = row.fixedIncomeMetadata;
  if (!meta) return isSelicTicker ? "SELIC" : null;
  if (isSelicTicker && (meta.rate_value === 100 || meta.rate_value === 0 || meta.rate_type === "cdi")) {
    return "SELIC";
  }
  if (isSelicTicker && meta.rate_value > 0 && meta.rate_value < 10) {
    return `Selic + ${meta.rate_value}% a.a.`;
  }
  if (requirePositiveRate && !(meta.rate_value > 0)) return null;
  if (!(meta.rate_value > 0)) {
    if (isSelicTicker || meta.rate_type === "selic") return "SELIC";
    if (meta.rate_type === "cdi") return "CDI";
    if (meta.rate_type === "pre") return "Prefixado";
    if (meta.rate_type === "ipca") return "IPCA+";
    return null;
  }
  if (meta.rate_type === "cdi") return `${meta.rate_value}% CDI`;
  if (meta.rate_type === "selic") return meta.rate_value === 100 ? "SELIC" : `${meta.rate_value}% Selic`;
  if (meta.rate_type === "pre") return `${meta.rate_value}% a.a.`;
  return `IPCA + ${meta.rate_value}% a.a.`;
}

export function getScoreBadgeMeta(score: number | null | undefined): {
  label: string;
  variant: "muted" | "positive" | "warning" | "negative";
} {
  if (score == null) return { label: "Sem nota", variant: "muted" };
  if (score >= 7) return { label: `Nota ${score}`, variant: "positive" };
  if (score >= 4) return { label: `Nota ${score}`, variant: "warning" };
  return { label: `Nota ${score}`, variant: "negative" };
}

export function getAllocationStatusBadgeMeta(
  status: AssetAllocationStatus | undefined,
): { label: string; variant: "negative" | "warning" | "muted" } | null {
  if (!status || status === "active") return null;
  if (status === "exit") return { label: "Saída", variant: "negative" };
  if (status === "quarantine") return { label: "Quarentena", variant: "warning" };
  return { label: "Manter", variant: "muted" };
}

export function calculatePositionRowYoC(
  row: Pick<PositionGroupableRow, "currency" | "dividends" | "dividendsNative" | "totalCost" | "totalCostBRL">,
): number {
  const effectiveDividends = row.currency === "USD" ? (row.dividendsNative ?? row.dividends) : row.dividends;
  const effectiveCost =
    row.currency === "USD" ? (row.totalCost ?? row.totalCostBRL) : (row.totalCostBRL ?? row.totalCost);

  if (effectiveDividends && effectiveDividends > 0 && effectiveCost && effectiveCost > 0) {
    return calculateYieldOnCost(effectiveDividends, effectiveCost);
  }
  return 0;
}
