/**
 * Motor puro de análises e consolidação de proventos da carteira (F18/F36/F39).
 * Sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import type { PortfolioAsset, PortfolioDividend } from "@/types";
import { bestDividendMonth, calculateWeightedPortfolioYoC, topDividendPayer } from "./dividends";
import {
  calculateSnowballProgress,
  calculateYieldOnCostTotal,
  detectReinvestmentOpportunities,
  resolveMonthlyDividendPerShare,
  type ReinvestmentOpportunity,
  type SnowballProgressResult,
} from "./snowball";
import { FALLBACK_USD_RATE, isCashAssetClass } from "./valuation";

export interface DividendPositionRef {
  assetId: string;
  currency?: "BRL" | "USD";
  priceQuote?: number;
  priceBRL: number;
  usdRate?: number;
  totalCost?: number;
}

export interface ProjectedDividendRef {
  paymentDate: string | null;
  totalAmount: number;
  currency?: "BRL" | "USD";
}

export interface YearlyDividendMonthPoint {
  month: string;
  total: number;
  projectedTotal: number;
  projectedCount: number;
}

export interface AssetDividendBreakdownItem {
  asset: PortfolioAsset;
  isUSD: boolean;
  rate: number;
  initialHistorical: number;
  periodicAmount: number;
  totalAmount: number;
  totalAmountBRL: number;
  yoc: number;
}

export interface SnowballAssetDashboardItem {
  asset: PortfolioAsset;
  currentPrice: number;
  isUSD: boolean;
  currency: "BRL" | "USD";
  monthlyIncomeBRL: number;
  progress: SnowballProgressResult;
  dividendSource: "latest_tx" | "manual_estimate";
}

function resolveEffectiveUsdFx(
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>,
  usdRate?: number,
): number {
  if (usdRate && Number.isFinite(usdRate) && usdRate > 0) {
    return usdRate;
  }
  for (const r of rowByAssetId.values()) {
    const isUsdRow = (r.currency ?? "").toUpperCase() === "USD";
    if (isUsdRow && r.usdRate && Number.isFinite(r.usdRate) && r.usdRate > 0) {
      return r.usdRate;
    }
  }
  for (const r of rowByAssetId.values()) {
    if (r.usdRate && Number.isFinite(r.usdRate) && r.usdRate > 0) {
      return r.usdRate;
    }
  }
  return FALLBACK_USD_RATE;
}

export function resolveDividendAmountBRL(
  dividend: Pick<PortfolioDividend, "asset_id" | "amount">,
  assetById: ReadonlyMap<string, PortfolioAsset>,
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>,
  fallbackUsdRate: number = FALLBACK_USD_RATE,
): number {
  const asset = dividend.asset_id ? assetById.get(dividend.asset_id) : null;
  const row = dividend.asset_id ? rowByAssetId.get(dividend.asset_id) : null;
  const isUSD = asset?.currency === "USD" || row?.currency === "USD";
  const rowFx = row?.usdRate && Number.isFinite(row.usdRate) && row.usdRate > 0 ? row.usdRate : null;
  const rate = isUSD ? (rowFx ?? (fallbackUsdRate > 0 ? fallbackUsdRate : FALLBACK_USD_RATE)) : 1;
  return dividend.amount * rate;
}

export function buildMonthlyDividendsSummary(
  dividends: readonly PortfolioDividend[],
  month: string,
  assetById: ReadonlyMap<string, PortfolioAsset>,
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>,
) {
  const extract = dividends.filter((d) => d.date.startsWith(month));
  const monthTotal = extract.reduce(
    (acc, d) => acc + resolveDividendAmountBRL(d, assetById, rowByAssetId),
    0,
  );

  const uniqueTickers = new Set<string>();
  const payerInputs = extract.map((d) => {
    const asset = d.asset_id ? assetById.get(d.asset_id) : null;
    const ticker = asset?.ticker ?? d.ticker ?? "Ativo";
    uniqueTickers.add(ticker);
    return {
      ticker,
      amount: resolveDividendAmountBRL(d, assetById, rowByAssetId),
    };
  });

  const topPayer = topDividendPayer(payerInputs);

  return {
    extract,
    monthTotal,
    uniqueTickersCount: uniqueTickers.size,
    topPayer,
  };
}

export function buildYearlyDividendsSummary(
  dividends: readonly PortfolioDividend[],
  year: string,
  projectedDividends: readonly ProjectedDividendRef[],
  assetById: ReadonlyMap<string, PortfolioAsset>,
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>,
  usdRate?: number,
) {
  const effectiveFx = resolveEffectiveUsdFx(rowByAssetId, usdRate);

  const allMonthsOfYear = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return `${year}-${mm}`;
  });

  const yearly: YearlyDividendMonthPoint[] = allMonthsOfYear.map((m) => {
    const monthCents = dividends
      .filter((d) => d.date.startsWith(m))
      .reduce(
        (acc, d) => acc + Math.round(resolveDividendAmountBRL(d, assetById, rowByAssetId, effectiveFx) * 100),
        0,
      );
    const projectedInMonth = projectedDividends.filter(
      (p) => typeof p.paymentDate === "string" && p.paymentDate.startsWith(m),
    );
    const projectedCents = projectedInMonth.reduce((acc, p) => {
      const rate = p.currency === "USD" ? effectiveFx : 1;
      return acc + Math.round(p.totalAmount * rate * 100);
    }, 0);
    return {
      month: m,
      total: monthCents / 100,
      projectedTotal: projectedCents / 100,
      projectedCount: projectedInMonth.length,
    };
  });

  const yearTotalCents = yearly.reduce((acc, e) => acc + Math.round(e.total * 100), 0);
  const yearTotal = yearTotalCents / 100;
  const yearMonthlyAverage = Math.round(yearTotalCents / 12) / 100;
  const bestMonth = bestDividendMonth(yearly);
  const maxMonthTotal = Math.max(...yearly.map((e) => e.total), 1);

  return {
    yearly,
    yearTotal,
    yearMonthlyAverage,
    bestMonth,
    maxMonthTotal,
  };
}

export function buildAssetsDividendsBreakdown(
  assets: readonly PortfolioAsset[],
  dividends: readonly PortfolioDividend[],
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>,
) {
  const historicalTotal = assets.reduce((acc, a) => {
    const row = rowByAssetId.get(a.id);
    const isUSD = a.currency === "USD" || row?.currency === "USD";
    const rate = isUSD ? (row?.usdRate || FALLBACK_USD_RATE) : 1;
    return acc + (a.accumulated_dividends ?? 0) * rate;
  }, 0);

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const allPeriodicDividendsTotal = dividends.reduce(
    (acc, d) => acc + resolveDividendAmountBRL(d, assetById, rowByAssetId),
    0,
  );

  const items: AssetDividendBreakdownItem[] = assets
    .map((a) => {
      const row = rowByAssetId.get(a.id);
      const isUSD = a.currency === "USD" || row?.currency === "USD";
      const rate = isUSD ? (row?.usdRate || FALLBACK_USD_RATE) : 1;
      const initialHistorical = a.accumulated_dividends ?? 0;
      const assetDivs = dividends.filter((d) => d.asset_id === a.id);
      const periodicAmount = assetDivs.reduce((acc, d) => acc + d.amount, 0);
      const totalAmount = initialHistorical + periodicAmount;
      const totalAmountBRL = totalAmount * rate;
      const totalCost = row?.totalCost ?? a.quantity * a.average_price;
      const yoc = calculateYieldOnCostTotal(initialHistorical, periodicAmount, totalCost);

      return {
        asset: a,
        isUSD,
        rate,
        initialHistorical,
        periodicAmount,
        totalAmount,
        totalAmountBRL,
        yoc,
      };
    })
    .filter((item) => item.totalAmount > 0)
    .sort((a, b) => b.totalAmountBRL - a.totalAmountBRL);

  const portfolioAverageYoC = calculateWeightedPortfolioYoC(
    items.map((a) => ({
      costBRL: a.asset.quantity * a.asset.average_price * a.rate,
      dividendsBRL: a.totalAmountBRL,
    })),
  );

  return {
    historicalTotal,
    allPeriodicDividendsTotal,
    lifetimeTotal: historicalTotal + allPeriodicDividendsTotal,
    items,
    portfolioAverageYoC,
  };
}

export function buildSnowballDashboardItems(
  assets: readonly PortfolioAsset[],
  dividends: readonly PortfolioDividend[],
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>,
  usdRate?: number,
) {
  const effectiveFx = resolveEffectiveUsdFx(rowByAssetId, usdRate);

  const items: SnowballAssetDashboardItem[] = assets
    .filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0)
    .map((a): SnowballAssetDashboardItem | null => {
      const assetDivs = dividends.filter((d) => d.asset_id === a.id);
      const latestDiv =
        assetDivs.length > 0
          ? [...assetDivs].sort((d1, d2) => d2.date.localeCompare(d1.date))[0]
          : null;

      const resolved = resolveMonthlyDividendPerShare(
        latestDiv?.amount ?? null,
        a.quantity,
        a.estimated_monthly_dividend_per_share ?? 0,
      );

      if (resolved.source === "none") return null;

      const row = rowByAssetId.get(a.id);
      const isUSD = a.currency === "USD" || row?.currency === "USD";
      const rowFx =
        row?.usdRate && Number.isFinite(row.usdRate) && row.usdRate > 0 ? row.usdRate : null;
      const itemFxRate = isUSD ? (rowFx ?? effectiveFx) : 1;
      const currentPrice =
        row && (row.priceQuote ?? row.priceBRL) > 0
          ? isUSD
            ? row.priceQuote || row.priceBRL
            : row.priceBRL
          : a.average_price;

      if (currentPrice <= 0) return null;

      const progress = calculateSnowballProgress({
        quantity: a.quantity,
        currentPrice,
        monthlyDividendPerShare: resolved.perShare,
      });

      const monthlyIncomeBRL = Math.round(progress.currentMonthlyIncome * itemFxRate * 100) / 100;

      return {
        asset: a,
        currentPrice,
        isUSD,
        currency: isUSD ? "USD" : "BRL",
        monthlyIncomeBRL,
        progress,
        dividendSource: resolved.source,
      };
    })
    .filter((item): item is SnowballAssetDashboardItem => item !== null)
    .sort((a, b) => b.progress.progressPct - a.progress.progressPct);

  const activeCount = items.filter((i) => i.progress.isSnowballActive).length;
  const totalMonthlyEstimatedIncomeCents = items.reduce(
    (acc, i) => acc + Math.round(i.monthlyIncomeBRL * 100),
    0,
  );

  return {
    items,
    activeCount,
    totalMonthlyEstimatedIncome: totalMonthlyEstimatedIncomeCents / 100,
  };
}

export function buildMonthlyReinvestmentOpportunities(
  assets: readonly PortfolioAsset[],
  extract: readonly PortfolioDividend[],
  assetById: ReadonlyMap<string, PortfolioAsset>,
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>,
): ReinvestmentOpportunity[] {
  const nonCashActiveAssets = assets.filter(
    (a) =>
      !isCashAssetClass(a.asset_class) &&
      a.quantity > 0 &&
      a.allocation_status !== "quarantine" &&
      a.allocation_status !== "exit",
  );

  return detectReinvestmentOpportunities(
    nonCashActiveAssets.map((asset) => {
      const row = rowByAssetId.get(asset.id);
      const isUSD = asset.currency === "USD" || row?.currency === "USD";
      const currentPrice =
        row && (row.priceQuote ?? row.priceBRL) > 0
          ? isUSD
            ? row.priceQuote || row.priceBRL
            : row.priceBRL
          : asset.average_price;
      const assetExtract = extract.filter(
        (d) => d.asset_id === asset.id || d.ticker === asset.ticker,
      );
      const monthDividends = assetExtract.reduce(
        (acc, d) =>
          acc + (isUSD ? d.amount : resolveDividendAmountBRL(d, assetById, rowByAssetId)),
        0,
      );

      return {
        assetId: asset.id,
        ticker: asset.ticker,
        currentPrice,
        quantity: asset.quantity,
        monthDividends,
      };
    }),
  );
}
