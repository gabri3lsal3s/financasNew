import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  buildAssetsDividendsBreakdown,
  buildMonthlyDividendsSummary,
  buildSnowballDashboardItems,
  buildYearlyDividendsSummary,
} from "@/domain/portfolio/dividends-analytics";
import { isAssetPendingDividendCalibration } from "@/domain/portfolio/dividend-engine";
import { todaySaoPauloISO } from "@/domain/portfolio/dividend-suggester";
import { filterMonthlyForecastDividends } from "@/domain/portfolio/provisioned-dividends";
import { FALLBACK_USD_RATE, isCashAssetClass } from "@/domain/portfolio/valuation";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { currentMonth } from "@/lib/date";
import { openDividendReviewModal } from "@/services/dividend-review-modal";
import {
  useCorporateDividends,
  useDeletePortfolioDividend,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioDividend } from "@/types";

export type ProventosSubTab = "mensal" | "calendario" | "ativos" | "snowball";

export function useProventosTabController(defaultMonth?: string) {
  let searchParams: URLSearchParams | null = null;
  let setSearchParams: ReturnType<typeof useSearchParams>[1] | null = null;

  try {
    const routerParams = useSearchParams();
    searchParams = routerParams[0];
    setSearchParams = routerParams[1];
  } catch {
    // Permite renderização resiliente fora de Router (testes unitários isolados)
  }

  const dividendsQuery = usePortfolioDividends();
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const deleteDividend = useDeletePortfolioDividend();
  const corporateDividends = useCorporateDividends();

  const rawSubTab = (
    searchParams?.get("subtab") ||
    searchParams?.get("subTab") ||
    searchParams?.get("aba")
  )?.toLowerCase();
  const normalizedSubTab = rawSubTab === "extrato" ? "mensal" : rawSubTab;
  const validSubTab =
    normalizedSubTab === "mensal" ||
    normalizedSubTab === "calendario" ||
    normalizedSubTab === "ativos" ||
    normalizedSubTab === "snowball"
      ? (normalizedSubTab as ProventosSubTab)
      : null;

  const [selectedSubTab, setSelectedSubTab] = useState<ProventosSubTab>(
    () => validSubTab ?? "mensal",
  );
  const subTab: ProventosSubTab = validSubTab ?? selectedSubTab;

  const { guardAction, upgradeModal } = useMutationGuard({ moduleKey: "investments" });
  const [month, setMonth] = useState(() => defaultMonth ?? currentMonth());
  const [dividendToDelete, setDividendToDelete] = useState<PortfolioDividend | null>(null);
  const [editingDividend, setEditingDividend] = useState<PortfolioDividend | null>(null);
  const [rollbackCash, setRollbackCash] = useState(true);
  const [dividendFormOpen, setDividendFormOpen] = useState(false);

  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get("review") === "1") {
      openDividendReviewModal({ initialTab: "review" });
      if (setSearchParams) {
        const next = new URLSearchParams(searchParams);
        next.delete("review");
        setSearchParams(next, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  const handleSubTabChange = useCallback(
    (nextTab: ProventosSubTab) => {
      setSelectedSubTab(nextTab);
      if (searchParams && setSearchParams) {
        const next = new URLSearchParams(searchParams);
        if (nextTab === "mensal") {
          next.delete("subtab");
          next.delete("subTab");
          next.delete("aba");
        } else {
          next.set("subtab", nextTab);
          next.delete("subTab");
          next.delete("aba");
        }
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const dividends = useMemo(() => dividendsQuery.data ?? [], [dividendsQuery.data]);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const rowByAssetId = useMemo(
    () => new Map(position.rows.map((r) => [r.assetId, r])),
    [position.rows],
  );
  const cashAsset = useMemo(
    () => assets.find((a) => a.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(a.asset_class)),
    [assets],
  );
  const cashBalance = typeof cashAsset?.quantity === "number" ? cashAsset.quantity : 0;
  const year = month.slice(0, 4);

  const monthlySummary = useMemo(
    () => buildMonthlyDividendsSummary(dividends, month, assetById, rowByAssetId),
    [dividends, month, assetById, rowByAssetId],
  );

  const corporateFxRate =
    "fxRate" in corporateDividends &&
    typeof corporateDividends.fxRate === "number" &&
    corporateDividends.fxRate > 0
      ? corporateDividends.fxRate
      : null;
  const positionFxRate =
    typeof position.usdRate === "number" && position.usdRate > 0 ? position.usdRate : null;
  const fxRate = corporateFxRate ?? positionFxRate ?? FALLBACK_USD_RATE;

  const yearlySummary = useMemo(
    () =>
      buildYearlyDividendsSummary(
        dividends,
        year,
        corporateDividends.projected,
        assetById,
        rowByAssetId,
        fxRate,
      ),
    [dividends, year, corporateDividends.projected, assetById, rowByAssetId, fxRate],
  );

  const projectedInSelectedMonth = useMemo(() => {
    const seen = new Set<string>();
    const forecast = filterMonthlyForecastDividends(
      [...corporateDividends.available, ...corporateDividends.projected],
      month,
      todaySaoPauloISO(),
    );
    return forecast.filter((p) => {
      const key = p.eventId ?? `${p.corporateDividendId}:${p.assetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [corporateDividends.available, corporateDividends.projected, month]);
  const projectedTotalInSelectedMonth = useMemo(() => {
    let totalBRLCents = 0;
    for (const p of projectedInSelectedMonth) {
      const cents = Math.round(p.totalAmount * 100);
      totalBRLCents += p.currency === "USD" ? Math.round(cents * fxRate) : cents;
    }
    return totalBRLCents / 100;
  }, [projectedInSelectedMonth, fxRate]);

  const assetsBreakdown = useMemo(
    () => buildAssetsDividendsBreakdown(assets, dividends, rowByAssetId),
    [assets, dividends, rowByAssetId],
  );

  const snowballSummary = useMemo(
    () => buildSnowballDashboardItems(assets, dividends, rowByAssetId, fxRate),
    [assets, dividends, rowByAssetId, fxRate],
  );

  const handleDelete = async () => {
    if (!dividendToDelete) return;
    try {
      await deleteDividend.mutateAsync({
        ...dividendToDelete,
        rollbackCash: Boolean(dividendToDelete.sync_cash && rollbackCash),
      });
      setDividendToDelete(null);
      setRollbackCash(true);
    } catch {
      // Toast disparado pelo hook
    }
  };

  const assetsNeedingCalibration = useMemo(() => {
    if (
      "assetsNeedingCalibration" in corporateDividends &&
      Array.isArray(corporateDividends.assetsNeedingCalibration)
    ) {
      return corporateDividends.assetsNeedingCalibration;
    }
    return assets.filter(isAssetPendingDividendCalibration);
  }, [corporateDividends, assets]);

  const hasAny =
    dividends.length > 0 ||
    assetsBreakdown.historicalTotal > 0 ||
    snowballSummary.items.length > 0;

  return {
    subTab,
    handleSubTabChange,
    month,
    setMonth,
    year,
    loading: dividendsQuery.isLoading || assetsQuery.isLoading,
    error: dividendsQuery.error ?? assetsQuery.error,
    refetch: () => {
      void Promise.allSettled([
        dividendsQuery.refetch(),
        assetsQuery.refetch(),
        "refetch" in corporateDividends && typeof corporateDividends.refetch === "function"
          ? corporateDividends.refetch()
          : Promise.resolve(),
      ]);
    },
    hasAny,
    calibrationCount: assetsNeedingCalibration.length,
    assetsNeedingCalibration,
    assetById,
    rowByAssetId,
    cashBalance,
    monthlySummary,
    yearlySummary,
    projectedInSelectedMonth,
    projectedTotalInSelectedMonth,
    assetsBreakdown,
    snowballSummary,
    corporateDividends,
    guardAction,
    upgradeModal,
    dividendFormOpen,
    setDividendFormOpen,
    editingDividend,
    setEditingDividend,
    dividendToDelete,
    setDividendToDelete,
    rollbackCash,
    setRollbackCash,
    isDeleting: deleteDividend.isPending,
    handleDelete,
    openPendingDividendsModal: () => openDividendReviewModal({ initialTab: "review" }),
  };
}
