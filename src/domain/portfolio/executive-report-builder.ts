/**
 * Construtores e transformadores puros do Relatório Executivo da Carteira (§F40/F51).
 * Funções 100% puras — sem import de React ou Supabase (AGENTS.md §3).
 */

import type { PositionRow } from "@/components/modules/position-table";
import type { ReportClassGroup } from "@/components/modules/reports/report-class-tables";
import { numberToCents } from "@/domain/money";
import { formatMonthYear } from "@/lib/date";
import type { PortfolioAsset, PortfolioSnapshot } from "@/types";
import { calculatePortfolioQualityScore } from "./allocation";
import { formatFixedIncomeRateLabel } from "./fixed-income";
import type { PointInTimeResult } from "./point-in-time";
import { resolveFixedIncomeIndexer } from "./tickers-catalog";

export interface ReportMonthOption {
  value: string;
  label: string;
}

export function buildReportMonthOptions({
  activeMonth,
  initialMonth,
  snapshots,
}: {
  activeMonth: string;
  initialMonth?: string;
  snapshots: readonly Pick<PortfolioSnapshot, "month">[];
}): ReportMonthOption[] {
  const monthsSet = new Set<string>();
  monthsSet.add(activeMonth);
  if (initialMonth) monthsSet.add(initialMonth);

  for (const snap of snapshots) {
    if (snap.month) monthsSet.add(snap.month);
  }

  return Array.from(monthsSet)
    .sort((a, b) => b.localeCompare(a))
    .map((m) => ({
      value: m,
      label: m === activeMonth ? `${formatMonthYear(m)} (Mês Atual)` : formatMonthYear(m),
    }));
}

export function resolveReportPositionRows({
  isCurrentSelected,
  currentRows,
  monthlyPosition,
}: {
  isCurrentSelected: boolean;
  currentRows: readonly PositionRow[];
  monthlyPosition?: PointInTimeResult | null;
}): PositionRow[] {
  if (isCurrentSelected || !monthlyPosition) {
    return [...currentRows];
  }

  const pit = monthlyPosition;
  const pitRows: PositionRow[] = pit.positions.map((p) => ({
    assetId: p.assetId ?? p.ticker,
    ticker: p.ticker,
    assetClass: p.assetClass,
    sector: p.sector ?? undefined,
    currency: (p.currency as "BRL" | "USD") ?? "BRL",
    quantity: p.quantity,
    averageCost: p.averagePrice,
    totalCost: p.totalCost,
    totalCostBRL: p.totalCostBRL,
    priceQuote: p.priceQuote ?? p.priceBRL,
    priceBRL: p.priceBRL,
    usdRate: p.currency === "USD" && p.priceQuote && p.priceQuote > 0 ? p.priceBRL / p.priceQuote : 1,
    valueBRL: p.valueBRL,
    pct: pit.totalValueBRL > 0 ? (p.valueBRL / pit.totalValueBRL) * 100 : 0,
    source: (p.quoteSource ?? "manual") as PositionRow["source"],
    pricingMode: "unit_price",
    unrealizedPnl: p.unrealizedPnl,
    unrealizedPct: p.unrealizedPct,
    dividends: p.accumulatedDividendsBRL,
    totalReturnPnl: p.totalReturnPnl,
    totalReturnPct: p.totalReturnPct,
    isCash: false,
  }));

  if (pit.cashQuantity > 0) {
    pitRows.push({
      assetId: "caixa-pit",
      ticker: "CAIXA",
      assetClass: "Caixa",
      sector: "Liquidez",
      currency: "BRL",
      quantity: pit.cashQuantity,
      averageCost: 1,
      totalCost: pit.cashQuantity,
      totalCostBRL: pit.cashQuantity,
      priceQuote: 1,
      priceBRL: 1,
      usdRate: 1,
      valueBRL: pit.cashQuantity,
      pct: pit.totalValueBRL > 0 ? (pit.cashQuantity / pit.totalValueBRL) * 100 : 0,
      source: "manual",
      pricingMode: "cash",
      unrealizedPnl: 0,
      unrealizedPct: 0,
      dividends: 0,
      totalReturnPnl: 0,
      totalReturnPct: 0,
      isCash: true,
    });
  }

  return pitRows;
}

