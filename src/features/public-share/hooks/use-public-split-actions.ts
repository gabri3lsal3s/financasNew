import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { reportError } from "@/services/observability";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useSaveSplitExpense, useSignalSplitPayment } from "@/state";
import type {
  Category,
  SplitParticipantInstallment,
  SplitParticipantItem,
  SplitSharePayload,
} from "@/types";
import type { UsePublicSplitGuestIdentityReturn } from "./use-public-split-guest-identity";
import {
  findGuestParticipantForSession,
  matchSplitCategoryByName,
  resolveGuestActorName,
} from "./split-guest-resolution";

interface UsePublicSplitActionsParams {
  token: string;
  payload: SplitSharePayload | null;
  categories: Category[];
  normalizedParticipants: SplitParticipantItem[];
  currentParticipant: SplitParticipantItem | null;
  selectedParticipant: SplitParticipantItem | null;
  setSelectedParticipant: (p: SplitParticipantItem | null) => void;
  participantInstallments?: SplitParticipantInstallment[];
  selectedInstallment: SplitParticipantInstallment | null;
  isPayAllRemaining?: boolean;
  effectiveChargeCents: number;
  isHostViewing?: boolean;
  isCurrentParticipantSettled?: boolean;
  guestIdentity: UsePublicSplitGuestIdentityReturn;
}

/**
 * Ações assíncronas da página pública de racha (/r/:token):
 * salvamento de despesa na conta e sinalização de pagamento Pix ao anfitrião.
 */
