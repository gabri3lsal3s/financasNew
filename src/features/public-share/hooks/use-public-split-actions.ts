import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
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
  selectedInstallment: SplitParticipantInstallment | null;
  effectiveChargeCents: number;
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
  selectedInstallment,
  effectiveChargeCents,
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
          amountCents: effectiveChargeCents,
          date: payload.date,
          categoryId,
        });
        if (token) {
          try {
            await signalSplitPaymentMutation.mutateAsync({
              token,
              participantName: resolveGuestActorName(participant, session?.user, "Participante"),
              amountCents: effectiveChargeCents,
              participantId: participant?.id,
              installmentId: selectedInstallment?.id ?? null,
            });
          } catch (signalErr) {
            console.warn("Não foi possível sinalizar o pagamento:", signalErr);
          }
        }
        triggerSensory("success");
        pushToast({
          title: "Despesa registrada!",
          description: "Avisamos o anfitrião sobre o seu pagamento para conferência.",
          variant: "success",
        });
        navigate("/transacoes");
      } catch {
        triggerSensory("destructive");
      } finally {
        setIsSavingDirectly(false);
      }
    },
    [payload, effectiveChargeCents, selectedInstallment, saveSplitMutation, signalSplitPaymentMutation, token, session, navigate],
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
      if (!payload || !token) return;
      const targetInstId = selectedInstallment?.id ?? null;
      setIsSignalingDirectly(true);
      try {
        await signalSplitPaymentMutation.mutateAsync({
          token,
          participantName: resolveGuestActorName(participant, session?.user, "Convidado"),
          amountCents: effectiveChargeCents,
          participantId: participant?.id,
          installmentId: targetInstId,
        });
        if (targetInstId) {
          setJustSignaledInstallmentIds((prev) => new Set(prev).add(targetInstId));
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
    [payload, token, effectiveChargeCents, selectedInstallment, session, signalSplitPaymentMutation],
  );

  const handleSignalPixPayment = useCallback(async () => {
    if (!payload || !token) return;
    const resolved = resolveUnsettledGuest("signal");
    if (resolved === "prompted") return;
    await executeSignalOnly(resolved);
  }, [payload, token, resolveUnsettledGuest, executeSignalOnly]);

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