export function resolveReportTotals({
  isCurrentSelected,
  selectedMonth,
  currentRows,
  totalBRL,
  cashBRL,
  monthlyPosition,
}: {
  isCurrentSelected: boolean;
  selectedMonth: string;
  currentRows: readonly PositionRow[];
  totalBRL: number;
  cashBRL: number;
  monthlyPosition?: PointInTimeResult | null;
}) {
  const effectiveTotalBRL = (() => {
    if (isCurrentSelected || !monthlyPosition) return totalBRL;
    if (monthlyPosition.monthlyStatement?.endBalanceBRL && monthlyPosition.fidelity?.snapshotTotalValue) {
      return monthlyPosition.monthlyStatement.endBalanceBRL;
    }
    return monthlyPosition.fidelity?.snapshotTotalValue ?? monthlyPosition.totalValueBRL;
  })();

  const effectiveCashBRL =
    isCurrentSelected || !monthlyPosition ? cashBRL : monthlyPosition.cashQuantity;

  const effectiveCostBRL =
    isCurrentSelected || !monthlyPosition
      ? currentRows.reduce((acc, r) => acc + (r.totalCostBRL ?? r.totalCost ?? 0), 0)
      : monthlyPosition.totalCostBRL;

  const effectivePeriodLabel = isCurrentSelected
    ? "Posição Atual Consolidada"
    : `Competência: ${formatMonthYear(selectedMonth)} — Posição de Fechamento`;

  return {
    effectiveTotalBRL,
    effectiveCashBRL,
    effectiveCostBRL,
    effectivePeriodLabel,
  };
}

function resolveRowCostBRL(row: PositionRow): number {
  if (row.totalCostBRL !== undefined && row.totalCostBRL !== null && row.totalCostBRL > 0) {
    return row.totalCostBRL;
  }
  return row.currency === "USD"
    ? row.quantity * row.averageCost * (row.usdRate ?? 1)
    : row.quantity * row.averageCost;
}

