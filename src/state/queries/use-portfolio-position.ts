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
  type CanonicalFxMetadata,
  type CanonicalQuoteSource,
  type FixedIncomeBalanceResult,
  type PortfolioMonthlySeriesPoint,
  type PriceSource,
  type TwrConsolidatedResult,
  type XIRRResult,
} from "@/domain/portfolio";
import { todaySaoPauloISO } from "@/domain/portfolio/dividend-suggester";
import type {
  AssetAllocationStatus,
  AssetCurrency,
  AssetScoreCriteria,
  FixedIncomeMetadata,
  PortfolioAsset,
} from "@/types";

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
  canonicalSource?: CanonicalQuoteSource;
  isEstimate?: boolean;
  marketPriceAt?: string | null;
  fetchedAt?: string | null;
  provider?: string | null;
  valueBRL: number;
  pct: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  totalReturnPnl: number;
  totalReturnPct: number | null;
  historicalCostBRL?: number;
  historicalRedeemedBRL?: number;
  finalReturnPct?: number | null;
  avgPriceUSD?: number;
  totalCostUSD?: number;
  impliedHistoricalFxRate?: number | null;
  pricePnlPctUSD?: number | null;
  fxPnlPct?: number | null;
  pricePnlPctBRL?: number | null;
  isCash: boolean;
  pricingMode: AssetPricingMode;
  notes?: string | null;
  score?: number | null;
  allocationStatus?: AssetAllocationStatus;
  thesisSummary?: string | null;
  scoreCriteria?: AssetScoreCriteria | null;
  lastReviewedAt?: string | null;
  reviewFrequencyMonths?: number | null;
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
  usdRate: number;
  fxMetadata: CanonicalFxMetadata;
  totalBRL: number;
  totalCostBRL: number;
  assetsTotalCostBRL?: number;
  totalAppliedCostBRL?: number;
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

function mapCanonicalHoldingToRow(
  holding: CanonicalAssetHolding,
  assetById: Map<string, PortfolioAsset>,
): PortfolioPositionRow {
  let source: PriceSource = "manual";
  if (
    holding.resolvedPrice.source === "api" ||
    holding.resolvedPrice.source === "fixed_income" ||
    holding.resolvedPrice.source === "closing_saved" ||
    holding.resolvedPrice.source === "custom_valuation" ||
    holding.resolvedPrice.source === "cash"
  ) {
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

  const asset = assetById.get(holding.assetId);

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
    canonicalSource: holding.resolvedPrice.source,
    isEstimate: holding.resolvedPrice.isEstimate,
    marketPriceAt: holding.resolvedPrice.marketPriceAt ?? null,
    fetchedAt: holding.resolvedPrice.fetchedAt ?? null,
    provider: holding.resolvedPrice.provider ?? null,
    valueBRL: holding.valueBRL,
    pct: holding.weightPct,
    unrealizedPnl: holding.unrealizedPnl,
    unrealizedPct: holding.unrealizedPct,
    totalReturnPnl: holding.totalReturnPnl,
    totalReturnPct: holding.totalReturnPct,
    historicalCostBRL: holding.totalCostBRL,
    historicalRedeemedBRL: 0,
    finalReturnPct: null,
    avgPriceUSD: holding.avgPriceUSD,
    totalCostUSD: holding.totalCostUSD,
    impliedHistoricalFxRate: holding.impliedHistoricalFxRate,
    pricePnlPctUSD: holding.pricePnlPctUSD,
    fxPnlPct: holding.fxPnlPct,
    pricePnlPctBRL: holding.pricePnlPctBRL,
    isCash: holding.isCash,
    pricingMode,
    notes: holding.notes,
    score: asset?.score ?? null,
    allocationStatus: asset?.allocation_status ?? "active",
    thesisSummary: asset?.thesis_summary ?? null,
    scoreCriteria: asset?.score_criteria ?? null,
    lastReviewedAt: asset?.last_reviewed_at ?? null,
    reviewFrequencyMonths: asset?.review_frequency_months ?? null,
    fixedIncomeMetadata: holding.fixedIncomeMetadata,
    fixedIncomeResult: holding.fixedIncomeResult,
    isMatured: holding.isMatured,
    maturityDate: holding.maturityDate,
    netValueBRL: holding.netValueBRL,
    taxAmountBRL: holding.taxAmountBRL,
    taxRatePct: holding.taxRatePct,
  };
}

export function usePortfolioPosition(options?: { enabled?: boolean }): PortfolioPosition {
  const enabled = options?.enabled ?? true;
  const assetsQuery = usePortfolioAssets({ enabled });
  const pricesQuery = useAssetPrices({ enabled });
  const macroQuery = useMacroIndicators({ enabled });
  const contributionsQuery = usePortfolioContributions({ enabled });
  const dividendsQuery = usePortfolioDividends({ enabled });
  const snapshotsQuery = usePortfolioSnapshots({ enabled });
  const transactionsQuery = useAllPortfolioTransactions({ enabled });

  const canonicalState = useMemo(() => {
    return evaluatePortfolioCanonicalState({
      asOfDate: todaySaoPauloISO(),
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
    const assetById = new Map<string, PortfolioAsset>(
      (assetsQuery.data ?? []).map((a) => [a.id, a]),
    );
    return canonicalState.rows.map((holding) => mapCanonicalHoldingToRow(holding, assetById));
  }, [canonicalState.rows, assetsQuery.data]);

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
    usdRate: canonicalState.usdRate,
    fxMetadata: canonicalState.fxMetadata,
    totalBRL: canonicalState.totalBRL,
    totalCostBRL: canonicalState.totalCostBRL,
    assetsTotalCostBRL: canonicalState.assetsTotalCostBRL,
    totalAppliedCostBRL: canonicalState.totalAppliedCostBRL,
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
