import { useMemo, useState } from "react";
import { validateAndClassifyPixKey, type PixKeyType } from "@/domain/pix";
import { useMyPublicShares } from "@/state/queries/use-public-shares";
import { useUserAccess } from "@/state/queries/use-user-access";
import { getPublicShareUrl } from "@/services/app-url";
import { copyTextToClipboard } from "@/services/export-actions";
import { getStoredSplitPreferences, storeSplitPreferences } from "@/services/split-preferences";
import { pushToast } from "@/services/toast";
import type { Category, GoalTrackerStatus, PublicShare } from "@/types";
import { buildGoalPixData, buildGoalSharePayload } from "./share-goal-payload";
import { useShareGoalMutations } from "./use-share-goal-mutations";

export interface UseShareGoalActionsParams {
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  existingShare?: PublicShare | null;
  month: string;
  currentExpectedCents: number;
  currentRealizedCents: number;
  initialEditMode: boolean;
}

export function useShareGoalActions({
  onOpenChange,
  category,
  existingShare,
  month,
  currentExpectedCents,
  currentRealizedCents,
  initialEditMode,
}: UseShareGoalActionsParams) {
  const { profile } = useUserAccess();
  const { data: myShares } = useMyPublicShares("goal_tracker");
  const [nowMs] = useState(() => Date.now());

  const activeShare = useMemo(() => {
    if (existingShare) {
      return (myShares ?? []).find((s) => s.id === existingShare.id) ?? existingShare;
    }
    if (!category) return undefined;
    return (myShares ?? []).find(
      (s) =>
        !s.is_revoked &&
        (!s.expires_at || new Date(s.expires_at).getTime() > nowMs) &&
        s.payload?.category_id === category.id,
    );
  }, [existingShare, myShares, category, nowMs]);

  const [revokedOverride, setRevokedOverride] = useState<boolean | null>(null);
  const isRevoked = revokedOverride !== null ? revokedOverride : Boolean(activeShare?.is_revoked);

  const [isEditingGoal, setIsEditingGoal] = useState(() => Boolean(initialEditMode || !activeShare));
  const [isShared, setIsShared] = useState<boolean>(() => {
    if (activeShare?.payload?.is_shared !== undefined) return Boolean(activeShare.payload.is_shared);
    if (activeShare) return Boolean(activeShare.payload?.pix_key);
    return Boolean(category);
  });

  const [title, setTitle] = useState(() => (activeShare?.payload?.title as string) || category?.name || "");
  const [targetCents, setTargetCents] = useState<number>(() =>
    activeShare?.payload?.target_cents
      ? Number(activeShare.payload.target_cents)
      : currentExpectedCents > 0
        ? currentExpectedCents
        : 100000,
  );
  const [initialCollectedCents, setInitialCollectedCents] = useState<number>(() =>
    activeShare?.payload?.current_cents !== undefined
      ? Number(activeShare.payload.current_cents)
      : currentRealizedCents,
  );
  const [deadline, setDeadline] = useState<string>(() => (activeShare?.payload?.deadline as string) || "");
  const [pixKey, setPixKey] = useState<string>(
    () => (activeShare?.payload?.pix_key as string) || getStoredSplitPreferences().pixKey || "",
  );
  const [selectedKeyType, setSelectedKeyType] = useState<string>(
    () =>
      (activeShare?.payload?.pix_key_type as string) ||
      getStoredSplitPreferences().pixKeyType ||
      "auto",
  );
  const [merchantName, setMerchantName] = useState<string>(
    () =>
      (activeShare?.payload?.organizer_name as string) ||
      getStoredSplitPreferences().merchantName ||
      profile?.name ||
      "Organizador",
  );
  const [merchantCity, setMerchantCity] = useState<string>(
    () =>
      (activeShare?.payload?.organizer_city as string) ||
      getStoredSplitPreferences().merchantCity ||
      "",
  );
  const [showContributionsPublicly, setShowContributionsPublicly] = useState<boolean>(() =>
    activeShare?.payload?.show_contributions_publicly !== undefined
      ? Boolean(activeShare.payload.show_contributions_publicly)
      : true,
  );

  const pixValidation = useMemo(
    () =>
      validateAndClassifyPixKey(
        pixKey,
        selectedKeyType === "auto" || selectedKeyType === "unknown"
          ? undefined
          : (selectedKeyType as PixKeyType),
      ),
    [pixKey, selectedKeyType],
  );

  const isPixValid = Boolean(
    !isShared || (pixValidation.isValid && pixValidation.resolvedType),
  );

  const [copied, setCopied] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const shareUrl = activeShare ? getPublicShareUrl(`meta/${activeShare.token}`) : "";
  const effectivePixBrCode = useMemo(
    () => buildGoalPixData({ isShared, pixKey, selectedKeyType, merchantName, merchantCity }).brCode,
    [isShared, pixKey, selectedKeyType, merchantName, merchantCity],
  );

  const isArchived = activeShare?.payload?.status === "archived";
  const isCompleted = activeShare?.payload?.status === "completed";

  const buildPayload = (base?: Record<string, unknown>, statusOverride?: GoalTrackerStatus) =>
    buildGoalSharePayload({
      base,
      statusOverride,
      category,
      month,
      title,
      targetCents,
      initialCollectedCents,
      deadline,
      isShared,
      pixKey,
      selectedKeyType,
      merchantName,
      merchantCity,
      showContributionsPublicly,
    });

  const mutations = useShareGoalMutations({
    activeShare,
    isShared,
    isArchived,
    isCompleted,
    initialCollectedCents,
    targetCents,
    buildPayload,
    onOpenChange,
    setIsEditingGoal,
    setRevokedOverride,
    setIsRevokeModalOpen,
    setIsRegenerateModalOpen,
    setIsDeleteModalOpen,
  });

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    const copiedOk = await copyTextToClipboard(shareUrl);
    if (copiedOk) {
      setCopied(true);
      pushToast({
        title: "Link público copiado!",
        description: "Compartilhe com o grupo para acompanhar o progresso da meta.",
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2500);
    } else {
      pushToast({ title: "Não foi possível copiar o link", variant: "destructive" });
    }
  };

  const handleSubmitForm = async () => {
    if (isShared && !isPixValid) return;
    if (isShared && pixValidation.isValid && pixValidation.resolvedType) {
      storeSplitPreferences({
        pixKey: pixValidation.normalizedKey ?? pixKey.trim(),
        pixKeyType: pixValidation.resolvedType,
        merchantName: merchantName.trim(),
        merchantCity: merchantCity.trim(),
      });
    }
    await mutations.handleCreateOrUpdate(pixKey, isPixValid);
  };

  const handleOpenPublicPage = () => {
    if (shareUrl && typeof window !== "undefined") {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  return {
    activeShare,
    isRevoked,
    isEditingGoal,
    setIsEditingGoal,
    isShared,
    setIsShared,
    title,
    setTitle,
    targetCents,
    setTargetCents,
    initialCollectedCents,
    setInitialCollectedCents,
    deadline,
    setDeadline,
    pixKey,
    setPixKey,
    selectedKeyType,
    setSelectedKeyType,
    detectedPixType: pixValidation.resolvedType,
    pixValidationError: pixValidation.errorMessage,
    isAmbiguousCpfOrPhone: pixValidation.isAmbiguousCpfOrPhone,
    isPixValid,
    profileSuggestions: profile ? { cpf: profile.cpf, email: profile.email } : undefined,
    merchantName,
    setMerchantName,
    merchantCity,
    setMerchantCity,
    showContributionsPublicly,
    setShowContributionsPublicly,
    copied,
    showQrPreview,
    setShowQrPreview,
    isRevokeModalOpen,
    setIsRevokeModalOpen,
    isRegenerateModalOpen,
    setIsRegenerateModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    shareUrl,
    effectivePixBrCode,
    isArchived,
    isCompleted,
    isPending: mutations.isPending,
    handleCopyLink,
    handleOpenPublicPage,
    handleSubmitForm,
    handleConfirmRevoke: mutations.handleConfirmRevoke,
    handleConfirmRestore: mutations.handleConfirmRestore,
    handleConfirmDelete: mutations.handleConfirmDelete,
    handleToggleArchive: mutations.handleToggleArchive,
    handleToggleStatus: mutations.handleToggleStatus,
    handleConfirmRegenerate: mutations.handleConfirmRegenerate,
  };
}
