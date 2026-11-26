import { useCallback, useMemo } from "react";
import { FALLBACK_USD_RATE } from "@/domain/portfolio";
import {
  buildReportAllocationAnalysis,
  buildReportConcentrationAndDonuts,
  computePeriodInvestmentFlow,
  computeYearDividendsBRL,
  filterPeriodRedemptions,
  mapHistoricalPitPositions,
  resolvePeriodPatrimonyAndCost,
  resolveSelectedPortfolioSnapshot,
  type ReportPeriodMode,
} from "@/domain/reports";
import { currentMonth } from "@/lib/date";
import {
  useAllPortfolioTransactions,
  useEmergencyFundComposition,
  useGroupTargets,
  useMacroIndicators,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioMonthlyPosition,
  usePortfolioPosition,
  usePortfolioSnapshots,
  type PortfolioPositionRow,
} from "@/state";

export interface UseInvestmentReportDataParams {
  enabled: boolean;
  contributionsEnabled?: boolean;
  mode: ReportPeriodMode;
  month: string;
  year: number;
  customValid: boolean;
  debouncedCustomStart: string;
  debouncedCustomEnd: string;
  isCurrentPeriod: boolean;
  selectedYearNum: number;
  periodLabel: string;
  isDateInPeriod: (dateStr: string) => boolean;
}

/**
 * Orquestra consultas e derivações analíticas da carteira de investimentos para relatórios,
 * com gate explícito `enabled` para prevenir bloqueio/exposição quando investimentos está desabilitado.
 */
