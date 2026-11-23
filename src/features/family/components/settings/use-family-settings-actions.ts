import {
  useDeleteFamily,
  useInviteFamilyMember,
  useLeaveFamily,
  useRemoveFamilyMember,
  useRevokeFamilyInvite,
  useUpdateFamily,
  useUpdateFamilyMember,
} from "@/state";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getPublicShareUrl } from "@/services/app-url";
import { copyTextToClipboard } from "@/services/export-actions";
import type { Family, FamilyInvite, FamilyMember, FamilyMemberWithProfile, FamilyPixKeyType, FamilySplitRule } from "@/types";

export function useFamilySettingsActions({
  family,
  currentMember,
  onOpenChange,
  onGeneratedInviteUrl,
  onClearInviteEmail,
  onCopiedToken,
  onClearMemberToRemove,
  onClearInviteToRevoke,
  onCloseLeaveModal,
  onCloseDeleteModal,
  onClearFamilyDirty,
  onClearMemberDirty,
}: {
  family?: Family;
  currentMember?: FamilyMemberWithProfile;
  onOpenChange: (open: boolean) => void;
  onGeneratedInviteUrl: (url: string) => void;
  onClearInviteEmail: () => void;
  onCopiedToken: (token: string | null) => void;
  onClearMemberToRemove: () => void;
  onClearInviteToRevoke: () => void;
  onCloseLeaveModal: () => void;
  onCloseDeleteModal: () => void;
  onClearFamilyDirty: () => void;
  onClearMemberDirty: () => void;
}) {
  const updateFamilyMutation = useUpdateFamily();
  const updateMemberMutation = useUpdateFamilyMember();
  const inviteMemberMutation = useInviteFamilyMember();
  const revokeInviteMutation = useRevokeFamilyInvite();
  const removeFamilyMemberMutation = useRemoveFamilyMember();
  const leaveFamilyMutation = useLeaveFamily();
  const deleteFamilyMutation = useDeleteFamily();

  const saveFamilyParams = async (editName: string, editBudgetCents: number | null, editSplitRule: FamilySplitRule) => {
    if (!family) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      triggerSensory("error");
      pushToast({ title: "Nome obrigatório", description: "O nome da casa não pode ficar vazio.", variant: "destructive" });
      return;
    }
    try {
      await updateFamilyMutation.mutateAsync({
        familyId: family.id,
        updates: {
          name: cleanName,
          monthly_budget: editBudgetCents && editBudgetCents > 0 ? editBudgetCents : null,
          split_rule: editSplitRule,
        },
      });
      onClearFamilyDirty();
    } catch {
      // Gerenciado pela mutation
    }
  };

  const saveSplitRule = async (newRule: FamilySplitRule) => {
    if (!family) return;
    if (newRule === family.split_rule) return;
    try {
      await updateFamilyMutation.mutateAsync({
        familyId: family.id,
        updates: {
          split_rule: newRule,
        },
      });
      triggerSensory("selection");
      pushToast({
        title: "Regra atualizada",
        description: `Regra de divisão alterada para ${
          newRule === "combined"
            ? "Caixa Único"
            : newRule === "equal"
              ? "Divisão 50% / 50%"
              : "Divisão Proporcional à Renda"
        }.`,
        variant: "success",
      });
    } catch {
      // Gerenciado pela mutation
    }
  };

  const saveMemberPix = async (
    displayName: string,
    pixKey: string,
    pixKeyType: FamilyPixKeyType,
    splitRatioPercent: number,
    editSplitRule: FamilySplitRule,
  ) => {
    if (!family || !currentMember) return;
    try {
      await updateMemberMutation.mutateAsync({
        memberId: currentMember.id,
        updates: {
          display_name: displayName.trim() || undefined,
          pix_key: pixKey.trim() || null,
          pix_key_type: pixKey.trim() ? pixKeyType : null,
          split_ratio: editSplitRule === "proportional" ? Number((splitRatioPercent / 100).toFixed(4)) : undefined,
        },
      });
      onClearMemberDirty();
    } catch {
      // Gerenciado pela mutation
    }
  };

  const sendInvite = async (inviteEmail: string) => {
    if (!family) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) {
      triggerSensory("error");
      pushToast({ title: "Informe o e-mail", description: "Digite o endereço de e-mail do participante a ser convidado.", variant: "destructive" });
      return;
    }
    try {
      const invite = await inviteMemberMutation.mutateAsync({ familyId: family.id, invitedEmail: cleanEmail });
      onGeneratedInviteUrl(getPublicShareUrl(`convite-familiar/${invite.token}`));
      onClearInviteEmail();
    } catch {
      // Gerenciado pela mutation
    }
  };

  const copyLink = async (url: string, token: string) => {
    const copied = await copyTextToClipboard(url);
    if (copied) {
      onCopiedToken(token);
      triggerSensory("success");
      pushToast({ title: "Link de convite copiado!", description: "Pronto para enviar por WhatsApp ou mensagem.", variant: "default" });
      setTimeout(() => onCopiedToken(null), 2500);
    } else {
      triggerSensory("error");
      pushToast({ title: "Não foi possível copiar o link", variant: "destructive" });
    }
  };

  const confirmRemoveMember = async (memberToRemove: FamilyMember | null) => {
    if (!memberToRemove || !family) return;
    try {
      await removeFamilyMemberMutation.mutateAsync({ familyId: family.id, targetUserId: memberToRemove.user_id });
      onClearMemberToRemove();
    } catch {
      // Gerenciado pela mutation
    }
  };

  const confirmRevokeInvite = async (inviteToRevoke: FamilyInvite | null) => {
    if (!inviteToRevoke) return;
    try {
      await revokeInviteMutation.mutateAsync(inviteToRevoke.id);
      onClearInviteToRevoke();
    } catch {
      // Gerenciado pela mutation
    }
  };

  const confirmLeaveFamily = async () => {
    try {
      await leaveFamilyMutation.mutateAsync(undefined);
      onCloseLeaveModal();
      onOpenChange(false);
    } catch {
      // Gerenciado pela mutation
    }
  };

  const confirmDeleteFamily = async () => {
    if (!family) return;
    try {
      await deleteFamilyMutation.mutateAsync(family.id);
      onCloseDeleteModal();
      onOpenChange(false);
    } catch {
      // Gerenciado pela mutation
    }
  };

  return {
    updateFamilyPending: updateFamilyMutation.isPending,
    updateMemberPending: updateMemberMutation.isPending,
    inviteMemberPending: inviteMemberMutation.isPending,
    revokeInvitePending: revokeInviteMutation.isPending,
    removeMemberPending: removeFamilyMemberMutation.isPending,
    leaveFamilyPending: leaveFamilyMutation.isPending,
    deleteFamilyPending: deleteFamilyMutation.isPending,
    saveFamilyParams,
    saveSplitRule,
    saveMemberPix,
    sendInvite,
    copyLink,
    confirmRemoveMember,
    confirmRevokeInvite,
    confirmLeaveFamily,
    confirmDeleteFamily,
  };
}
