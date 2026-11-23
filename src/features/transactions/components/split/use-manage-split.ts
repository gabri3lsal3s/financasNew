import { useMemo, useState } from "react";
import { todayISO } from "@/domain/debts";
import {
  normalizeSplitParticipants,
  resolveSplitExpirationIso,
  splitAmountEqually,
  sumExpectedFromFriendsCents,
  sumSettledFromFriendsCents,
  type SplitEditInput,
} from "@/domain/finance";
import { isSplitFullyCompleted, type SplitRemainderPolicy } from "@/domain/finance/split-math";
import {
  DEFAULT_PIX_CITY,
  buildPixTransferCode,
  validateAndClassifyPixKey,
  type PixKeyType,
} from "@/domain/pix";
import { getPublicShareUrl } from "@/services/app-url";
import { copyTextToClipboard } from "@/services/export-actions";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { useSplitPreferences } from "@/services/split-preferences";
import { pushToast } from "@/services/toast";
import {
  useApplySplitSettlement,
  useDeleteLinkedSplit,
  useDismissSplitPaymentSignal,
  useExpense,
  useExpensesByInstallmentGroup,
  useUpdateSplitComprehensive,
} from "@/state";
import { useUserAccess } from "@/state/queries/use-user-access";
import type { Debt, PublicShare, SplitParticipantItem, SplitSharePayload } from "@/types";
import type { EditableSplitParticipant } from "./split-edit-tab";

export type ManageSplitTab = "settlements" | "edit" | "public";

export interface UseManageSplitParams {
  open?: boolean;
  share: PublicShare;
  linkedDebt?: Debt | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface DraftParticipantItem {
  id: string;
  name: string;
  isHost: boolean;
  fixedCents: number;
  settledCents: number;
}

function buildEditDraftParticipants(payload: SplitSharePayload): DraftParticipantItem[] {
  return normalizeSplitParticipants(payload).map((p, idx) => ({
    id: p.id || `p_${idx + 1}`,
    name: p.name,
    isHost: Boolean(p.is_host),
    fixedCents: Math.max(0, Number(p.share_cents ?? 0)),
    settledCents: Math.max(0, Number(p.settled_cents ?? (p.is_settled ? p.share_cents : 0))),
  }));
}

export function useManageSplit({ open = true, share, linkedDebt, onOpenChange, onSuccess }: UseManageSplitParams) {
  const { profile } = useUserAccess();
  const applySplitSettlement = useApplySplitSettlement();
  const updateSplitComprehensive = useUpdateSplitComprehensive();
  const deleteLinkedSplit = useDeleteLinkedSplit();
  const dismissSignalMutation = useDismissSplitPaymentSignal();
  const { updatePreferences } = useSplitPreferences();

  const payload = useMemo(
    () => (share.payload ?? {}) as unknown as SplitSharePayload,
    [share.payload],
  );
  const linkedExpenseId = share.expense_id || payload.expense_id || null;
  const { data: linkedExpense, isFetched: isExpenseFetched } = useExpense(linkedExpenseId);
  const hasLinkedExpense = Boolean(linkedExpenseId && (!isExpenseFetched || linkedExpense));
  const groupId = share.installment_group_id || payload.installment_group_id || linkedExpense?.installment_group_id || null;
  const { data: groupExpenses } = useExpensesByInstallmentGroup(groupId);

  const installmentsCount = Math.max(
    1,
    Number(payload.installments_count ?? linkedExpense?.installments_total ?? (groupExpenses?.length ?? 1)),
  );
  const isMultiInstallmentGroup = Boolean(installmentsCount > 1 || (groupExpenses && groupExpenses.length > 1));

  const participants = useMemo(() => normalizeSplitParticipants(payload), [payload]);
  const participantInstallments = useMemo(() => payload.participant_installments ?? [], [payload]);
  const pendingSignals = useMemo(
    () => (payload.payment_signals ?? []).filter((s) => s.status === "pending"),
    [payload.payment_signals],
  );

  const [activeTab, setActiveTab] = useState<ManageSplitTab>("settlements");
  const [customInputParticipantId, setCustomInputParticipantId] = useState<string | null>(null);
  const [customInputCents, setCustomInputCents] = useState<number>(0);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLinkedDebt, setDeleteLinkedDebt] = useState<boolean>(true);
  const [deleteOriginalExpense, setDeleteOriginalExpense] = useState<boolean>(false);

