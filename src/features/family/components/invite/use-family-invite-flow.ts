import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { validateAndClassifyPixKey, type PixKeyType } from "@/domain/pix";
import { useAuth } from "@/hooks/use-auth";
import {
  useAcceptFamilyInvite,
  useFamilyInvite,
  useLeaveFamily,
  useMyFamily,
} from "@/state/queries/use-family";
import { getPublicAppUrl } from "@/services/app-url";
import { copyTextToClipboard } from "@/services/export-actions";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { FamilyPixKeyType } from "@/types";

const CNPJ_NOT_SUPPORTED_ERROR =
  "Chave Pix do tipo CNPJ não é suportada no modo familiar. Use CPF, Celular (+55), E-mail ou Chave Aleatória.";

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
  const [pixKeyType, setPixKeyType] = useState<string>("auto");
  const [copiedLink, setCopiedLink] = useState(false);
  const [now] = useState(() => Date.now());

  const pixValidation = useMemo(() => {
    if (!pixKey.trim()) return null;
    const rawResult = validateAndClassifyPixKey(
      pixKey,
      pixKeyType === "auto" ? undefined : (pixKeyType as PixKeyType),
    );
    if (rawResult.resolvedType === "cnpj") {
      return {
        ...rawResult,
        isValid: false,
        errorMessage: CNPJ_NOT_SUPPORTED_ERROR,
      };
    }
    return rawResult;
  }, [pixKey, pixKeyType]);

  const hasInvalidPix = Boolean(pixKey.trim() && pixValidation && !pixValidation.isValid);

  useEffect(() => {
    if (invite?.family_name) {
      document.title = `Convite Familiar · ${invite.family_name} — Axir`;
    } else {
      document.title = "Convite Familiar — Axir";
    }
  }, [invite?.family_name]);

  const canonicalInviteUrl = getPublicAppUrl(`convite-familiar/${token ?? ""}`);

  const handleCopyLink = async () => {
    const copied = await copyTextToClipboard(canonicalInviteUrl);
    if (copied) {
      setCopiedLink(true);
      triggerSensory("success");
      pushToast({
        title: "Link de convite copiado!",
        description: "Envie este link para seu parceiro vincular a conta.",
        variant: "default",
      });
      setTimeout(() => setCopiedLink(false), 3000);
    } else {
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
    if (!token || hasInvalidPix) return;
    const cleanPix = pixKey.trim()
      ? (pixValidation?.normalizedKey ?? pixKey.trim())
      : null;
    const resolvedPixType: FamilyPixKeyType | null = cleanPix
      ? ((pixValidation?.resolvedType && pixValidation.resolvedType !== "cnpj"
          ? pixValidation.resolvedType
          : pixKeyType === "auto"
            ? null
            : pixKeyType) as FamilyPixKeyType | null)
      : null;

    try {
      await acceptInviteMutation.mutateAsync({
        token,
        displayName: displayName.trim() || null,
        pixKey: cleanPix,
        pixKeyType: cleanPix ? resolvedPixType : null,
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
    detectedPixType: pixValidation?.resolvedType ?? null,
    pixValidationError: pixValidation?.errorMessage ?? null,
    isAmbiguousCpfOrPhone: pixValidation?.isAmbiguousCpfOrPhone ?? false,
    hasInvalidPix,
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