export function buildExecutiveReportClassGroups({
  investmentRows,
  effectiveTotalBRL,
  rawAssets,
  cashBRL,
}: {
  investmentRows: readonly PositionRow[];
  effectiveTotalBRL: number;
  rawAssets: readonly PortfolioAsset[];
  cashBRL?: number;
}): { classGroups: ReportClassGroup[]; pqs: number | null } {
  const rawAssetMap = new Map(rawAssets.map((a) => [a.id, a]));
  const findRaw = (row: PositionRow) =>
    rawAssetMap.get(row.assetId) ??
    rawAssets.find((a) => a.ticker.toUpperCase() === row.ticker.toUpperCase());

  const pqs = calculatePortfolioQualityScore(
    investmentRows.map((r) => ({
      score: findRaw(r)?.score ?? null,
      valueBRL: r.valueBRL,
    })),
  );

  const map = new Map<string, PositionRow[]>();
  for (const r of investmentRows) {
    const cls = r.assetClass ?? "Geral";
    const group = map.get(cls);
    if (group) group.push(r);
    else map.set(cls, [r]);
  }

  const classGroups: ReportClassGroup[] = Array.from(map.entries())
    .map(([className, items]) => {
      const subtotalBRL = items.reduce((acc, i) => acc + i.valueBRL, 0);
      const totalCostBRLGroup = items.reduce((acc, i) => acc + Math.max(0, resolveRowCostBRL(i)), 0);
      const totalDividendsBRLGroup = items.reduce((acc, i) => acc + (i.dividends ?? 0), 0);
      const totalReturnPnlBRLGroup = items.reduce((acc, i) => {
        const itemCostBRL = resolveRowCostBRL(i);
        const pnl =
          i.totalReturnPnl !== undefined && i.totalReturnPnl !== null
            ? i.totalReturnPnl
            : i.valueBRL - itemCostBRL + (i.dividends ?? 0);
        return acc + pnl;
      }, 0);

      const classTotalReturnPct =
        totalCostBRLGroup > 0 ? (totalReturnPnlBRLGroup / totalCostBRLGroup) * 100 : 0;

      return {
        className,
        totalCents: numberToCents(subtotalBRL),
        totalCostCents: numberToCents(totalCostBRLGroup),
        totalDividendsCents: numberToCents(totalDividendsBRLGroup),
        sharePct: effectiveTotalBRL > 0 ? (subtotalBRL / effectiveTotalBRL) * 100 : 0,
        pnlPct: classTotalReturnPct,
        items: items.map((i) => {
          const isUsd = i.currency === "USD";
          const quoteOrPrice = i.priceQuote || i.priceBRL;
          const nativePriceVarPct =
            isUsd && i.averageCost > 0 && quoteOrPrice > 0
              ? ((quoteOrPrice - i.averageCost) / i.averageCost) * 100
              : (i.unrealizedPct ?? 0);
          const itemTotalReturnPct =
            i.totalReturnPct !== undefined && i.totalReturnPct !== null
              ? i.totalReturnPct
              : (i.unrealizedPct ?? 0);
          const raw = findRaw(i);

          return {
            ticker: i.ticker,
            sector: i.sector,
            quantity: i.quantity,
            avgPriceCents: numberToCents(i.averageCost),
            currentPriceCents: numberToCents(quoteOrPrice),
            totalCents: numberToCents(i.valueBRL),
            pricePnlPct: nativePriceVarPct,
            pnlPct: itemTotalReturnPct,
            dividendsCents: numberToCents(i.dividends ?? 0),
            currency: i.currency,
            indexType: (() => {
              const fiIndexer = resolveFixedIncomeIndexer({
                ticker: i.ticker,
                sector: i.sector,
                fixed_income_metadata: i.fixedIncomeMetadata,
              });
              if (i.fixedIncomeMetadata) {
                const baseLabel = formatFixedIncomeRateLabel(i.fixedIncomeMetadata, i.ticker);
                if (fiIndexer.detailLabel === "IPCA+" && baseLabel.toLowerCase().includes("pre")) {
                  return "IPCA+";
                }
                return baseLabel;
              }
              return fiIndexer.detailLabel !== "Outros" ? fiIndexer.detailLabel : (i.ticker.toUpperCase().includes("SELIC") ? "SELIC" : null);
            })(),
            maturityDate: i.fixedIncomeMetadata?.maturity_date ?? i.maturityDate ?? null,
            score: raw?.score ?? null,
            status: raw?.allocation_status ?? "active",
          };
        }),
      };
    });

  if (cashBRL && cashBRL > 0) {
    classGroups.push({
      className: "Reserva de Caixa",
      totalCents: numberToCents(cashBRL),
      totalCostCents: numberToCents(cashBRL),
      totalDividendsCents: 0,
      sharePct: effectiveTotalBRL > 0 ? (cashBRL / effectiveTotalBRL) * 100 : 0,
      pnlPct: 0,
      subtotalPriceVarPct: 0,
      items: [
        {
          ticker: "CAIXA",
          sector: "Liquidez Imediata",
          quantity: cashBRL,
          avgPriceCents: 100,
          currentPriceCents: 100,
          totalCents: numberToCents(cashBRL),
          pricePnlPct: 0,
          pnlPct: 0,
          dividendsCents: 0,
          currency: "BRL",
          indexType: null,
          maturityDate: null,
          score: null,
          status: "active",
        },
      ],
    });
  }

  classGroups.sort((a, b) => b.totalCents - a.totalCents);

  return { classGroups, pqs };
}