  // Drafts para Aba 2 ("Editar Racha")
  const [editedTitle, setEditedTitle] = useState(payload.title || "");
  const [editedTotalCents, setEditedTotalCents] = useState(Number(payload.total_cents ?? 0));
  const [editedDate, setEditedDate] = useState(payload.date || todayISO());
  const [editedDueDate, setEditedDueDate] = useState(linkedDebt?.due_date || payload.due_date || payload.date || todayISO());
  const [editedRemainderPolicy, setEditedRemainderPolicy] = useState<SplitRemainderPolicy>(payload.remainder_policy ?? "host");
  const [editedSplitMode, setEditedSplitMode] = useState<"equal" | "custom">(payload.split_mode ?? "equal");
  const [editedInstallmentsMode, setEditedInstallmentsMode] = useState<"single_total" | "per_installment">(
    payload.installments_mode ?? "per_installment",
  );
  const [editedParticipants, setEditedParticipants] = useState<DraftParticipantItem[]>(() =>
    buildEditDraftParticipants(payload),
  );

  // Drafts para Aba 3 ("Pix e Página")
  const [editedPixKey, setEditedPixKey] = useState(payload.pix_key || "");
  const [editedKeyType, setEditedKeyType] = useState<string>(payload.pix_key_type || "auto");
  const [editedHostName, setEditedHostName] = useState(
    payload.host_name || participants.find((p) => p.is_host)?.name || "Anfitrião",
  );
  const [editedHostCity, setEditedHostCity] = useState(payload.host_city || "");
  const [editedCustomNote, setEditedCustomNote] = useState(payload.custom_note || "");
  const [editedShowParticipantsList, setEditedShowParticipantsList] = useState<boolean>(
    payload.show_participants_list ?? true,
  );
  const [editedPublicPagePaused, setEditedPublicPagePaused] = useState<boolean>(
    Boolean(payload.public_page_paused),
  );

