import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import {
  Briefcase,
  Camera,
  CreditCard,
  HeartHandshake,
  TrendingDown,
} from "lucide-react";
import {
  hasSeenWelcomeModal,
  markNativeOnboardingSeen,
  markWelcomeModalSeen,
  setStoredInitialGoal,
} from "@/state/demo-mode";
import { useInstallCategoryKit, useUpdateCustomSettings } from "@/state";
import { CATEGORY_KIT_BUSINESS, CATEGORY_KIT_FAMILY } from "@/domain/budgets";
import type { OnboardingGoalId } from "@/types";

export type { OnboardingGoalId };

export interface OnboardingGoalOption {
  id: OnboardingGoalId;
  title: string;
  description: string;
  route: string;
  icon: typeof CreditCard;
  badge: string;
}

export const GOAL_OPTIONS: readonly OnboardingGoalOption[] = [
  {
    id: "cards",
    title: "Controlar cartões e faturas",
    description: "Evite surpresas no fechamento e veja seu melhor dia de compra em tempo real.",
    route: "/cartoes",
    icon: CreditCard,
    badge: "Essencial",
  },
  {
    id: "business",
    title: "Gestão do MEI ou negócio próprio",
    description: "Separe finanças PJ, controle a guia DAS e acompanhe o Ponto de Equilíbrio.",
    route: "/negocio",
    icon: Briefcase,
    badge: "Modo Negócio",
  },
  {
    id: "family",
    title: "Finanças do casal ou família",
    description: "Espaço compartilhado, divisão justa de contas e cofrinhos colaborativos.",
    route: "/familia",
    icon: HeartHandshake,
    badge: "Espaço Família",
  },
  {
    id: "ocr",
    title: "Lançar sem digitação via OCR",
    description: "Capture cupons, comprovantes Pix e boletos instantaneamente pela câmera.",
    route: "/transacoes?novo=transacao",
    icon: Camera,
    badge: "Pro",
  },
  {
    id: "debts",
    title: "Equilibrar contas e quitar dívidas",
    description: "Planeje a quitação acelerada pelo método Bola de Neve ou Avalanche.",
    route: "/dividas",
    icon: TrendingDown,
    badge: "Estratégia",
  },
];

export interface UseInitialOnboardingOptions {
  open?: boolean;
  forceShow?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStartTour?: () => void;
  onStartRealAccount?: () => void;
}

export function useInitialOnboarding({
  open,
  forceShow = false,
  onOpenChange,
  onStartTour,
  onStartRealAccount,
}: UseInitialOnboardingOptions) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedGoal, setSelectedGoal] = useState<OnboardingGoalId>("cards");
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const installKitMutation = useInstallCategoryKit();

  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (forceShow) return true;
    if (open !== undefined) return open;
    return !hasSeenWelcomeModal();
  });

  const isVisible = open !== undefined ? open : internalOpen;

  const persistOnboardingGoal = useCallback(
    (goalId: OnboardingGoalId) => {
      setStoredInitialGoal(goalId);
      try {
        updateCustomSettingsMutation.mutate({
          initialGoal: goalId,
          familyModeEnabled: goalId === "family",
          businessModeEnabled: goalId === "business",
        });

        if (goalId === "business") {
          // Provisiona silenciosamente as categorias fundamentais de PJ
          void installKitMutation.mutateAsync(CATEGORY_KIT_BUSINESS.items.slice(0, 3));
        } else if (goalId === "family") {
          // Provisiona silenciosamente as categorias fundamentais de Família
          void installKitMutation.mutateAsync(CATEGORY_KIT_FAMILY.items.slice(0, 2));
        }
      } catch {
        // Ignora falha assíncrona se desconectado
      }
    },
    [updateCustomSettingsMutation, installKitMutation],
  );

  const handleClose = useCallback(() => {
    markWelcomeModalSeen();
    markNativeOnboardingSeen();
    persistOnboardingGoal(selectedGoal);
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange, persistOnboardingGoal, selectedGoal]);

  const handleStartTour = useCallback(() => {
    handleClose();
    onStartTour?.();
  }, [handleClose, onStartTour]);

  const handleStartGoal = useCallback(
    (goalId: OnboardingGoalId) => {
      persistOnboardingGoal(goalId);
      handleClose();
      onStartRealAccount?.();
      const goal = GOAL_OPTIONS.find((g) => g.id === goalId);
      if (goal) {
        navigate(goal.route);
      }
    },
    [handleClose, navigate, onStartRealAccount, persistOnboardingGoal],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        handleClose();
      } else {
        setInternalOpen(true);
        onOpenChange?.(true);
      }
    },
    [handleClose, onOpenChange],
  );

  return {
    currentStep,
    setCurrentStep,
    selectedGoal,
    setSelectedGoal,
    isVisible,
    handleClose,
    handleStartTour,
    handleStartGoal,
    handleOpenChange,
  };
}
