import { useMemo, useState } from "react";
import {
  detectSuggestedReserveAssets,
  resolveEmergencyFundComposition,
  type PortfolioPositionRowLike,
} from "@/domain/projection";
import type { EmergencyFundConfig, EmergencySelectionMode } from "@/types";

export interface UseEmergencyFundFormParams {
  open: boolean;
  config: EmergencyFundConfig;
  realCashCents: number;
  portfolioRows: PortfolioPositionRowLike[];
  monthlyExpensesCents: number;
  onSave: (config: EmergencyFundConfig) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function useEmergencyFundForm({
  open,
  config,
  realCashCents,
  portfolioRows,
  monthlyExpensesCents,
  onSave,
  onOpenChange,
}: UseEmergencyFundFormParams) {
  const [includeCheckingAccounts, setIncludeCheckingAccounts] = useState(
    config.includeCheckingAccounts ?? true,
  );
  const [selectionMode, setSelectionMode] = useState<EmergencySelectionMode>(
    config.selectionMode ?? "selected_assets",
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    config.selectedAssetIds ?? [],
  );
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    config.selectedClasses ?? [],
  );
  const [useNetValue, setUseNetValue] = useState(config.useNetValue ?? true);
  const [targetMonths, setTargetMonths] = useState<3 | 6 | 12>(config.targetMonths ?? 6);
  const [isSaving, setIsSaving] = useState(false);

  // Sincroniza e descarta alterações não salvas sempre que o modal fecha/abre
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setIncludeCheckingAccounts(config.includeCheckingAccounts ?? true);
    setSelectionMode(config.selectionMode ?? "selected_assets");
    setSelectedAssetIds(config.selectedAssetIds ?? []);
    setSelectedClasses(config.selectedClasses ?? []);
    setUseNetValue(config.useNetValue ?? true);
    setTargetMonths(config.targetMonths ?? 6);
  }

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const r of portfolioRows) {
      if (r.assetClass && r.quantity > 0 && (r.valueBRL ?? 0) > 0) {
        set.add(r.assetClass.trim());
      }
    }
    return Array.from(set).sort();
  }, [portfolioRows]);

  const previewComposition = useMemo(() => {
    return resolveEmergencyFundComposition({
      config: {
        includeCheckingAccounts,
        selectionMode,
        selectedAssetIds,
        selectedClasses,
        useNetValue,
        targetMonths,
      },
      realCashCents,
      portfolioRows,
      monthlyExpensesCents,
    });
  }, [
    includeCheckingAccounts,
    selectionMode,
    selectedAssetIds,
    selectedClasses,
    useNetValue,
    targetMonths,
    realCashCents,
    portfolioRows,
    monthlyExpensesCents,
  ]);

  const coverageMonths =
    monthlyExpensesCents > 0
      ? Number((previewComposition.totalReserveCents / monthlyExpensesCents).toFixed(1))
      : 0;

  const handleToggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  };

  const handleToggleClass = (className: string) => {
    const norm = className.trim().toLowerCase();
    setSelectedClasses((prev) => {
      const exists = prev.some((c) => c.trim().toLowerCase() === norm);
      return exists
        ? prev.filter((c) => c.trim().toLowerCase() !== norm)
        : [...prev, className];
    });
  };

  const handleSuggestReserveAssets = () => {
    setSelectedAssetIds(detectSuggestedReserveAssets(portfolioRows));
  };

  const handleSelectAllAssets = () => {
    const allIds = portfolioRows
      .filter((r) => r.quantity > 0 && (r.valueBRL ?? 0) > 0)
      .map((r) => r.assetId);
    setSelectedAssetIds(allIds);
  };

  const handleClearAssets = () => {
    setSelectedAssetIds([]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        includeCheckingAccounts,
        selectionMode,
        selectedAssetIds,
        selectedClasses,
        useNetValue,
        targetMonths,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    includeCheckingAccounts !== (config.includeCheckingAccounts ?? true) ||
    selectionMode !== (config.selectionMode ?? "selected_assets") ||
    JSON.stringify(selectedAssetIds.slice().sort()) !==
      JSON.stringify((config.selectedAssetIds ?? []).slice().sort()) ||
    JSON.stringify(selectedClasses.slice().sort()) !==
      JSON.stringify((config.selectedClasses ?? []).slice().sort()) ||
    useNetValue !== (config.useNetValue ?? true) ||
    targetMonths !== (config.targetMonths ?? 6);

  const resetToConfig = () => {
    setIncludeCheckingAccounts(config.includeCheckingAccounts ?? true);
    setSelectionMode(config.selectionMode ?? "selected_assets");
    setSelectedAssetIds(config.selectedAssetIds ?? []);
    setSelectedClasses(config.selectedClasses ?? []);
    setUseNetValue(config.useNetValue ?? true);
    setTargetMonths(config.targetMonths ?? 6);
  };

  return {
    isDirty,
    resetToConfig,
    includeCheckingAccounts,
    setIncludeCheckingAccounts,
    selectionMode,
    setSelectionMode,
    selectedAssetIds,
    selectedClasses,
    useNetValue,
    setUseNetValue,
    targetMonths,
    setTargetMonths,
    isSaving,
    availableClasses,
    previewComposition,
    coverageMonths,
    handleToggleAsset,
    handleToggleClass,
    handleSuggestReserveAssets,
    handleSelectAllAssets,
    handleClearAssets,
    handleSave,
  };
}