  const syncKey = `${share.id}:${share.updated_at}:${open}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    const freshParticipants = normalizeSplitParticipants(payload);
    setEditedTitle(payload.title || "");
    setEditedTotalCents(Number(payload.total_cents ?? 0));
    setEditedDate(payload.date || todayISO());
    setEditedDueDate(linkedDebt?.due_date || payload.due_date || payload.date || todayISO());
    setEditedRemainderPolicy(payload.remainder_policy ?? "host");
    setEditedSplitMode(payload.split_mode ?? "equal");
    setEditedInstallmentsMode(payload.installments_mode ?? "per_installment");
    setEditedParticipants(buildEditDraftParticipants(payload));
    setEditedPixKey(payload.pix_key || "");
    setEditedKeyType(payload.pix_key_type || "auto");
    setEditedHostName(payload.host_name || freshParticipants.find((p) => p.is_host)?.name || "Anfitrião");
    setEditedHostCity(payload.host_city || "");
    setEditedCustomNote(payload.custom_note || "");
    setEditedShowParticipantsList(payload.show_participants_list ?? true);
    setEditedPublicPagePaused(Boolean(payload.public_page_paused));
    if (open) {
      setCustomInputParticipantId(null);
    }
  }

  const totalCents = Number(payload.total_cents ?? 0);
  const friends = useMemo(() => participants.filter((p) => !p.is_host), [participants]);
  const totalSettledFromFriendsCents = useMemo(() => sumSettledFromFriendsCents(participants), [participants]);
  const totalExpectedFromFriendsCents = useMemo(() => sumExpectedFromFriendsCents(participants), [participants]);
  const remainingReceivableCents = Math.max(0, totalExpectedFromFriendsCents - totalSettledFromFriendsCents);
  const settledFriendsCount = useMemo(() => friends.filter((f) => f.is_settled).length, [friends]);

  const settledSubtitle = useMemo(() => {
    const hostId = participants.find((p) => p.is_host)?.id;
    const friendInsts = participantInstallments.filter((i) => i.participant_id !== hostId);
    if (friendInsts.length > 0) {
      return `${friendInsts.filter((i) => i.is_settled).length} de ${friendInsts.length} parcelas pagas`;
    }
    return `${settledFriendsCount} de ${friends.length} amigos baixados`;
  }, [participants, participantInstallments, settledFriendsCount, friends.length]);

  const hostNetCostCents = Math.max(0, totalCents - totalSettledFromFriendsCents);
  const netReportWeight = totalCents > 0 ? hostNetCostCents / totalCents : 1;
  const isCompleted = Boolean(payload.is_completed) || isSplitFullyCompleted(participants, participantInstallments);

  // Preview de edição (Aba 2)
  const editPreview = useMemo(() => {
    const equalPreviewShares = splitAmountEqually(Math.max(0, editedTotalCents), Math.max(1, editedParticipants.length), {
      remainderPolicy: editedRemainderPolicy,
    });
    const resolvedPreviewShares = editedParticipants.map((p, idx) =>
      editedSplitMode === "custom" ? p.fixedCents : (equalPreviewShares[idx] ?? 0),
    );
    const overpaidNotices = editedParticipants
      .map((p, idx) => {
        if (p.isHost) return null;
        const nextShare = resolvedPreviewShares[idx] ?? 0;
        if (p.settledCents <= nextShare) return null;
        return {
          participantId: p.id,
          name: p.name,
          previousSettledCents: p.settledCents,
          newShareCents: nextShare,
          excessCents: p.settledCents - nextShare,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const editableList: EditableSplitParticipant[] = editedParticipants.map((p, idx) => ({
      ...p,
      sharePreviewCents: resolvedPreviewShares[idx] ?? 0,
    }));

    const customSumCents = editedParticipants.reduce((acc, p) => acc + Math.max(0, p.fixedCents), 0);
    const isEditValid =
      editedTotalCents > 0 &&
      editedParticipants.filter((p) => !p.isHost).length >= 1 &&
      editedTitle.trim().length > 0 &&
      (editedSplitMode === "equal" || customSumCents === editedTotalCents);

    return { editableList, overpaidNotices, customSumCents, isEditValid };
  }, [editedTotalCents, editedParticipants, editedRemainderPolicy, editedSplitMode, editedTitle]);

  // Validação Pix e prévia QR Code (Aba 3)
  const pixValidation = useMemo(
    () =>
      validateAndClassifyPixKey(
        editedPixKey,
        editedKeyType === "auto" ? undefined : (editedKeyType as PixKeyType),
      ),
    [editedPixKey, editedKeyType],
  );

  const firstGuestPreviewAmountCents = useMemo(() => {
    const firstGuest = friends[0];
    if (!firstGuest) return Math.max(0, Number(payload.guest_share_cents ?? 0));
    if (installmentsCount > 1 && payload.installments_mode !== "single_total") {
      const firstInst = participantInstallments.find(
        (i) => i.participant_id === firstGuest.id && !i.is_settled,
      ) ?? participantInstallments.find((i) => i.participant_id === firstGuest.id);
      if (firstInst) return firstInst.amount_cents;
    }
    return Math.max(0, firstGuest.share_cents - Number(firstGuest.settled_cents ?? 0)) || firstGuest.share_cents;
  }, [friends, payload.guest_share_cents, installmentsCount, payload.installments_mode, participantInstallments]);

  const previewBrCode = useMemo(() => {
    if (!pixValidation.isValid || !pixValidation.resolvedType) {
      return "";
    }
    return (
      buildPixTransferCode({
        pixKey: pixValidation.normalizedKey ?? editedPixKey.trim(),
        keyType: pixValidation.resolvedType,
        merchantName: editedHostName.trim() || "Anfitriao",
        merchantCity: editedHostCity.trim() || DEFAULT_PIX_CITY,
        amountCents: firstGuestPreviewAmountCents,
        txId: "***",
        infoAdicional: editedTitle.trim() || payload.title || "Racha de conta",
        defaultMerchantName: "Anfitriao",
        defaultMerchantCity: DEFAULT_PIX_CITY,
      }) ?? ""
    );
  }, [pixValidation, editedHostCity, editedPixKey, editedHostName, firstGuestPreviewAmountCents, editedTitle, payload.title]);

  const isPublicConfigValid = pixValidation.isValid;

  // Handlers de Baixas (Aba 1)
  const handleSettleFull = async (participantId: string) => {
    try {
      await applySplitSettlement.mutateAsync({
        share,
        action: { type: "settle_full_participant", participantId },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("action");
      pushToast({ title: "Baixa registrada!", description: "Reembolso integral do participante registrado.", variant: "success" });
    } catch { triggerSensory("destructive"); }
  };

  const handleConfirmCustomSettle = async () => {
    if (!customInputParticipantId) return;
    try {
      await applySplitSettlement.mutateAsync({
        share,
        action: {
          type: "settle_custom_participant",
          participantId: customInputParticipantId,
          settledCents: customInputCents,
        },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("action");
      setCustomInputParticipantId(null);
      pushToast({
        title: "Baixa registrada!",
        description: customInputCents === 0 ? "Calote registrado (R$ 0,00). O valor restante foi mantido no seu custo." : "Valor personalizado recebido com sucesso.",
        variant: "success",
      });
    } catch { triggerSensory("destructive"); }
  };

  const handleUnsettle = async (participantId: string) => {
    try {
      await applySplitSettlement.mutateAsync({
        share,
        action: { type: "unsettle_participant", participantId },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("selection");
      pushToast({ title: "Baixa desfeita", description: "O participante voltou ao status de pendente.", variant: "default" });
    } catch { triggerSensory("destructive"); }
  };

  const handleToggleSettleInstallment = async (installmentId: string, markSettled: boolean) => {
    try {
      await applySplitSettlement.mutateAsync({
        share,
        action: { type: "toggle_installment", installmentId, markSettled },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("action");
      pushToast({
        title: markSettled ? "Parcela marcada como paga!" : "Baixa da parcela desfeita",
        variant: "success",
      });
    } catch { triggerSensory("destructive"); }
  };

  const handleConfirmSignal = async (signalId: string) => {
    try {
      await applySplitSettlement.mutateAsync({
        share,
        action: { type: "confirm_signal", signalId },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("success");
      pushToast({ title: "Pagamento confirmado!", description: "O valor foi abatido do racha e da despesa.", variant: "success" });
    } catch { triggerSensory("destructive"); }
  };

  const handleDismissSignal = async (signalId: string) => {
    try {
      await dismissSignalMutation.mutateAsync({ shareId: share.id, signalId });
      triggerSensory("action");
    } catch { triggerSensory("destructive"); }
  };

  const handleSettleAll = async () => {
    try {
      await applySplitSettlement.mutateAsync({
        share,
        action: { type: "settle_all" },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("success");
      setConfirmFinalizeOpen(false);
      pushToast({
        title: "Todos os pagamentos confirmados!",
        description: "Racha quitado integralmente e link público encerrado.",
        variant: "success",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch { triggerSensory("destructive"); }
  };

  const handleFinalizeSplit = async () => {
    try {
      const res = await applySplitSettlement.mutateAsync({
        share,
        action: { type: "finalize_as_is" },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("success");
      setConfirmFinalizeOpen(false);
      pushToast({
        title: "Racha finalizado com sucesso!",
        description: `Sua despesa foi ajustada para ${formatCentsAsBRL(res.transition.hostNetCostCents)} e a cobrança foi liquidada.`,
        variant: "success",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch { triggerSensory("destructive"); }
  };

  const handleReopenSplit = async () => {
    try {
      await applySplitSettlement.mutateAsync({
        share,
        action: { type: "reopen" },
        linkedDebt,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("selection");
      pushToast({ title: "Racha reaberto!", description: "O acompanhamento e o link voltaram a ficar ativos.", variant: "default" });
    } catch { triggerSensory("destructive"); }
  };

  // Handlers de Edição (Aba 2)
  const handleEditSplitModeChange = (mode: "equal" | "custom") => {
    setEditedSplitMode(mode);
    if (mode === "custom") {
      const equal = splitAmountEqually(Math.max(0, editedTotalCents), Math.max(1, editedParticipants.length), {
        remainderPolicy: editedRemainderPolicy,
      });
      setEditedParticipants((prev) =>
        prev.map((p, idx) => ({ ...p, fixedCents: equal[idx] ?? 0 })),
      );
    }
  };

  const handleEditParticipantName = (index: number, name: string) => {
    setEditedParticipants((prev) => prev.map((p, idx) => (idx === index ? { ...p, name } : p)));
  };

  const handleEditParticipantFixedCents = (index: number, cents: number) => {
    setEditedParticipants((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, fixedCents: Math.max(0, cents) } : p)),
    );
  };

  const handleAddParticipant = () => {
    if (editedParticipants.length >= 50) return;
    setEditedParticipants((prev) => [
      ...prev,
      {
        id: `p_${Date.now().toString(36)}_${prev.length + 1}`,
        name: `Convidado ${prev.length}`,
        isHost: false,
        fixedCents: 0,
        settledCents: 0,
      },
    ]);
  };

  const handleRemoveParticipant = (index: number) => {
    const target = editedParticipants[index];
    if (!target || target.isHost || target.settledCents > 0) return;
    if (editedParticipants.filter((p) => !p.isHost).length <= 1) return;
    setEditedParticipants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildCurrentPixEditBase = (): Omit<SplitEditInput, "pixKey" | "pixKeyType" | "hostName" | "hostCity" | "customNote" | "showParticipantsList" | "publicPagePaused"> => ({
    title: editedTitle.trim() || payload.title || "Racha de Despesa",
    totalCents: editedTotalCents,
    date: editedDate,
    dueDate: editedDueDate || null,
    splitMode: editedSplitMode,
    remainderPolicy: editedRemainderPolicy,
    participants: editedParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      fixedCents: editedSplitMode === "custom" ? p.fixedCents : null,
    })),
    installmentsCount,
    installmentsMode: editedInstallmentsMode,
  });

  const handleSaveEdit = async () => {
    if (!editPreview.isEditValid) return;
    const validKeyType: PixKeyType =
      pixValidation.resolvedType ?? (payload.pix_key_type as PixKeyType) ?? "cpf";
    const hostRow = editedParticipants.find((p) => p.isHost);
    const edit: SplitEditInput = {
      ...buildCurrentPixEditBase(),
      pixKey: pixValidation.normalizedKey ?? (editedPixKey.trim() || payload.pix_key),
      pixKeyType: validKeyType,
      hostName: editedHostName.trim() || hostRow?.name || payload.host_name || "Anfitrião",
      hostCity: editedHostCity.trim() || payload.host_city || DEFAULT_PIX_CITY,
      customNote: editedCustomNote,
      showParticipantsList: editedShowParticipantsList,
      publicPagePaused: editedPublicPagePaused,
    };

    try {
      await updateSplitComprehensive.mutateAsync({
        share,
        edit,
        linkedDebt,
        syncExpense: true,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("success");
      pushToast({
        title: "Racha e despesa atualizados!",
        description: "Os novos valores, participantes e link Pix estão sincronizados.",
        variant: "success",
      });
      setActiveTab("settlements");
    } catch { triggerSensory("destructive"); }
  };

  // Handlers de Pix e Página Pública (Aba 3)
  const buildPublicConfigEditInput = (): SplitEditInput => {
    const validKeyType: PixKeyType = pixValidation.resolvedType ?? "cpf";
    const normalizedParticipants = buildEditDraftParticipants(payload);
    return {
      title: payload.title || "Racha de Despesa",
      totalCents: Number(payload.total_cents ?? 0),
      date: payload.date || todayISO(),
      dueDate: payload.due_date ?? null,
      splitMode: payload.split_mode ?? "equal",
      remainderPolicy: payload.remainder_policy ?? "host",
      participants: normalizedParticipants.map((p) => ({
        id: p.id,
        name: p.isHost && editedHostName.trim() ? editedHostName.trim() : p.name,
        isHost: p.isHost,
        fixedCents: payload.split_mode === "custom" ? p.fixedCents : null,
      })),
      installmentsCount,
      installmentsMode: payload.installments_mode ?? "per_installment",
      pixKey: pixValidation.normalizedKey ?? editedPixKey.trim(),
      pixKeyType: validKeyType,
      hostName: editedHostName.trim() || "Anfitrião",
      hostCity: editedHostCity.trim() || DEFAULT_PIX_CITY,
      customNote: editedCustomNote,
      showParticipantsList: editedShowParticipantsList,
      publicPagePaused: editedPublicPagePaused,
    };
  };

  const handleSavePublicConfig = async () => {
    if (!isPublicConfigValid || !pixValidation.resolvedType) return;
    try {
      await updateSplitComprehensive.mutateAsync({
        share,
        edit: buildPublicConfigEditInput(),
        linkedDebt,
        syncExpense: false,
        installmentsTotal: installmentsCount,
      });
      updatePreferences({
        pixKey: pixValidation.normalizedKey ?? editedPixKey.trim(),
        pixKeyType: pixValidation.resolvedType,
        merchantName: editedHostName.trim(),
        merchantCity: editedHostCity.trim(),
      });
      triggerSensory("success");
      pushToast({
        title: "Configurações Pix e página salvas!",
        description: editedPublicPagePaused
          ? "O link público está pausado até você reativá-lo."
          : "Seu QR Code e preferências públicas foram atualizados.",
        variant: "success",
      });
    } catch { triggerSensory("destructive"); }
  };

  const handleExtendExpiration = async () => {
    const baseMs = share.expires_at ? Math.max(Date.now(), new Date(share.expires_at).getTime()) : Date.now();
    const nextIso = resolveSplitExpirationIso(payload.date || todayISO(), installmentsCount, 60, baseMs);
    try {
      await updateSplitComprehensive.mutateAsync({
        share,
        edit: buildPublicConfigEditInput(),
        linkedDebt,
        expiresAt: nextIso,
        syncExpense: false,
        installmentsTotal: installmentsCount,
      });
      triggerSensory("success");
      pushToast({ title: "Validade do link estendida!", variant: "success" });
    } catch { triggerSensory("destructive"); }
  };

  const handleRegenerateLink = async () => {
    try {
      const updated = await updateSplitComprehensive.mutateAsync({
        share,
        edit: buildPublicConfigEditInput(),
        linkedDebt,
        regenerateToken: true,
        syncExpense: false,
        installmentsTotal: installmentsCount,
      });
      const nextUrl = getPublicShareUrl(`r/${updated.share.token}`);
      await copyTextToClipboard(nextUrl);
      triggerSensory("success");
      pushToast({
        title: "Novo link gerado e copiado!",
        description: "O link anterior foi invalidado imediatamente.",
        variant: "success",
      });
    } catch { triggerSensory("destructive"); }
  };

  const handleTestCopyBrCode = async () => {
    const cleanCode = previewBrCode.trim();
    if (!cleanCode) return;
    const ok = await copyTextToClipboard(cleanCode);
    if (ok) {
      triggerSensory("selection");
      pushToast({ title: "Pix Copia e Cola copiado para teste!", variant: "default" });
    } else {
      pushToast({ title: "Não foi possível copiar automaticamente.", variant: "destructive" });
    }
  };

  const handleCopyPublicLink = async () => {
    const ok = await copyTextToClipboard(getPublicShareUrl(`r/${share.token}`));
    if (ok) {
      triggerSensory("selection");
      pushToast({ title: "Link público copiado!", variant: "default" });
    }
  };

  const handleDeleteSplit = async () => {
    try {
      await deleteLinkedSplit.mutateAsync({
        share,
        linkedDebt: deleteLinkedDebt ? linkedDebt : null,
        deleteExpense: deleteOriginalExpense,
      });
      triggerSensory("destructive");
      setConfirmDeleteOpen(false);
      pushToast({
        title: "Racha excluído com sucesso!",
        description:
          deleteOriginalExpense && hasLinkedExpense
            ? "O racha e a despesa vinculada foram removidos."
            : hasLinkedExpense
              ? "O racha foi removido e a despesa original foi restaurada para 100%."
              : "O racha foi removido.",
        variant: "default",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch { triggerSensory("destructive"); }
  };

  const isMutating =
    applySplitSettlement.isPending ||
    updateSplitComprehensive.isPending ||
    deleteLinkedSplit.isPending ||
    dismissSignalMutation.isPending;

  return {
    payload,
    linkedExpense,
    isExpenseFetched,
    hasLinkedExpense,
    isMultiInstallmentGroup,
    installmentsCount,
    participants,
    friends,
    participantInstallments,
    pendingSignals,
    activeTab,
    setActiveTab,
    customInputParticipantId,
    setCustomInputParticipantId,
    customInputCents,
    setCustomInputCents,
    confirmFinalizeOpen,
    setConfirmFinalizeOpen,
    confirmDeleteOpen,
    setConfirmDeleteOpen,
    deleteLinkedDebt,
    setDeleteLinkedDebt,
    deleteOriginalExpense,
    setDeleteOriginalExpense,
    isDeleting: deleteLinkedSplit.isPending,
    isSaving: updateSplitComprehensive.isPending,
    isMutating,
    totalCents,
    totalSettledFromFriendsCents,
    remainingReceivableCents,
    settledSubtitle,
    hostNetCostCents,
    netReportWeight,
    isCompleted,
    // Aba 2
    editedTitle,
    setEditedTitle,
    editedTotalCents,
    setEditedTotalCents,
    editedDate,
    setEditedDate,
    editedDueDate,
    setEditedDueDate,
    editedRemainderPolicy,
    setEditedRemainderPolicy,
    editedSplitMode,
    handleEditSplitModeChange,
    editedInstallmentsMode,
    setEditedInstallmentsMode,
    editableParticipants: editPreview.editableList,
    overpaidNotices: editPreview.overpaidNotices,
    customSumCents: editPreview.customSumCents,
    isEditValid: editPreview.isEditValid,
    handleEditParticipantName,
    handleEditParticipantFixedCents,
    handleAddParticipant,
    handleRemoveParticipant,
    handleSaveEdit,
    // Aba 3
    editedPixKey,
    setEditedPixKey,
    editedKeyType,
    setEditedKeyType,
    detectedPixType: pixValidation.resolvedType,
    pixValidationError: pixValidation.errorMessage,
    isAmbiguousCpfOrPhone: pixValidation.isAmbiguousCpfOrPhone,
    profileSuggestions: profile ? { cpf: profile.cpf, email: profile.email } : undefined,
    editedHostName,
    setEditedHostName,
    editedHostCity,
    setEditedHostCity,
    editedCustomNote,
    setEditedCustomNote,
    editedShowParticipantsList,
    setEditedShowParticipantsList,
    editedPublicPagePaused,
    setEditedPublicPagePaused,
    previewBrCode,
    firstGuestPreviewAmountCents,
    publicUrl: getPublicShareUrl(`r/${share.token}`),
    isPublicConfigValid,
    // Ações
    handleOpenDeleteConfirm: () => {
      setDeleteLinkedDebt(Boolean(linkedDebt));
      setDeleteOriginalExpense(false);
      setConfirmDeleteOpen(true);
    },
    handleOpenCustomSettle: (p: SplitParticipantItem) => {
      setCustomInputParticipantId(p.id || null);
      setCustomInputCents(p.share_cents);
    },
    handleSettleFull,
    handleConfirmCustomSettle,
    handleUnsettle,
    handleToggleSettleInstallment,
    handleConfirmSignal,
    handleDismissSignal,
    handleSettleAll,
    handleFinalizeSplit,
    handleReopenSplit,
    handleSavePublicConfig,
    handleExtendExpiration,
    handleRegenerateLink,
    handleTestCopyBrCode,
    handleCopyPublicLink,
    handleDeleteSplit,
  };
}
