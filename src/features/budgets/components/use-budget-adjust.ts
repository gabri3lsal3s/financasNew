import { useMemo, useState } from "react";
import {
  redistributeProportionalBudget,
  redistributeProportionalBudgetByPercent,
  type ProportionalCategoryInput,
} from "@/domain/budgets";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useSetBatchBudgetLimits } from "@/state";
import type { BudgetAdjustCategoryItem } from "./budget-adjust-dialog";

export const BUDGET_ADJUST_PRESETS = [-15, -10, -5, 5, 10, 15, 20] as const;

export interface UseBudgetAdjustParams {
  month: string;
  categories: BudgetAdjustCategoryItem[];
  onClose: () => void;
}

export function useBudgetAdjust({ month, categories, onClose }: UseBudgetAdjustParams) {
  const [mode, setMode] = useState<"percent" | "target">("percent");
  const [percent, setPercent] = useState<number>(10);

  const totalCurrentCents = useMemo(
    () => categories.reduce((acc, c) => acc + Math.max(0, c.currentLimitCents), 0),
    [categories],
  );

  const [targetTotalCents, setTargetTotalCents] = useState<number>(() =>
    Math.max(0, Math.round(totalCurrentCents * 1.1)),
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBatchLimits = useSetBatchBudgetLimits();

  const domainCategories: ProportionalCategoryInput[] = useMemo(
    () =>
      categories.map((c) => ({
        categoryId: c.category.id,
        name: c.category.name,
        currentLimitCents: c.currentLimitCents,
      })),
    [categories],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.category.id, c.category])),
    [categories],
  );

  const result = useMemo(() => {
    if (mode === "percent") {
      return redistributeProportionalBudgetByPercent(domainCategories, percent);
    }
    return redistributeProportionalBudget(domainCategories, targetTotalCents);
  }, [domainCategories, mode, percent, targetTotalCents]);

  const handleModeChange = (newModeStr: string) => {
    const newMode = newModeStr as "percent" | "target";
    if (newMode === "target" && mode === "percent") {
      setTargetTotalCents(result.totalNewCents);
    } else if (newMode === "percent" && mode === "target") {
      const delta =
        totalCurrentCents > 0
          ? ((targetTotalCents - totalCurrentCents) / totalCurrentCents) * 100
          : 0;
      setPercent(Math.round(delta));
    }
    setMode(newMode);
  };

  const handleSelectPreset = (p: number) => {
    triggerSensory("selection");
    setPercent(p);
  };

  const handleApply = async () => {
    if (categories.length === 0 || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const itemsToSave =
        totalCurrentCents === 0
          ? result.items
          : result.items.filter((item) => item.currentLimitCents > 0 || item.newLimitCents > 0);
      await setBatchLimits.mutateAsync({
        month,
        items: itemsToSave.map((item) => ({
          categoryId: item.categoryId,
          limit: item.newLimitCents / 100,
        })),
      });
      triggerSensory("success");
      onClose();
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  };

  return {
    mode,
    percent,
    setPercent,
    targetTotalCents,
    setTargetTotalCents,
    isPending,
    error,
    categoryMap,
    result,
    handleModeChange,
    handleSelectPreset,
    handleApply,
  };
}