export function usePublicSplitActions({
  token,
  payload,
  categories,
  normalizedParticipants,
  currentParticipant,
  selectedParticipant,
  setSelectedParticipant,
  participantInstallments = [],
  selectedInstallment,
  isPayAllRemaining = false,
  effectiveChargeCents,
  isHostViewing = false,
  isCurrentParticipantSettled = false,
  guestIdentity,
}: UsePublicSplitActionsParams) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const saveSplitMutation = useSaveSplitExpense();
  const signalSplitPaymentMutation = useSignalSplitPayment();

  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isSelectCategoryOpen, setIsSelectCategoryOpen] = useState(false);
  const [isSelectParticipantOpen, setIsSelectParticipantOpen] = useState(false);
  const [participantSelectionIntent, setParticipantSelectionIntent] = useState<"save" | "signal">("save");
  const [isSavingDirectly, setIsSavingDirectly] = useState(false);
  const [isSignalingDirectly, setIsSignalingDirectly] = useState(false);
  const [justSignaledInstallmentIds, setJustSignaledInstallmentIds] = useState<Set<string>>(new Set());

  const resolveUnsettledGuest = useCallback(
    (intent: "save" | "signal"): SplitParticipantItem | null | "prompted" => {
      if (currentParticipant) return currentParticipant;
      const { autoSelected, requiresPicker } = findGuestParticipantForSession(
        normalizedParticipants,
        intent === "save" ? session?.user?.user_metadata : undefined,
      );
      if (autoSelected) {
        setSelectedParticipant(autoSelected);
        if (autoSelected.id) guestIdentity.setActiveParticipantId(autoSelected.id);
        return autoSelected;
      }
      if (requiresPicker) {
        setParticipantSelectionIntent(intent);
        setIsSelectParticipantOpen(true);
        return "prompted";
      }
      return null;
    },
    [currentParticipant, normalizedParticipants, guestIdentity, session, setSelectedParticipant],
  );

  const executeSaveAndSignal = useCallback(
    async (participant?: SplitParticipantItem | null, categoryId?: string) => {
      if (!payload) return;
      setIsSavingDirectly(true);
      try {
        await saveSplitMutation.mutateAsync({
          title: payload.title,
          amountCents: effectiveChargeCents > 0 ? effectiveChargeCents : payload.guest_share_cents,
          date: payload.date,
          categoryId,
        });
        const targetInstIds =
          isPayAllRemaining && participantInstallments.length > 0
            ? participantInstallments.filter((i) => !i.is_settled).map((i) => i.id)
            : selectedInstallment?.id
              ? [selectedInstallment.id]
              : [];

        if (token && !isHostViewing && !isCurrentParticipantSettled && effectiveChargeCents > 0 && !participant?.is_host) {
          try {
            await signalSplitPaymentMutation.mutateAsync({
              token,
              participantName: resolveGuestActorName(participant, session?.user, "Participante"),
              amountCents: effectiveChargeCents,
              participantId: participant?.id,
              installmentId: targetInstIds[0] ?? null,
              ...(targetInstIds.length > 0 ? { installmentIds: targetInstIds } : {}),
            });
          } catch (signalErr) {
            reportError(signalErr, { source: "usePublicSplitActions.signalSplitPayment" });
          }
        }
        triggerSensory("success");
        pushToast({
          title: "Despesa registrada!",
          description: isCurrentParticipantSettled
            ? "Lançamento salvo na sua conta."
            : "Avisamos o anfitrião sobre o seu pagamento para conferência.",
          variant: "success",
        });
        navigate("/transacoes");
      } catch {
        triggerSensory("destructive");
      } finally {
        setIsSavingDirectly(false);
      }
    },
    [
      payload,
      effectiveChargeCents,
      isPayAllRemaining,
      participantInstallments,
      selectedInstallment,
      isHostViewing,
      isCurrentParticipantSettled,
      saveSplitMutation,
      signalSplitPaymentMutation,
      token,
      session,
      navigate,
    ],
  );

  const handleSaveExpenseClick = useCallback(async () => {
    if (!payload) return;
    if (!session?.user) {
      setIsOnboardingModalOpen(true);
      return;
    }
    const resolved = resolveUnsettledGuest("save");
    if (resolved === "prompted") return;

    const matchedCategory = matchSplitCategoryByName(categories, payload.category_name);
    if (matchedCategory) {
      await executeSaveAndSignal(resolved, matchedCategory.id);
    } else if (categories.length > 0) {
      setIsSelectCategoryOpen(true);
    } else {
      await executeSaveAndSignal(resolved);
    }
  }, [payload, session, resolveUnsettledGuest, categories, executeSaveAndSignal]);

  const executeSignalOnly = useCallback(
    async (participant?: SplitParticipantItem | null) => {
      if (!payload || !token || isHostViewing || isCurrentParticipantSettled || participant?.is_host || effectiveChargeCents <= 0) {
        return;
      }
      const targetInstIds =
        isPayAllRemaining && participantInstallments.length > 0
          ? participantInstallments.filter((i) => !i.is_settled).map((i) => i.id)
          : selectedInstallment?.id
            ? [selectedInstallment.id]
            : [];
      const targetInstId = targetInstIds[0] ?? null;

      setIsSignalingDirectly(true);
      try {
        await signalSplitPaymentMutation.mutateAsync({
          token,
          participantName: resolveGuestActorName(participant, session?.user, "Convidado"),
          amountCents: effectiveChargeCents,
          participantId: participant?.id,
          installmentId: targetInstId,
          ...(targetInstIds.length > 0 ? { installmentIds: targetInstIds } : {}),
        });
        if (targetInstIds.length > 0) {
          setJustSignaledInstallmentIds((prev) => {
            const next = new Set(prev);
            for (const id of targetInstIds) next.add(id);
            return next;
          });
        }
        triggerSensory("success");
        pushToast({
          title: "Aviso enviado ao anfitrião!",
          description: "Notificamos o anfitrião sobre seu pagamento Pix para conferência.",
          variant: "success",
        });
      } catch {
        triggerSensory("destructive");
        pushToast({
          title: "Não foi possível avisar o anfitrião",
          description: "Verifique sua conexão ou tente novamente em instantes.",
          variant: "destructive",
        });
      } finally {
        setIsSignalingDirectly(false);
      }
    },
    [
      payload,
      token,
      isHostViewing,
      isCurrentParticipantSettled,
      effectiveChargeCents,
      isPayAllRemaining,
      participantInstallments,
      selectedInstallment,
      session,
      signalSplitPaymentMutation,
    ],
  );

  const handleSignalPixPayment = useCallback(async () => {
    if (!payload || !token) return;
    if (isHostViewing) {
      pushToast({
        title: "Prévia do anfitrião",
        description: "Apenas convidados sinalizam pagamentos pelo link público.",
        variant: "default",
      });
      return;
    }
    if (isCurrentParticipantSettled) return;
    const resolved = resolveUnsettledGuest("signal");
    if (resolved === "prompted") return;
    await executeSignalOnly(resolved);
  }, [payload, token, isHostViewing, isCurrentParticipantSettled, resolveUnsettledGuest, executeSignalOnly]);

  const handleConfirmParticipant = useCallback(
    async (participant: SplitParticipantItem) => {
      setSelectedParticipant(participant);
      if (participant.id) guestIdentity.setActiveParticipantId(participant.id);
      setIsSelectParticipantOpen(false);
      if (participantSelectionIntent === "signal") {
        await executeSignalOnly(participant);
        return;
      }
      const matchedCategory = matchSplitCategoryByName(categories, payload?.category_name);
      if (matchedCategory) {
        await executeSaveAndSignal(participant, matchedCategory.id);
      } else if (categories.length > 0) {
        setIsSelectCategoryOpen(true);
      } else {
        await executeSaveAndSignal(participant);
      }
    },
    [participantSelectionIntent, guestIdentity, executeSignalOnly, categories, payload?.category_name, executeSaveAndSignal, setSelectedParticipant],
  );

  return {
    isOnboardingModalOpen,
    setIsOnboardingModalOpen,
    isSelectCategoryOpen,
    setIsSelectCategoryOpen,
    isSelectParticipantOpen,
    setIsSelectParticipantOpen,
    isSavingDirectly,
    isSignalingDirectly,
    justSignaledInstallmentIds,
    handleSaveExpenseClick,
    handleSignalPixPayment,
    handleConfirmParticipant,
    handleConfirmCategorySave: useCallback(
      async (chosenCategoryId: string) => {
        setIsSelectCategoryOpen(false);
        await executeSaveAndSignal(selectedParticipant, chosenCategoryId);
      },
      [executeSaveAndSignal, selectedParticipant],
    ),
  };
}
