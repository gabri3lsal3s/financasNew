import { useCallback, useState } from "react";
import type { NavigateFunction } from "react-router";
import { advanceSmartDecay } from "@/domain/insights";
import {
  createGoalDismissalCheckpoint,
  createPaceDismissalCheckpoint,
  createSurplusDismissalCheckpoint,
  createTimedDismissalCheckpoint,
} from "@/domain/overview";
import type { DashboardAlertDismissals, PublicShare, SmartDecayMetaRecord } from "@/types";

interface UseOverviewModalsParams {
  month: string;
  navigate: NavigateFunction;
  clearDetectedPix: () => void;
  updateAlertDismissals: (
    updater: (prev: DashboardAlertDismissals) => DashboardAlertDismissals,
  ) => void;
  paceSpentPercent: number;
  projectionSurplusCents: number | null;
  surplusSuggestedAporteCents: number;
  hasSurplus: boolean;
  liveGoalProgress: ReadonlyMap<
    string,
    { currentCents: number; percentage: number; isCompleted: boolean }
  >;
  advisorDecayMeta?: Record<string, SmartDecayMetaRecord>;
  onPersistDecayMeta?: (nextMeta: Record<string, SmartDecayMetaRecord>) => void;
}

/**
 * Gerencia estado dos modais/gavetas da Home, descarte contextual de alertas
 * e preenchimento de lançamento rápido via Pix detectado no clipboard.
 */
export function useOverviewModals({
  month,
  navigate,
  clearDetectedPix,
  updateAlertDismissals,
  paceSpentPercent,
  projectionSurplusCents,
  surplusSuggestedAporteCents,
  hasSurplus,
  liveGoalProgress,
  advisorDecayMeta,
  onPersistDecayMeta,
}: UseOverviewModalsParams) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isOthersBudgetOpen, setIsOthersBudgetOpen] = useState(false);
  const [isOtherCategoriesOpen, setIsOtherCategoriesOpen] = useState(false);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [depositGoalShare, setDepositGoalShare] = useState<PublicShare | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [onboardingChecklistOpen, setOnboardingChecklistOpen] = useState(false);
  const [initialPreferencesOpen, setInitialPreferencesOpen] = useState(false);
  const [demoTrackModalOpen, setDemoTrackModalOpen] = useState(false);

  const handleLaunchPixFromClipboard = useCallback(
    (params: {
      valorCents?: number;
      desc?: string;
      categoria?: string;
      tipo?: "expense" | "income";
      forma?: "pix";
      pixKey?: string;
    }) => {
      clearDetectedPix();
      const search = new URLSearchParams();
      search.set("novo", params.tipo || "despesa");
      search.set("modo", "rapido");
      search.set("forma", "pix");
      if (params.valorCents) search.set("valor", String(params.valorCents));
      if (params.desc) search.set("desc", params.desc);
      if (params.categoria) search.set("categoria", params.categoria);
      navigate({ pathname: "/", search: search.toString() });
    },
    [clearDetectedPix, navigate],
  );

  const advanceDecayFamily = useCallback(
    (family: "pace" | "surplus" | "cash_gap") => {
      if (!onPersistDecayMeta) return;
      const currentMeta = advisorDecayMeta ?? {};
      const evaluation = advanceSmartDecay(currentMeta[family]);
      onPersistDecayMeta({
        ...currentMeta,
        [family]: evaluation.record,
      });
    },
    [advisorDecayMeta, onPersistDecayMeta],
  );

  const handleDismissPace = useCallback(
    (days: 7 | 30 = 7) => {
      updateAlertDismissals((prev) => ({
        ...prev,
        pace: createPaceDismissalCheckpoint(
          {
            month,
            spentPercent: paceSpentPercent,
            surplusCents: projectionSurplusCents,
          },
          days,
        ),
      }));
      advanceDecayFamily("pace");
    },
    [month, paceSpentPercent, projectionSurplusCents, updateAlertDismissals, advanceDecayFamily],
  );

  const handleDismissSurplus = useCallback(
    (days: 7 | 30 = 7) => {
      updateAlertDismissals((prev) => ({
        ...prev,
        surplus: createSurplusDismissalCheckpoint(
          {
            month,
            surplusCents: surplusSuggestedAporteCents,
          },
          days,
        ),
      }));
      advanceDecayFamily("surplus");
    },
    [month, surplusSuggestedAporteCents, updateAlertDismissals, advanceDecayFamily],
  );

  const handleDismissGoal = useCallback(
    (share: PublicShare, days: 7 | 30 = 30) => {
      const pld = (share.payload as Record<string, unknown> | null) ?? {};
      const targetCents = Number(pld.target_cents ?? 0);
      const live = liveGoalProgress.get(share.id)?.currentCents;
      const currentCents = live !== undefined ? live : Number(pld.current_cents ?? 0);
      const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
      const isCompleted = targetCents > 0 ? currentCents >= targetCents : pld.status === "completed";
      const isFinalStretch = percentage >= 80 && !isCompleted;
      const stage: "completed" | "final_stretch" | "has_surplus" | "regular" = isCompleted
        ? "completed"
        : isFinalStretch
          ? "final_stretch"
          : hasSurplus
            ? "has_surplus"
            : "regular";

      updateAlertDismissals((prev) => ({
        ...prev,
        goals: {
          ...prev.goals,
          [share.id]: createGoalDismissalCheckpoint(
            {
              goalId: share.id,
              currentCents,
              targetCents,
              percentage,
              stage,
            },
            days,
          ),
        },
      }));
    },
    [liveGoalProgress, hasSurplus, updateAlertDismissals],
  );

  const handleDismissGovernance = useCallback(
    (days: 7 | 30 = 7) => {
      const now = Date.now();
      updateAlertDismissals((prev) => ({
        ...prev,
        governance: {
          dismissedUntil: now + days * 24 * 60 * 60 * 1000,
          dismissedAt: new Date(now).toISOString(),
        },
      }));
    },
    [updateAlertDismissals],
  );

  const handleDismissCard = useCallback(
    (cardKey: string, days: 7 | 30 = 7) => {
      updateAlertDismissals((prev) => ({
        ...prev,
        cards: {
          ...(prev.cards ?? {}),
          [cardKey]: createTimedDismissalCheckpoint(days),
        },
      }));
      if (cardKey === "cash-gap-alert") {
        advanceDecayFamily("cash_gap");
      }
    },
    [updateAlertDismissals, advanceDecayFamily],
  );

  return {
    selectedCategoryId,
    setSelectedCategoryId,
    isOthersBudgetOpen,
    setIsOthersBudgetOpen,
    isOtherCategoriesOpen,
    setIsOtherCategoriesOpen,
    checkpointOpen,
    setCheckpointOpen,
    depositGoalShare,
    setDepositGoalShare,
    welcomeDismissed,
    setWelcomeDismissed,
    onboardingChecklistOpen,
    setOnboardingChecklistOpen,
    initialPreferencesOpen,
    setInitialPreferencesOpen,
    demoTrackModalOpen,
    setDemoTrackModalOpen,
    handleLaunchPixFromClipboard,
    handleDismissPace,
    handleDismissSurplus,
    handleDismissGoal,
    handleDismissGovernance,
    handleDismissCard,
  };
}
