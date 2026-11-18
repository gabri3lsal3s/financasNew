import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  useAcceptFamilyInvite,
  useFamilyInvite,
  useLeaveFamily,
  useMyFamily,
} from "@/state/queries/use-family";
import { getPublicAppUrl } from "@/services/app-url";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { FamilyPixKeyType } from "@/types";

export function useFamilyInviteFlow(token: string | undefined) {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { data: myFamilyData } = useMyFamily();
  const {
    data: invite,
    isLoading: inviteLoading,
    isError: inviteError,
  } = useFamilyInvite(token);
  const acceptInviteMutation = useAcceptFamilyInvite();
  const leaveFamilyMutation = useLeaveFamily();

  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const defaultDisplayName = String(session?.user?.user_metadata?.name ?? "");
  const [customDisplayName, setCustomDisplayName] = useState<string | null>(null);
  const displayName = customDisplayName ?? defaultDisplayName;
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<FamilyPixKeyType>("cpf");
  const [copiedLink, setCopiedLink] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (invite?.family_name) {
      document.title = `Convite Familiar · ${invite.family_name} — Axir`;
    } else {
      document.title = "Convite Familiar — Axir";
    }
  }, [invite?.family_name]);

  const canonicalInviteUrl = getPublicAppUrl(`convite-familiar/${token ?? ""}`);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalInviteUrl);
      setCopiedLink(true);
      triggerSensory("success");
      pushToast({
        title: "Link de convite copiado!",
        description: "Envie este link para seu parceiro vincular a conta.",
        variant: "default",
      });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link automaticamente.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmSwitchFamily = async () => {
    if (!myFamilyData?.family) return;
    try {
      const isOwner = myFamilyData.currentMember?.role === "owner";
      await leaveFamilyMutation.mutateAsync({
        familyId: myFamilyData.family.id,
        disband: isOwner,
      });
      setIsSwitchModalOpen(false);
    } catch {
      // Erro tratado na mutation
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;
    try {
      await acceptInviteMutation.mutateAsync({
        token,
        displayName: displayName.trim() || null,
        pixKey: pixKey.trim() || null,
        pixKeyType: pixKey.trim() ? pixKeyType : null,
      });
      navigate("/familia", { replace: true });
    } catch {
      // Tratamento sensorial e toast na mutation
    }
  };

  return {
    navigate,
    session,
    authLoading,
    myFamilyData,
    invite,
    inviteLoading,
    inviteError,
    isSwitchModalOpen,
    setIsSwitchModalOpen,
    displayName,
    setDisplayName: (val: string) => setCustomDisplayName(val),
    pixKey,
    setPixKey,
    pixKeyType,
    setPixKeyType,
    copiedLink,
    now,
    canonicalInviteUrl,
    acceptPending: acceptInviteMutation.isPending,
    switchPending: leaveFamilyMutation.isPending,
    handleCopyLink,
    handleConfirmSwitchFamily,
    handleAcceptInvite,
  };
}
