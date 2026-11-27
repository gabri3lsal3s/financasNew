import { useMemo, useState } from "react";
import { serializePortfolioActivitiesCsv } from "@/domain/export";
import {
  buildUnifiedActivityTimeline,
  computeActivityMonthStats,
  computeActivityTypeCounts,
  filterActivityItems,
  mapActivitiesToExportRows,
  type ActivityFilterType,
  type ActivityItem,
} from "@/domain/portfolio/unified-activity-feed";
import { FALLBACK_USD_RATE, isCashAssetClass } from "@/domain/portfolio/valuation";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { currentMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { downloadCsv } from "@/services/export-actions";
import { pushToast } from "@/services/toast";
import {
  useAllPortfolioTransactions,
  useDeletePortfolioContribution,
  useDeletePortfolioDividend,
  useDeletePortfolioTransaction,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioPosition,
  useUpdatePortfolioAsset,
} from "@/state";
import type { PortfolioAsset, PortfolioContribution, PortfolioDividend, PortfolioTransaction } from "@/types";
import { executeActivityDeletion } from "./activity-delete-action";

export function useActivityFiltersExport(defaultMonth?: string) {
  const { guardAction, upgradeModal } = useMutationGuard({ moduleKey: "investments" });
  const [month, setMonth] = useState(() => defaultMonth ?? currentMonth());
  const [filterType, setFilterType] = useState<ActivityFilterType>("all");
  const [search, setSearch] = useState("");
  const [itemToDelete, setItemToDelete] = useState<ActivityItem | null>(null);
  const [rollbackCash, setRollbackCash] = useState(true);
  const [editingTx, setEditingTx] = useState<{
    transaction: PortfolioTransaction;
    asset: PortfolioAsset;
    linkedContribution?: PortfolioContribution;
  } | null>(null);
  const [editingDividend, setEditingDividend] = useState<PortfolioDividend | null>(null);
  const [editingContribution, setEditingContribution] = useState<PortfolioContribution | null>(null);

  const transactionsQuery = useAllPortfolioTransactions();
  const contributionsQuery = usePortfolioContributions();
  const dividendsQuery = usePortfolioDividends();
  const assetsQuery = usePortfolioAssets();
  const positionQuery = usePortfolioPosition();

  const deleteTransaction = useDeletePortfolioTransaction();
  const deleteContribution = useDeletePortfolioContribution();
  const deleteDividend = useDeletePortfolioDividend();
  const updateAsset = useUpdatePortfolioAsset();

  const usdRate = positionQuery.rows.find((r) => r.currency === "USD")?.usdRate ?? FALLBACK_USD_RATE;

  const cashAsset = useMemo(
    () => (assetsQuery.data ?? []).find((a) => a.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(a.asset_class)),
    [assetsQuery.data],
  );
  const cashBalance = typeof cashAsset?.quantity === "number" ? cashAsset.quantity : 0;

  const assetMap = useMemo(
    () => new Map((assetsQuery.data ?? []).map((a) => [a.id, a])),
    [assetsQuery.data],
  );

  const allActivities = useMemo(
    () =>
      buildUnifiedActivityTimeline({
        transactions: transactionsQuery.data ?? [],
        contributions: contributionsQuery.data ?? [],
        dividends: dividendsQuery.data ?? [],
        assetMap,
      }),
    [transactionsQuery.data, contributionsQuery.data, dividendsQuery.data, assetMap],
  );

  const monthActivities = useMemo(
    () => allActivities.filter((item) => item.date.startsWith(month)),
    [allActivities, month],
  );

  const monthStats = useMemo(
    () =>
      computeActivityMonthStats({
        monthActivities,
        contributions: contributionsQuery.data ?? [],
        month,
        assetMap,
        usdRate,
      }),
    [monthActivities, contributionsQuery.data, month, assetMap, usdRate],
  );

  const typeCounts = useMemo(
    () => computeActivityTypeCounts(monthActivities, contributionsQuery.data ?? [], month),
    [monthActivities, contributionsQuery.data, month],
  );

  const filteredActivities = useMemo(
    () =>
      filterActivityItems({
        monthActivities,
        filterType,
        selectedClass: "all",
        selectedSector: "all",
        search,
      }),
    [monthActivities, filterType, search],
  );

  const handleExportCsv = () => {
    if (filteredActivities.length === 0) return;
    const rows = mapActivitiesToExportRows(filteredActivities);
    const filterSlug = filterType === "all" ? "todas" : filterType;
    downloadCsv(`movimentacoes_carteira_${month}_${filterSlug}.csv`, serializePortfolioActivitiesCsv(rows));
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await executeActivityDeletion({
        item: itemToDelete,
        rollbackCash,
        cashAsset,
        assetMap,
        usdRate,
        deleteDividend: deleteDividend.mutateAsync,
        deleteTransaction: deleteTransaction.mutateAsync,
        deleteContribution: deleteContribution.mutateAsync,
        updateAsset: updateAsset.mutateAsync,
      });
      pushToast({
        title: "Lançamento excluído",
        description: "A movimentação foi removida e os saldos recalculados.",
      });
      setItemToDelete(null);
      setRollbackCash(true);
    } catch (err) {
      pushToast({
        title: "Erro ao excluir movimentação",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  return {
    guardAction,
    upgradeModal,
    month,
    setMonth,
    filterType,
    setFilterType,
    search,
    setSearch,
    monthStats,
    monthActivitiesCount: monthActivities.length,
    typeCounts,
    filteredActivities,
    assetMap,
    cashAsset,
    cashBalance,
    usdRate,
    isLoading:
      transactionsQuery.isLoading ||
      contributionsQuery.isLoading ||
      dividendsQuery.isLoading ||
      assetsQuery.isLoading,
    isDeleting:
      deleteTransaction.isPending || deleteContribution.isPending || deleteDividend.isPending,
    itemToDelete,
    setItemToDelete,
    rollbackCash,
    setRollbackCash,
    editingTx,
    setEditingTx,
    editingDividend,
    setEditingDividend,
    editingContribution,
    setEditingContribution,
    handleExportCsv,
    handleDeleteItem,
  };
}
