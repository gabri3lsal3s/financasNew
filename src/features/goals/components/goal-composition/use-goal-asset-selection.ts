import { useMemo, useState } from "react";
import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";
import { usePortfolioPosition, useRealCashBalance } from "@/state";
import type {
  GoalCompositionConfig,
  GoalCompositionResult,
  GoalInvestmentSelectionMode,
} from "@/types/goals";

export interface UseGoalAssetSelectionParams {
  config?: GoalCompositionConfig | null;
  targetCents: number;
  isCompleted: boolean;
}

export function useGoalAssetSelection({
  config,
  targetCents,
  isCompleted,
}: UseGoalAssetSelectionParams) {
  const [includeCheckingAccounts, setIncludeCheckingAccounts] = useState(
    config?.includeCheckingAccounts ?? true,
  );
  const [includeInvestments, setIncludeInvestments] = useState(
    config?.includeInvestments ?? false,
  );
  const { cashBalance } = useRealCashBalance(undefined, { enabled: includeCheckingAccounts });
  const { rows: positionRows, isLoading: isPositionLoading } = usePortfolioPosition({
    enabled: includeInvestments,
  });
  const [investmentMode, setInvestmentMode] = useState<GoalInvestmentSelectionMode>(
    config?.investmentMode ?? "selected_assets",
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(config?.assetIds ?? []);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(config?.classes ?? []);
  const [allocationCapCents, setAllocationCapCents] = useState<number | undefined>(
    config?.allocationCapCents ?? undefined,
  );
  const [isCompletedLocked, setIsCompletedLocked] = useState(
    config?.isCompletedLocked ?? false,
  );

  const accounts: AccountCompositionItem[] = useMemo(() => {
    const currentBalance = Math.max(0, cashBalance?.currentBalanceCents ?? 0);
    return [
      {
        id: "main_cash",
        name: "Saldo em Conta Corrente / Caixa Geral",
        balanceCents: currentBalance,
        pendingObligationsCents: 0,
      },
    ];
  }, [cashBalance]);

  const portfolioAssets: PortfolioAssetCompositionItem[] = useMemo(
    () =>
      positionRows
        .filter((r) => r.quantity > 0 || r.valueBRL > 0)
        .map((r) => ({
          id: r.assetId,
          ticker: r.ticker,
          assetClass: r.assetClass,
          quantity: r.quantity > 0 ? r.quantity : 1,
          valueCents: Math.round(r.valueBRL * 100),
          totalCostCents: Math.round(r.totalCostBRL * 100),
        })),
    [positionRows],
  );

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const r of positionRows) {
      if ((r.quantity > 0 || r.valueBRL > 0) && r.assetClass && r.assetClass.trim().length > 0) {
        set.add(r.assetClass.trim());
      }
    }
    return Array.from(set).sort();
  }, [positionRows]);

  const activeConfig: GoalCompositionConfig = useMemo(
    () => ({
      includeCheckingAccounts,
      accountIds: null,
      includeInvestments,
      investmentMode,
      assetIds: selectedAssetIds,
      classes: selectedClasses,
      allocationCapCents: allocationCapCents && allocationCapCents > 0 ? allocationCapCents : null,
      isCompletedLocked,
    }),
    [
      includeCheckingAccounts,
      includeInvestments,
      investmentMode,
      selectedAssetIds,
      selectedClasses,
      allocationCapCents,
      isCompletedLocked,
    ],
  );

  const preview: GoalCompositionResult = useMemo(
    () =>
      resolveGoalComposition({
        config: activeConfig,
        targetCents,
        accounts,
        assets: portfolioAssets,
        previouslyLockedAsCompleted: isCompleted,
      }),
    [activeConfig, targetCents, accounts, portfolioAssets, isCompleted],
  );

  const totalPortfolioCents = useMemo(
    () => portfolioAssets.reduce((acc, a) => acc + a.valueCents, 0),
    [portfolioAssets],
  );

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  };

  const toggleClass = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className],
    );
  };

  return {
    includeCheckingAccounts,
    setIncludeCheckingAccounts,
    includeInvestments,
    setIncludeInvestments,
    investmentMode,
    setInvestmentMode,
    selectedAssetIds,
    selectedClasses,
    allocationCapCents,
    setAllocationCapCents,
    isCompletedLocked,
    setIsCompletedLocked,
    isPositionLoading,
    portfolioAssets,
    availableClasses,
    totalPortfolioCents,
    activeConfig,
    preview,
    toggleAsset,
    toggleClass,
  };
}
