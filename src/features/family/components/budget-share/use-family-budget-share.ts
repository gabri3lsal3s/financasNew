import { useMemo, useState } from "react";
import { useFamilyMode, useMyFamily } from "@/state";
import { useMyPublicShares } from "@/state/queries/use-public-shares";
import {
  useCreatePublicShare,
  useRegeneratePublicShare,
  useRevokePublicShare,
} from "@/state/mutations/use-public-share-mutations";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getPublicShareUrl } from "@/services/app-url";

export function useFamilyBudgetShare() {
  const { isFamilyModeEnabled, toggleFamilyMode, isPending: isUpdatingFamilyMode } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const { data: shares, isLoading } = useMyPublicShares("family_budget");
  const createShareMutation = useCreatePublicShare();
  const revokeShareMutation = useRevokePublicShare();
  const regenerateShareMutation = useRegeneratePublicShare();

  const hasGroupFamily = Boolean(myFamilyData?.family);
  const groupMonthlyBudgetCents = myFamilyData?.family?.monthly_budget
    ? Math.round(myFamilyData.family.monthly_budget * 100)
    : 0;

  const [copied, setCopied] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [nowMs] = useState(() => Date.now());

  const activeShare = useMemo(() => {
    return (shares ?? []).find(
      (s) => !s.is_revoked && (!s.expires_at || new Date(s.expires_at).getTime() > nowMs),
    );
  }, [shares, nowMs]);

  const shareUrl = activeShare ? getPublicShareUrl(`orcamento-familiar/${activeShare.token}`) : "";

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopied(true);
      triggerSensory("success");
      pushToast({
        title: "Link copiado para a área de transferência!",
        description: "Envie para o seu cônjuge ou familiares para leitura do orçamento.",
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      triggerSensory("error");
      pushToast({ title: "Não foi possível copiar o link", variant: "destructive" });
    }
  };

  const handleConfirmRevoke = async () => {
    if (!activeShare) return;
    try {
      await revokeShareMutation.mutateAsync(activeShare.id);
      setIsRevokeModalOpen(false);
    } catch {
      // Erro tratado na mutation
    }
  };

  const handleConfirmRegenerate = async () => {
    if (!activeShare) return;
    try {
      let payload = activeShare.payload as Record<string, unknown> | undefined;
      if (hasGroupFamily && payload && "monthly_ceiling_cents" in payload) {
        const nextPayload = { ...payload };
        delete nextPayload.monthly_ceiling_cents;
        payload = nextPayload;
      }
      await regenerateShareMutation.mutateAsync({
        oldId: activeShare.id,
        input: { kind: "family_budget", payload: payload ?? {} },
      });
      setIsRegenerateModalOpen(false);
      pushToast({
        title: "Link público regenerado!",
        description: "O endereço anterior foi invalidado e o novo link está pronto para cópia.",
        variant: "success",
      });
    } catch {
      // Erro tratado na mutation
    }
  };

  const handleCreateShare = async (ceilingCents: number | null) => {
    try {
      const payload: Record<string, unknown> = {};
      if (!hasGroupFamily && ceilingCents && ceilingCents > 0) {
        payload.monthly_ceiling_cents = ceilingCents;
      }
      await createShareMutation.mutateAsync({ kind: "family_budget", payload });
      setIsCreateModalOpen(false);
      triggerSensory("success");
    } catch {
      triggerSensory("destructive");
    }
  };

  return {
    isFamilyModeEnabled,
    toggleFamilyMode,
    isUpdatingFamilyMode,
    isLoading,
    hasGroupFamily,
    groupMonthlyBudgetCents,
    activeShare,
    shareUrl,
    copied,
    isRevokeModalOpen,
    setIsRevokeModalOpen,
    isRegenerateModalOpen,
    setIsRegenerateModalOpen,
    isCreateModalOpen,
    setIsCreateModalOpen,
    createPending: createShareMutation.isPending,
    revokePending: revokeShareMutation.isPending,
    regeneratePending: regenerateShareMutation.isPending,
    handleCopyLink,
    handleConfirmRevoke,
    handleConfirmRegenerate,
    handleCreateShare,
  };
}
