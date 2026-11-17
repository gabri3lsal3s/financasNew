import { useCallback, useMemo } from "react";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioSnapshots,
} from "./use-portfolio";
import { useAssetPrices } from "./use-asset-prices";
import { useMacroIndicators } from "./use-macro-indicators";
import {
  evaluatePortfolioCanonicalState,
  type AssetPricingMode,
  type CanonicalAssetHolding,
  type FixedIncomeBalanceResult,
  type PortfolioMonthlySeriesPoint,
  type PriceSource,
  type TwrConsolidatedResult,
  type XIRRResult,
} from "@/domain/portfolio";
import { todayISO } from "@/domain/debts";
import type { AssetCurrency, FixedIncomeMetadata } from "@/types";

export interface PortfolioPositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency: AssetCurrency;
  quantity: number;
  averageCost: number;
  totalCost: number;
  totalCostBRL: number;
  averageCostBRL: number;
  dividends: number;
  dividendsNative?: number;
  priceQuote: number;
  priceBRL: number;
  usdRate: number;
  source: PriceSource;
  valueBRL: number;
  pct: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  totalReturnPnl: number;
  totalReturnPct: number | null;
  historicalCostBRL?: number;
  historicalRedeemedBRL?: number;
  finalReturnPct?: number | null;
  isCash: boolean;
  pricingMode: AssetPricingMode;
  notes?: string | null;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  fixedIncomeResult?: FixedIncomeBalanceResult | null;
  isMatured?: boolean;
  maturityDate?: string | null;
  netValueBRL?: number;
  taxAmountBRL?: number;
  taxRatePct?: number;
  irrResult?: XIRRResult;
}

