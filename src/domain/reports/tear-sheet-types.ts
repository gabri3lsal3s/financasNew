import type {
  CanonicalFxMetadata,
  PortfolioMonthlySeriesPoint,
  PositionLikeItem,
  StaleQuoteGuardResult,
  TwrConsolidatedResult,
} from "@/domain/portfolio";
import type { AllocationDonutsResult } from "./allocation-donuts";
import type { AllocationAnalysisResult } from "./allocation-gaps";
import type { ConcentrationRiskResult } from "./concentration-risk";

export interface WealthPositionRow {
  ticker: string;
  name?: string | null;
  assetClass: string | null;
  sector?: string | null;
  currency: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  valueBRL: number;
  totalCostBRL?: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  totalReturnPnlBRL?: number;
  totalReturnPct?: number;
  dividendsBRL?: number;
  yearDividendsBRL?: number;
  yocPct?: number;
  isCash?: boolean;
  score?: number | null;
  allocationStatus?: string | null;
  avgPriceUSD?: number | null;
  totalCostUSD?: number | null;
  impliedHistoricalFxRate?: number | null;
  pricePnlPctUSD?: number | null;
  fxPnlPct?: number | null;
  pricePnlPctBRL?: number | null;
  usdRate?: number;
  source?: string | null;
  isEstimate?: boolean;
  marketPriceAt?: string | null;
  fetchedAt?: string | null;
  provider?: string | null;
  priceBRL?: number;
  indexType?: string | null;
  maturityDate?: string | null;
}

export interface MonthFlowSummary {
  buysBRL: number;
  sellsBRL: number;
  dividendsBRL: number;
  netFlowBRL: number;
  monthLabel: string;
  cashDepositsBRL?: number;
  cashWithdrawalsBRL?: number;
  externalContributionsBRL?: number;
  externalWithdrawalsBRL?: number;
  operationsCount?: number;
}

export interface BuildTearSheetModelParams {
  rows: readonly WealthPositionRow[];
  totalBRL: number;
  totalCostBRL: number;
  assetsCostBRL?: number;
  totalAppliedCostBRL?: number;
  totalDividendsBRL?: number;
  totalReturnPnlBRL?: number;
  totalReturnPct?: number | null;
  unrealizedPnlBRL?: number;
  unrealizedPnlPct?: number | null;
  cashBRL?: number;
  allocationAnalysis?: AllocationAnalysisResult;
  concentrationRisk?: ConcentrationRiskResult;
  portfolioTwr?: TwrConsolidatedResult;
  monthlySeries?: readonly PortfolioMonthlySeriesPoint[];
  allTimeEconomicPnlBRL?: number;
  realizedPnlBRL?: number;
  usdRate?: number;
  fxMetadata?: CanonicalFxMetadata | null;
  staleGuard?: StaleQuoteGuardResult | null;
  indexType?: string | null;
  maturityDate?: string | null;
}

export interface TearSheetPerformancePoint {
  month: string;
  monthLabel: string;
  patrimonyBRL: number;
  ratePct: number;
  dividendsBRL?: number;
  costBRL?: number;
}

export interface TearSheetAllocationRow {
  assetClass: string;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  deviationBRL: number;
  isDeficit: boolean;
  isSurplus: boolean;
}

export interface TearSheetClassGroupItem {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  quantity: number;
  avgPriceCents: number;
  currentPriceCents: number;
  totalCents: number;
  pricePnlPct: number;
  pnlPct: number;
  dividendsCents: number;
  yocPct?: number;
  currency: string;
  score?: number | null;
  status: string;
  quoteStatusFlag?: "fallback" | "stale" | "manual" | null;
  marketPriceAt?: string | null;
}

export interface TearSheetClassGroup {
  className: string;
  color: string;
  totalCents: number;
  sharePct: number;
  pnlPct: number;
  subtotalPriceVarPct: number;
  subtotalPriceVarPctUSD?: number;
  usdRate?: number;
  fxSourceLabel?: string | null;
  totalCostCents: number;
  totalDividendsCents: number;
  topAssetTicker?: string;
  topAssetSharePct?: number;
  items: TearSheetClassGroupItem[];
}

export interface TearSheetStackedSegment {
  key: string;
  label: string;
  pct: number;
  color: string;
}

export interface TearSheetModel {
  activeInvestmentRows: WealthPositionRow[];
  totalInvestedValueBRL: number;
  effectiveCostBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  totalDividendsAllTime: number;
  totalReturnBRL: number;
  totalReturnPct: number;
  effectiveRealizedGainBRL: number;
  allTimeEconomicValueBRL: number;
  performanceSeries: TearSheetPerformancePoint[];
  donutData: AllocationDonutsResult;
  stackedSegments: TearSheetStackedSegment[];
  allocationRows: TearSheetAllocationRow[];
  topDominance: { ticker: string; pct: number };
  breakdownRows: PositionLikeItem[];
  classTableGroups: TearSheetClassGroup[];
  intlPct: number;
  hasTargets: boolean;
  surplusClasses: string[];
}
