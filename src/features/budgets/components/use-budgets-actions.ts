import { useState } from "react";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useReallocateBudget,
  useSeedDefaultCategories,
  useUpdatePublicShare,
} from "@/state";
import type { GoalCompositionConfig, PublicShare } from "@/types";

export interface UseBudgetsActionsParams {
  month: string;
  isReadOnlyMode: boolean;
  suggestion: { fromCategoryId: string; toCategoryId: string; amountCents: number } | null;
  compositionShare: PublicShare | null;
  setCompositionShare: (share: PublicShare | null) => void;
  setReallocateOpen: (open: boolean) => void;
  setReallocateError: (err: string | null) => void;
  setUpgradeContext: (ctx: string | undefined) => void;
  setUpgradeOpen: (open: boolean) => void;
}

export function useBudgetsActions(params: UseBudgetsActionsParams) {
  const {
    month,
    isReadOnlyMode,
    suggestion,
    compositionShare,
    setCompositionShare,
    setReallocateOpen,
    setReallocateError,
    setUpgradeContext,
    setUpgradeOpen,
  } = params;

  const [seedFeedback, setSeedFeedback] = useState<string | null>(null);
  const reallocate = useReallocateBudget();
  const seedCategoriesMutation = useSeedDefaultCategories();
  const updatePublicShareMutation = useUpdatePublicShare();

  const handleSeedCategories = async () => {
    if (isReadOnlyMode) {
      setUpgradeContext("Carregar Categorias Padrão");
      setUpgradeOpen(true);
      return;
    }
    setSeedFeedback(null);
    try {
      const count = await seedCategoriesMutation.mutateAsync();
      triggerSensory("success");
      setSeedFeedback(
        count > 0
          ? `${count} categorias padrão carregadas com sucesso.`
          : "Todas as categorias padrão já estão presentes no seu catálogo.",
      );
    } catch (err) {
      triggerSensory("error");
      setSeedFeedback(getErrorMessage(err));
    }
  };

  const applyReallocation = async () => {
    if (!suggestion) return;
    setReallocateError(null);
    try {
      await reallocate.mutateAsync({
        fromCategoryId: suggestion.fromCategoryId,
        toCategoryId: suggestion.toCategoryId,
        month,
        amount: suggestion.amountCents / 100,
      });
      triggerSensory("success");
      setReallocateOpen(false);
    } catch (err) {
      triggerSensory("error");
      setReallocateError(getErrorMessage(err));
    }
  };

  const handleCompositionSave = (
    newConfig: GoalCompositionConfig,
    previewResult: { isReached: boolean; targetCents: number; currentCents: number },
  ) => {
    if (!compositionShare) return;
    const currentPayload = (compositionShare.payload as Record<string, unknown>) ?? {};
    const isNowCompleted =
      previewResult.isReached ||
      (previewResult.targetCents > 0 && previewResult.currentCents >= previewResult.targetCents);

    updatePublicShareMutation.mutate({
      id: compositionShare.id,
      payload: {
        ...currentPayload,
        composition_config: newConfig,
        current_cents: previewResult.currentCents,
        status: isNowCompleted
          ? "completed"
          : currentPayload.status === "completed"
            ? "active"
            : (currentPayload.status ?? "active"),
      },
    });
    triggerSensory("success");
    pushToast({
      title: "Termômetro patrimonial sincronizado!",
      description: "O saldo em conta e os investimentos foram vinculados à meta com sucesso.",
      variant: "success",
    });
    setCompositionShare(null);
  };

  return {
    isSeeding: seedCategoriesMutation.isPending,
    isSeedError: seedCategoriesMutation.isError,
    seedFeedback,
    isReallocatePending: reallocate.isPending,
    handleSeedCategories,
    applyReallocation,
    handleCompositionSave,
  };
}
