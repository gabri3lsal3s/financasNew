import { useCallback, useMemo, useState } from "react";
import type { CustomAporteExecutionItem } from "@/components/modules/aporte-result";
import { todayISO } from "@/domain/debts";
import {
  buildAporteSimulationViewModel,
  buildBatchAportePayload,
} from "@/domain/portfolio/aporte-execution-mapper";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { getErrorMessage } from "@/services/errors";
import {
  useExecutePortfolioBatchAporte,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioAsset } from "@/types";
import { useAporteUrlAnimations } from "./use-aporte-url-animations";

export function useAporteAllocator(onGoToPosition?: () => void) {
  const { guardAction, upgradeModal } = useMutationGuard({ moduleKey: "investments" });
  const position = usePortfolioPosition();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const assetsQuery = usePortfolioAssets();
  const executeBatch = useExecutePortfolioBatchAporte();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardAsset, setWizardAsset] = useState<PortfolioAsset | null>(null);
  const [wizardQuantity, setWizardQuantity] = useState<number | undefined>(undefined);
  const [wizardTotalCents, setWizardTotalCents] = useState<number | undefined>(undefined);
  const [evaluationAsset, setEvaluationAsset] = useState<PortfolioAsset | null>(null);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [pendingCustomItems, setPendingCustomItems] = useState<CustomAporteExecutionItem[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const availableCashCents = Math.max(0, Math.round(position.cashBRL * 100));

  const urlAnim = useAporteUrlAnimations({
    availableCashCents,
    isPositionLoading: position.isLoading,
  });

  const effectiveCashSelectedCents =
    urlAnim.useBrokerageCash && availableCashCents > 0
      ? Math.min(Math.max(0, urlAnim.cashUsedCents), availableCashCents)
      : 0;
  const totalPurchasingCents = urlAnim.userAporteCents + effectiveCashSelectedCents;

  const simulation = useMemo(
    () =>
      buildAporteSimulationViewModel({
        totalPurchasingCents,
        positionRows: position.rows,
        rawAssets: assetsQuery.data ?? [],
        rawClassTargets: classTargetsQuery.data ?? [],
        rawSectorTargets: sectorTargetsQuery.data ?? [],
      }),
    [totalPurchasingCents, position.rows, assetsQuery.data, classTargetsQuery.data, sectorTargetsQuery.data],
  );

  const handleOpenWizardForAsset = useCallback(
    (ticker: string, quantity: number, allocatedBRL?: number) => {
      const asset =
        (assetsQuery.data ?? []).find((a) => a.ticker.toUpperCase() === ticker.toUpperCase()) ?? null;
      if (asset) {
        setWizardAsset(asset);
        setWizardQuantity(quantity > 0 ? quantity : undefined);
        setWizardTotalCents(allocatedBRL && allocatedBRL > 0 ? Math.round(allocatedBRL * 100) : undefined);
        setWizardOpen(true);
      }
    },
    [assetsQuery.data],
  );

  const handleOpenEvaluationForAsset = useCallback(
    (ticker: string) => {
      const asset =
        (assetsQuery.data ?? []).find((a) => a.ticker.toUpperCase() === ticker.toUpperCase()) ?? null;
      if (asset) {
        setEvaluationAsset(asset);
      }
    },
    [assetsQuery.data],
  );

  const handleTriggerAporte = (items?: CustomAporteExecutionItem[]) => {
    guardAction(() => {
      setPendingCustomItems(items ?? null);
      setConfirmBatchOpen(true);
    }, "Registrar Aporte");
  };

  const handleExecuteBatch = async () => {
    const activeItems: CustomAporteExecutionItem[] =
      pendingCustomItems ??
      simulation.eligibleRoutes.map((r) => ({
        assetId: r.assetId,
        ticker: r.ticker,
        quantity: r.quantity,
        priceBRL: r.priceBRL,
        allocatedBRL: r.allocatedBRL,
      }));
    if (activeItems.length === 0 || isApplying) return;

    setBatchError(null);
    setIsApplying(true);
    try {
      const payload = buildBatchAportePayload({
        items: activeItems,
        positionRows: position.rows,
        cashSelectedCents: effectiveCashSelectedCents,
        positionCashBRL: position.cashBRL,
        date: todayISO(),
      });
      await executeBatch.mutateAsync(payload);

      setConfirmBatchOpen(false);
      setPendingCustomItems(null);
      urlAnim.setUserAporteCents(0);
      urlAnim.setUseBrokerageCash(false);
      urlAnim.setCashUsedCents(0);
      onGoToPosition?.();
    } catch (err) {
      setBatchError(getErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  const refetchAll = () => {
    position.refetch();
    void classTargetsQuery.refetch();
    void sectorTargetsQuery.refetch();
    void assetsQuery.refetch();
  };

  return {
    upgradeModal,
    loading: position.isLoading || classTargetsQuery.isLoading || sectorTargetsQuery.isLoading,
    error: position.error ?? classTargetsQuery.error ?? sectorTargetsQuery.error,
    refetchAll,
    aporteCents: urlAnim.userAporteCents,
    setAporteCents: urlAnim.setUserAporteCents,
    animateToCents: urlAnim.animateToCents,
    availableCashCents,
    useBrokerageCash: urlAnim.useBrokerageCash,
    setUseBrokerageCash: urlAnim.setUseBrokerageCash,
    cashUsedCents: urlAnim.cashUsedCents,
    setCashUsedCents: urlAnim.setCashUsedCents,
    effectiveCashSelectedCents,
    totalPurchasingCents,
    cashHighlight: urlAnim.cashHighlight,
    simulation,
    batchError,
    isApplying,
    confirmBatchOpen,
    setConfirmBatchOpen,
    pendingCustomItems,
    setPendingCustomItems,
    handleTriggerAporte,
    handleExecuteBatch,
    wizardOpen,
    setWizardOpen,
    wizardAsset,
    wizardQuantity,
    wizardTotalCents,
    handleOpenWizardForAsset,
    evaluationAsset,
    setEvaluationAsset,
    handleOpenEvaluationForAsset,
  };
}
