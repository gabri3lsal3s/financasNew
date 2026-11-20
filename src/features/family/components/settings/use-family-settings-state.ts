import { useState } from "react";
import type { FormEvent } from "react";
import { useFamilyIncomeRatioSuggestion, useMyFamily } from "@/state";
import type { FamilyInvite, FamilyMember, FamilyPixKeyType, FamilySplitRule } from "@/types";
import { useFamilySettingsActions } from "./use-family-settings-actions";

export function useFamilySettingsState({
  open,
  onOpenChange,
  initialTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: string;
}) {
  const { data: myFamilyData } = useMyFamily();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editName, setEditName] = useState("");
  const [editBudgetCents, setEditBudgetCents] = useState<number | null>(null);
  const [editSplitRule, setEditSplitRule] = useState<FamilySplitRule>("combined");
  const [isFamilyDirty, setIsFamilyDirty] = useState(false);

  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberPixKeyType, setMemberPixKeyType] = useState<FamilyPixKeyType>("cpf");
  const [memberPixKey, setMemberPixKey] = useState("");
  const [memberSplitRatioPercent, setMemberSplitRatioPercent] = useState<number>(50);
  const [isMemberDirty, setIsMemberDirty] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<FamilyMember | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = useState<FamilyInvite | null>(null);
  const [nowMs] = useState(() => Date.now());

  const family = myFamilyData?.family;
  const currentMember = myFamilyData?.currentMember;
  const isOwner = currentMember?.role === "owner";
  const members = myFamilyData?.members ?? [];
  const invites = myFamilyData?.invites ?? [];

  const { data: incomeSuggestions } = useFamilyIncomeRatioSuggestion(family?.id, 3, {
    enabled: Boolean(family),
  });

  const resetDrafts = () => {
    if (family) {
      setEditName(family.name);
      setEditBudgetCents(family.monthly_budget ?? null);
      setEditSplitRule(family.split_rule);
    }
    if (currentMember) {
      setMemberDisplayName(currentMember.display_name || "");
      setMemberPixKeyType(currentMember.pix_key_type || "cpf");
      setMemberPixKey(currentMember.pix_key || "");
      setMemberSplitRatioPercent(Math.round((currentMember.split_ratio ?? 0.5) * 100));
    }
    setIsFamilyDirty(false);
    setIsMemberDirty(false);
  };

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setActiveTab(initialTab);
      resetDrafts();
    } else {
      resetDrafts();
    }
  }

  const [syncedFamilyId, setSyncedFamilyId] = useState<string | null>(null);
  if (family && (family.id !== syncedFamilyId || !open) && !isFamilyDirty) {
    setSyncedFamilyId(family.id);
    setEditName(family.name);
    setEditBudgetCents(family.monthly_budget ?? null);
    setEditSplitRule(family.split_rule);
  }

  const [syncedMemberId, setSyncedMemberId] = useState<string | null>(null);
  if (currentMember && (currentMember.id !== syncedMemberId || !open) && !isMemberDirty) {
    setSyncedMemberId(currentMember.id);
    setMemberDisplayName(currentMember.display_name || "");
    setMemberPixKeyType(currentMember.pix_key_type || "cpf");
    setMemberPixKey(currentMember.pix_key || "");
    setMemberSplitRatioPercent(Math.round((currentMember.split_ratio ?? 0.5) * 100));
  }

  const pendingInvites = invites.filter((inv) => {
    if (inv.status !== "pending") return false;
    if (!inv.expires_at) return true;
    return new Date(inv.expires_at).getTime() > nowMs;
  });

  const actions = useFamilySettingsActions({
    family,
    currentMember,
    onOpenChange,
    onGeneratedInviteUrl: setGeneratedInviteUrl,
    onClearInviteEmail: () => setInviteEmail(""),
    onCopiedToken: setCopiedToken,
    onClearMemberToRemove: () => setMemberToRemove(null),
    onClearInviteToRevoke: () => setInviteToRevoke(null),
    onCloseLeaveModal: () => setIsLeaveModalOpen(false),
    onCloseDeleteModal: () => setIsDeleteModalOpen(false),
    onClearFamilyDirty: () => setIsFamilyDirty(false),
    onClearMemberDirty: () => setIsMemberDirty(false),
  });

  return {
    activeTab,
    setActiveTab,
    family,
    currentMember,
    isOwner,
    members,
    pendingInvites,
    incomeSuggestions,
    editName,
    setEditName,
    editBudgetCents,
    setEditBudgetCents,
    editSplitRule,
    setEditSplitRule,
    isFamilyDirty,
    setIsFamilyDirty,
    memberDisplayName,
    setMemberDisplayName,
    memberPixKeyType,
    setMemberPixKeyType,
    memberPixKey,
    setMemberPixKey,
    memberSplitRatioPercent,
    setMemberSplitRatioPercent,
    isMemberDirty,
    setIsMemberDirty,
    inviteEmail,
    setInviteEmail,
    generatedInviteUrl,
    showQrCode,
    setShowQrCode,
    copiedToken,
    isLeaveModalOpen,
    setIsLeaveModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    memberToRemove,
    setMemberToRemove,
    inviteToRevoke,
    setInviteToRevoke,
    updateFamilyPending: actions.updateFamilyPending,
    updateMemberPending: actions.updateMemberPending,
    inviteMemberPending: actions.inviteMemberPending,
    revokeInvitePending: actions.revokeInvitePending,
    removeMemberPending: actions.removeMemberPending,
    leaveFamilyPending: actions.leaveFamilyPending,
    deleteFamilyPending: actions.deleteFamilyPending,
    handleSaveFamilyParams: (e: FormEvent) => {
      e.preventDefault();
      return actions.saveFamilyParams(editName, editBudgetCents, editSplitRule);
    },
    handleSplitRuleChange: (val: FamilySplitRule) => {
      setEditSplitRule(val);
      void actions.saveSplitRule(val);
    },
    handleResetDrafts: resetDrafts,
    handleSaveMemberPix: (e: FormEvent) => {
      e.preventDefault();
      return actions.saveMemberPix(memberDisplayName, memberPixKey, memberPixKeyType, memberSplitRatioPercent, editSplitRule);
    },
    handleSendInvite: (e: FormEvent) => {
      e.preventDefault();
      return actions.sendInvite(inviteEmail);
    },
    handleCopyLink: actions.copyLink,
    handleConfirmRemoveMember: () => actions.confirmRemoveMember(memberToRemove),
    handleConfirmRevokeInvite: () => actions.confirmRevokeInvite(inviteToRevoke),
    handleConfirmLeaveFamily: actions.confirmLeaveFamily,
    handleConfirmDeleteFamily: actions.confirmDeleteFamily,
  };
}
