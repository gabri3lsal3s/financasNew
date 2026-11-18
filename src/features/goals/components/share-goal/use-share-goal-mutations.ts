import {
  useCreatePublicShare,
  useDeletePublicShare,
  useRegeneratePublicShare,
  useRestorePublicShare,
  useRevokePublicShare,
  useUpdatePublicShare,
} from "@/state/mutations/use-public-share-mutations";
import { getPublicAppUrl } from "@/services/app-url";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { GoalTrackerSharePayload, GoalTrackerStatus, PublicShare } from "@/types";

export interface UseShareGoalMutationsParams {
  activeShare?: PublicShare;
  isShared: boolean;
  isArchived: boolean;
  isCompleted: boolean;
  initialCollectedCents: number;
  targetCents: number;
  buildPayload: (base?: Record<string, unknown>, statusOverride?: GoalTrackerStatus) => GoalTrackerSharePayload;
  onOpenChange: (open: boolean) => void;
  setIsEditingGoal: (val: boolean) => void;
  setRevokedOverride: (val: boolean | null) => void;
  setIsRevokeModalOpen: (val: boolean) => void;
  setIsRegenerateModalOpen: (val: boolean) => void;
  setIsDeleteModalOpen: (val: boolean) => void;
}

async function copyUrlSilently(token: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(getPublicAppUrl(`meta/${token}`)).catch(() => {});
  }
}

export function useShareGoalMutations(p: UseShareGoalMutationsParams) {
  const createMutation = useCreatePublicShare();
  const updateMutation = useUpdatePublicShare();
  const revokeMutation = useRevokePublicShare();
  const restoreMutation = useRestorePublicShare();
  const deleteMutation = useDeletePublicShare();
  const regenerateMutation = useRegeneratePublicShare();

  const handleCreateOrUpdate = async (pixKey: string) => {
    if (p.targetCents <= 0 || (p.isShared && !pixKey.trim())) return;
    if (p.activeShare) {
      try {
        await updateMutation.mutateAsync({
          id: p.activeShare.id,
          payload: p.buildPayload(p.activeShare.payload) as unknown as Record<string, unknown>,
        });
        p.setIsEditingGoal(false);
        pushToast({ title: "Dados da meta atualizados!", description: "As alterações já estão ativas e refletidas no aplicativo.", variant: "success" });
      } catch {
        triggerSensory("error");
        pushToast({ title: "Erro ao salvar alterações da meta", description: "Tente novamente em instantes.", variant: "destructive" });
      }
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        kind: "goal_tracker",
        payload: p.buildPayload() as unknown as Record<string, unknown>,
      });
      if (p.isShared) await copyUrlSilently(result.token);
      pushToast({
        title: p.isShared ? "Termômetro público ativado com sucesso!" : "Meta financeira registrada!",
        description: p.isShared ? "O link foi copiado para sua área de transferência." : "Sua meta pessoal está salva e visível no painel.",
        variant: "success",
      });
      p.onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      pushToast({ title: "Erro ao gerar meta financeira", description: err instanceof Error ? err.message : "Tente novamente mais tarde.", variant: "destructive" });
    }
  };

  const handleConfirmRevoke = async () => {
    if (!p.activeShare) return;
    p.setRevokedOverride(true);
    p.setIsRevokeModalOpen(false);
    pushToast({ title: "Link do termômetro pausado.", description: "A página pública agora exibe aviso de link inativo. Você pode reativar quando desejar.", variant: "default" });
    try {
      await revokeMutation.mutateAsync(p.activeShare.id);
    } catch {
      p.setRevokedOverride(null);
      triggerSensory("error");
      pushToast({ title: "Erro ao pausar link público", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const handleConfirmRestore = async () => {
    if (!p.activeShare) return;
    p.setRevokedOverride(false);
    pushToast({ title: "Link público reativado com sucesso!", description: "A arrecadação pública volta a estar acessível.", variant: "success" });
    try {
      await restoreMutation.mutateAsync(p.activeShare.id);
    } catch {
      p.setRevokedOverride(null);
      triggerSensory("error");
      pushToast({ title: "Erro ao reativar link público", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!p.activeShare) return;
    try {
      await deleteMutation.mutateAsync(p.activeShare.id);
      p.setIsDeleteModalOpen(false);
      p.onOpenChange(false);
      pushToast({ title: "Meta excluída com sucesso!", description: "A meta coletiva e seus registros foram removidos definitivamente.", variant: "default" });
    } catch {
      triggerSensory("error");
    }
  };

  const handleToggleArchive = async () => {
    if (!p.activeShare) return;
    try {
      const nextStatus: GoalTrackerStatus = p.isArchived ? (p.initialCollectedCents >= p.targetCents ? "completed" : "active") : "archived";
      await updateMutation.mutateAsync({ id: p.activeShare.id, payload: { ...p.activeShare.payload, status: nextStatus } });
      pushToast({
        title: nextStatus === "archived" ? "Meta arquivada com sucesso!" : "Meta desarquivada!",
        description: nextStatus === "archived" ? "A meta foi movida para as arquivadas e não aparecerá nos destaques." : "A meta voltou para o painel de metas ativas.",
        variant: "default",
      });
    } catch {
      triggerSensory("error");
    }
  };

  const handleToggleStatus = async () => {
    if (!p.activeShare) return;
    try {
      const nextStatus: GoalTrackerStatus = p.isCompleted ? "active" : "completed";
      await updateMutation.mutateAsync({ id: p.activeShare.id, payload: { ...p.activeShare.payload, status: nextStatus } });
      pushToast({
        title: nextStatus === "completed" ? "Meta marcada como concluída!" : "Meta reaberta como ativa!",
        description: nextStatus === "completed" ? "O termômetro web agora exibe aviso de meta conquistada com sucesso." : "A arrecadação foi reativada.",
        variant: "success",
      });
    } catch {
      triggerSensory("error");
    }
  };

  const handleConfirmRegenerate = async () => {
    if (!p.activeShare) return;
    try {
      const status = (p.activeShare.payload?.status as GoalTrackerStatus) || "active";
      const result = await regenerateMutation.mutateAsync({
        oldId: p.activeShare.id,
        input: { kind: "goal_tracker", payload: p.buildPayload(p.activeShare.payload, status) as unknown as Record<string, unknown> },
      });
      p.setIsRegenerateModalOpen(false);
      await copyUrlSilently(result.token);
      pushToast({ title: "Link regenerado com sucesso!", description: "Novo endereço copiado para a área de transferência.", variant: "success" });
    } catch {
      triggerSensory("error");
    }
  };

  return {
    isPending: createMutation.isPending || updateMutation.isPending || revokeMutation.isPending || restoreMutation.isPending || deleteMutation.isPending || regenerateMutation.isPending,
    handleCreateOrUpdate,
    handleConfirmRevoke,
    handleConfirmRestore,
    handleConfirmDelete,
    handleToggleArchive,
    handleToggleStatus,
    handleConfirmRegenerate,
  };
}
