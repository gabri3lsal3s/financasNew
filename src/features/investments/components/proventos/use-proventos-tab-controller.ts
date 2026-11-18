import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  buildAssetsDividendsBreakdown,
  buildMonthlyDividendsSummary,
  buildMonthlyReinvestmentOpportunities,
  buildSnowballDashboardItems,
  buildYearlyDividendsSummary,
} from "@/domain/portfolio/dividends-analytics";
import type { ReinvestmentOpportunity } from "@/domain/portfolio/snowball";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { currentMonth } from "@/lib/date";
import {
  useCorporateDividends,
  useDeletePortfolioDividend,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import type { WizardMode } from "../../wizard/wizard-state";

export type ProventosSubTab = "mensal" | "calendario" | "ativos" | "snowball";

export function useProventosTabController(
  defaultMonth?: string,
  onOpenWizard?: (asset?: PortfolioAsset | null, mode?: WizardMode) => void,
) {
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
  const [pendingDividendsDialogOpen, setPendingDividendsDialogOpen] = useState(false);

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

  const yearlySummary = useMemo(
    () =>
      buildYearlyDividendsSummary(
        dividends,
        year,
        corporateDividends.projected,
        assetById,
        rowByAssetId,
      ),
    [dividends, year, corporateDividends.projected, assetById, rowByAssetId],
  );

  const projectedInSelectedMonth = useMemo(
    () => corporateDividends.projected.filter((p) => p.paymentDate.startsWith(month)),
    [corporateDividends.projected, month],
  );
  const projectedTotalInSelectedMonth = useMemo(
    () => projectedInSelectedMonth.reduce((acc, p) => acc + p.totalAmount, 0),
    [projectedInSelectedMonth],
  );

  const assetsBreakdown = useMemo(
    () => buildAssetsDividendsBreakdown(assets, dividends, rowByAssetId),
    [assets, dividends, rowByAssetId],
  );

  const snowballSummary = useMemo(
    () => buildSnowballDashboardItems(assets, dividends, rowByAssetId),
    [assets, dividends, rowByAssetId],
  );

  const reinvestmentOpportunities = useMemo(
    () =>
      buildMonthlyReinvestmentOpportunities(
        assets,
        monthlySummary.extract,
        assetById,
        rowByAssetId,
      ),
    [assets, monthlySummary.extract, assetById, rowByAssetId],
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

  const handleReinvest = (opp: ReinvestmentOpportunity) => {
    guardAction(() => {
      if (onOpenWizard) {
        onOpenWizard(assetById.get(opp.assetId) ?? null, "buy");
      }
    }, "Reinvestir Proventos");
  };

  const handleReinvestCash = () => {
    guardAction(() => {
      onOpenWizard?.(null, "existing_aporte");
    }, "Reinvestir Proventos em Caixa");
  };

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
    refetch: () => void dividendsQuery.refetch(),
    hasAny,
    assetById,
    rowByAssetId,
    cashBalance,
    monthlySummary,
    yearlySummary,
    projectedInSelectedMonth,
    projectedTotalInSelectedMonth,
    assetsBreakdown,
    snowballSummary,
    reinvestmentOpportunities,
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
    handleReinvest,
    handleReinvestCash,
    pendingDividendsDialogOpen,
    setPendingDividendsDialogOpen,
  };
}