export function useInvestmentReportData({
  enabled,
  contributionsEnabled = enabled,
  mode,
  month,
  year,
  customValid,
  debouncedCustomStart,
  debouncedCustomEnd,
  isCurrentPeriod,
  selectedYearNum,
  periodLabel,
  isDateInPeriod,
}: UseInvestmentReportDataParams) {
  const positionQuery = usePortfolioPosition({ enabled });
  const monthlyPositionQuery = usePortfolioMonthlyPosition(
    mode === "month" ? month : currentMonth(),
    { enabled: enabled && !isCurrentPeriod && mode === "month" },
  );
  const emergencyFund = useEmergencyFundComposition({ enabled });
  const snapshotsQuery = usePortfolioSnapshots({ enabled });
  const macroIndicatorsQuery = useMacroIndicators({ enabled });
  const assetsQuery = usePortfolioAssets({ enabled });
  const dividendsQuery = usePortfolioDividends({ enabled });
  const transactionsQuery = useAllPortfolioTransactions({ enabled });
  const contributionsQuery = usePortfolioContributions({ enabled: contributionsEnabled });
  const classTargetsQuery = useGroupTargets("class", { enabled });
  const sectorTargetsQuery = useGroupTargets("sector", { enabled });

  const assets = useMemo(() => (enabled ? assetsQuery.data ?? [] : []), [enabled, assetsQuery.data]);
  const dividends = useMemo(() => (enabled ? dividendsQuery.data ?? [] : []), [enabled, dividendsQuery.data]);
  const transactions = useMemo(() => (enabled ? transactionsQuery.data ?? [] : []), [enabled, transactionsQuery.data]);
  const contributions = useMemo(() => (contributionsEnabled ? contributionsQuery.data ?? [] : []), [contributionsEnabled, contributionsQuery.data]);
  const snapshots = useMemo(() => (enabled ? snapshotsQuery.data ?? [] : []), [enabled, snapshotsQuery.data]);
  const classTargets = useMemo(() => (enabled ? classTargetsQuery.data ?? [] : []), [enabled, classTargetsQuery.data]);

  const sectorTargets = useMemo(
    () =>
      enabled
        ? (sectorTargetsQuery.data ?? []).map((st) => ({
            className: st.class_name ?? undefined,
            sectorName: st.name,
            targetPercentage: st.target_percentage,
          }))
        : [],
    [enabled, sectorTargetsQuery.data],
  );

  const historicalPit = enabled && !isCurrentPeriod && mode === "month" ? monthlyPositionQuery.data : null;

  const positionRows: readonly PortfolioPositionRow[] = useMemo(() => {
    if (!enabled) return [];
    if (historicalPit && historicalPit.positions.length > 0) {
      return mapHistoricalPitPositions(historicalPit);
    }
    return positionQuery.rows ?? [];
  }, [enabled, historicalPit, positionQuery.rows]);

  const usdRate = useMemo(
    () =>
      historicalPit?.usdRate ??
      positionQuery.usdRate ??
      positionRows.find((r) => r.currency === "USD")?.usdRate ??
      FALLBACK_USD_RATE,
    [historicalPit?.usdRate, positionQuery.usdRate, positionRows],
  );
  const fxMetadata = useMemo(
    () =>
      historicalPit && typeof historicalPit.usdRate === "number" && historicalPit.usdRate > 0
        ? {
            rate: historicalPit.usdRate,
            source: "closing_saved" as const,
            provider: "closing_saved",
            fxRateAt: null,
            fetchedAt: null,
            isFallback: false,
          }
        : positionQuery.fxMetadata ?? null,
    [historicalPit, positionQuery.fxMetadata],
  );
  const assetCurrencyMap = useMemo(() => new Map(assets.map((a) => [a.id, a.currency])), [assets]);

  const yearDividendsBRL = useMemo(
    () =>
      enabled
        ? computeYearDividendsBRL({
            dividends,
            selectedYear: selectedYearNum,
            assetCurrencyMap,
            usdRate,
            fallbackCurrentYearDividendsBRL: positionQuery.totalDividendsBRL ?? 0,
          })
        : 0,
    [enabled, dividends, selectedYearNum, assetCurrencyMap, usdRate, positionQuery.totalDividendsBRL],
  );

  const activeMonthStr = mode === "month" ? month : currentMonth();
  const activeSeriesPoint = positionQuery.monthlySeries?.find((p) => p.month === activeMonthStr);
  const reconciledNetFlowBRL = activeSeriesPoint?.netContributionBRL ?? null;

  const periodFlowSummary = useMemo(
    () =>
      enabled
        ? computePeriodInvestmentFlow({
            transactions,
            dividends,
            assets,
            assetCurrencyMap,
            usdRate,
            isDateInPeriod,
            periodLabel,
            contributions,
            monthlyStatement: monthlyPositionQuery.data?.monthlyStatement,
            reconciledNetFlowBRL,
          })
        : { buysBRL: 0, sellsBRL: 0, dividendsBRL: 0, netFlowBRL: 0, monthLabel: periodLabel },
    [
      enabled,
      transactions,
      dividends,
      assets,
      assetCurrencyMap,
      usdRate,
      isDateInPeriod,
      periodLabel,
      contributions,
      monthlyPositionQuery.data?.monthlyStatement,
      reconciledNetFlowBRL,
    ],
  );

  const selectedSnapshot = useMemo(
    () =>
      enabled
        ? resolveSelectedPortfolioSnapshot({ snapshots, mode, month, year, debouncedCustomEnd })
        : null,
    [enabled, snapshots, mode, month, year, debouncedCustomEnd],
  );

  const { totalPatrimonyBRL, totalInvestedCostBRL } = useMemo(
    () =>
      enabled
        ? resolvePeriodPatrimonyAndCost({
            isCurrentPeriod,
            currentTotalBRL: positionQuery.totalBRL ?? 0,
            currentCostBRL: positionQuery.totalCostBRL ?? 0,
            historicalPit,
            selectedSnapshot,
          })
        : { totalPatrimonyBRL: 0, totalInvestedCostBRL: 0 },
    [enabled, isCurrentPeriod, positionQuery.totalBRL, positionQuery.totalCostBRL, historicalPit, selectedSnapshot],
  );

  const cashBalanceBRL = !enabled ? 0 : historicalPit ? historicalPit.cashQuantity : (positionQuery.cashBRL ?? 0);

  const periodRedemptions = useMemo(
    () =>
      enabled
        ? filterPeriodRedemptions({
            transactions,
            assets,
            mode,
            month,
            year,
            startDate: customValid ? debouncedCustomStart : undefined,
            endDate: customValid ? debouncedCustomEnd : undefined,
            usdRate,
          })
        : [],
    [enabled, transactions, assets, mode, month, year, customValid, debouncedCustomStart, debouncedCustomEnd, usdRate],
  );

  const allocationAnalysis = useMemo(
    () => buildReportAllocationAnalysis({ positionRows, assets, classTargets, sectorTargets }),
    [positionRows, assets, classTargets, sectorTargets],
  );

  const { concentrationRisk, investmentDonutData } = useMemo(
    () => buildReportConcentrationAndDonuts({ positionRows, cashBalanceBRL }),
    [positionRows, cashBalanceBRL],
  );

  const loading = (contributionsEnabled && contributionsQuery.isLoading) || (enabled
    ? positionQuery.isLoading || snapshotsQuery.isLoading || assetsQuery.isLoading || transactionsQuery.isLoading || sectorTargetsQuery.isLoading
    : false);
  const error = (contributionsEnabled ? contributionsQuery.error : null) ?? (enabled
    ? positionQuery.error ?? snapshotsQuery.error ?? transactionsQuery.error ?? sectorTargetsQuery.error
    : null);

  const refetchInvestments = useCallback(async () => {
    const tasks: Promise<unknown>[] = [];
    if (contributionsEnabled) {
      tasks.push(contributionsQuery.refetch());
    }
    if (enabled) {
      tasks.push(
        positionQuery.refetch(),
        snapshotsQuery.refetch(),
        assetsQuery.refetch(),
        transactionsQuery.refetch(),
        sectorTargetsQuery.refetch(),
      );
    }
    await Promise.all(tasks);
  }, [
    contributionsEnabled,
    contributionsQuery,
    enabled,
    positionQuery,
    snapshotsQuery,
    assetsQuery,
    transactionsQuery,
    sectorTargetsQuery,
  ]);

  return {
    loading,
    error,
    positionRows,
    cashBalanceBRL,
    totalPatrimonyBRL,
    totalInvestedCostBRL,
    yearDividendsBRL,
    periodFlowSummary,
    periodRedemptions,
    allocationAnalysis,
    concentrationRisk,
    investmentDonutData,
    contributions,
    assets,
    dividends,
    transactions,
    usdRate,
    fxMetadata,
    historicalPit,
    positionQuery,
    emergencyFund,
    macroIndicatorsQuery,
    assetsQuery,
    refetchInvestments,
  };
}