export interface PortfolioPosition {
  rows: PortfolioPositionRow[];
  totalBRL: number;
  totalCostBRL: number;
  cashBRL: number;
  totalDividendsBRL: number;
  totalReturnPnlBRL: number;
  totalReturnPct: number | null;
  unrealizedPnlBRL: number;
  unrealizedPct: number | null;
  allTimeEconomicPnlBRL: number;
  realizedPnlBRL: number;
  netInjectedCapitalBRL: number;
  netPocketGainBRL: number;
  portfolioIrr: XIRRResult;
  portfolioTwr: TwrConsolidatedResult;
  monthlySeries: PortfolioMonthlySeriesPoint[];
  allMonthlySeries: PortfolioMonthlySeriesPoint[];
  monthlyContributionCents: number;
  hasMarcoZeroContribution: boolean;
  marcoZeroMonth: string | null;
  closedSnapshotsCount: number;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

function mapCanonicalHoldingToRow(holding: CanonicalAssetHolding): PortfolioPositionRow {
  let source: PriceSource = "manual";
  if (holding.resolvedPrice.source === "api") {
    source = "api";
  } else if (holding.resolvedPrice.source === "fallback") {
    source = "fallback";
  }

  const pricingMode: AssetPricingMode =
    holding.pricingMode === "cash"
      ? "cash"
      : holding.pricingMode === "total_value"
        ? "total_value"
        : "unit_price";

  return {
    assetId: holding.assetId,
    ticker: holding.ticker,
    assetClass: holding.assetClass,
    sector: holding.sector,
    currency: holding.currency,
    quantity: holding.quantity,
    averageCost: holding.averageCost,
    totalCost: holding.totalCost,
    totalCostBRL: holding.totalCostBRL,
    averageCostBRL: holding.averageCostBRL,
    dividends: holding.dividends,
    dividendsNative: holding.dividendsNative,
    priceQuote: holding.priceQuote,
    priceBRL: holding.priceBRL,
    usdRate: holding.usdRate,
    source,
    valueBRL: holding.valueBRL,
    pct: holding.weightPct,
    unrealizedPnl: holding.unrealizedPnl,
    unrealizedPct: holding.unrealizedPct,
    totalReturnPnl: holding.totalReturnPnl,
    totalReturnPct: holding.totalReturnPct,
    historicalCostBRL: holding.totalCostBRL,
    historicalRedeemedBRL: 0,
    finalReturnPct: null,
    isCash: holding.isCash,
    pricingMode,
    notes: holding.notes,
    fixedIncomeMetadata: holding.fixedIncomeMetadata,
    fixedIncomeResult: holding.fixedIncomeResult,
    isMatured: holding.isMatured,
    maturityDate: holding.maturityDate,
    netValueBRL: holding.netValueBRL,
    taxAmountBRL: holding.taxAmountBRL,
    taxRatePct: holding.taxRatePct,
  };
}

export function usePortfolioPosition(): PortfolioPosition {
  const assetsQuery = usePortfolioAssets();
  const pricesQuery = useAssetPrices();
  const macroQuery = useMacroIndicators();
  const contributionsQuery = usePortfolioContributions();
  const dividendsQuery = usePortfolioDividends();
  const snapshotsQuery = usePortfolioSnapshots();
  const transactionsQuery = useAllPortfolioTransactions();

  const canonicalState = useMemo(() => {
    return evaluatePortfolioCanonicalState({
      asOfDate: todayISO(),
      mode: "instant",
      assets: assetsQuery.data ?? [],
      transactions: transactionsQuery.data ?? [],
      contributions: contributionsQuery.data ?? [],
      dividends: dividendsQuery.data ?? [],
      snapshots: snapshotsQuery.data ?? [],
      assetPrices: pricesQuery.data ?? [],
      annualCdiRate: macroQuery.data?.annualCdiRate,
    });
  }, [
    assetsQuery.data,
    pricesQuery.data,
    macroQuery.data,
    contributionsQuery.data,
    dividendsQuery.data,
    snapshotsQuery.data,
    transactionsQuery.data,
  ]);

  const rows = useMemo(() => {
    return canonicalState.rows.map(mapCanonicalHoldingToRow);
  }, [canonicalState.rows]);

  const refetch = useCallback(() => {
    void assetsQuery.refetch();
    void pricesQuery.refetch();
    void macroQuery.refetch();
    void contributionsQuery.refetch();
    void dividendsQuery.refetch();
    void snapshotsQuery.refetch();
    void transactionsQuery.refetch();
  }, [
    assetsQuery,
    pricesQuery,
    macroQuery,
    contributionsQuery,
    dividendsQuery,
    snapshotsQuery,
    transactionsQuery,
  ]);

  return {
    rows,
    totalBRL: canonicalState.totalBRL,
    totalCostBRL: canonicalState.totalCostBRL,
    cashBRL: canonicalState.cashBRL,
    totalDividendsBRL: canonicalState.totalDividendsBRL,
    totalReturnPnlBRL: canonicalState.totalReturnPnlBRL,
    totalReturnPct: canonicalState.totalReturnPct,
    unrealizedPnlBRL: canonicalState.unrealizedPnlBRL,
    unrealizedPct: canonicalState.unrealizedPct,
    allTimeEconomicPnlBRL: canonicalState.allTimeEconomicPnlBRL,
    realizedPnlBRL: canonicalState.realizedPnlBRL,
    netInjectedCapitalBRL: canonicalState.netInjectedCapitalBRL,
    netPocketGainBRL: canonicalState.netPocketGainBRL,
    portfolioIrr: canonicalState.portfolioIrr,
    portfolioTwr: canonicalState.portfolioTwr,
    monthlySeries: canonicalState.monthlySeries,
    allMonthlySeries: canonicalState.allMonthlySeries,
    monthlyContributionCents: canonicalState.monthlyContributionCents,
    hasMarcoZeroContribution: canonicalState.hasMarcoZeroContribution,
    marcoZeroMonth: canonicalState.marcoZeroMonth,
    closedSnapshotsCount: canonicalState.closedSnapshotsCount,
    isLoading: assetsQuery.isLoading || pricesQuery.isLoading,
    error: assetsQuery.error ?? pricesQuery.error,
    refetch,
  };
}
