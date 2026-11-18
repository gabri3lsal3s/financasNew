import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isSplitFullyCompleted } from "@/domain/finance/split-math";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { deleteAllSplitExpenses, syncSplitExpenseReportWeights } from "@/services/split-sync";
import { pushToast } from "@/services/toast";
import {
  useDeleteDebt, useDeletePublicShare, useExpense, useExpensesByInstallmentGroup,
  useSettleIntegratedReceivable, useUpdateDebt, useUpdateExpense, useUpdatePublicShare,
} from "@/state";
import type { Debt, PublicShare, SplitParticipantInstallment, SplitParticipantItem, SplitSharePayload } from "@/types";
import { buildInitialSplitParticipants } from "./split-constants";
import {
  applyInstallmentToggle, applyParticipantCustomSettle,
  applyParticipantFullSettle, applyParticipantUnsettle,
} from "./split-manage-helpers";

export interface UseManageSplitParams {
  share: PublicShare;
  linkedDebt?: Debt | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function useManageSplit({ share, linkedDebt, onOpenChange, onSuccess }: UseManageSplitParams) {
  const queryClient = useQueryClient();
  const updateShareMutation = useUpdatePublicShare();
  const deleteShareMutation = useDeletePublicShare();
  const updateExpenseMutation = useUpdateExpense();
  const updateDebtMutation = useUpdateDebt();
  const deleteDebtMutation = useDeleteDebt();
  const settleDebtMutation = useSettleIntegratedReceivable();

  const payload = (share.payload ?? {}) as unknown as SplitSharePayload;
  const { data: linkedExpense, isFetched: isExpenseFetched } = useExpense(payload.expense_id ?? null);
  const hasLinkedExpense = Boolean(payload.expense_id && (!isExpenseFetched || linkedExpense));
  const groupId = payload.installment_group_id ?? linkedExpense?.installment_group_id ?? null;
  const { data: groupExpenses } = useExpensesByInstallmentGroup(groupId);

  const [participants, setParticipants] = useState<SplitParticipantItem[]>(() => buildInitialSplitParticipants(payload));
  const [participantInstallments, setParticipantInstallments] = useState<SplitParticipantInstallment[]>(
    () => payload.participant_installments ?? [],
  );
  const [customInputParticipantId, setCustomInputParticipantId] = useState<string | null>(null);
  const [customInputCents, setCustomInputCents] = useState<number>(0);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLinkedDebt, setDeleteLinkedDebt] = useState<boolean>(true);
  const [deleteOriginalExpense, setDeleteOriginalExpense] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editedTitle, setEditedTitle] = useState(payload.title || "");
  const [editedPixKey, setEditedPixKey] = useState(payload.pix_key || "");

  const totalCents = Number(payload.total_cents ?? 0);
  const friends = useMemo(() => participants.filter((p) => !p.is_host), [participants]);
  const totalSettledFromFriendsCents = useMemo(
    () => friends.reduce((acc, f) => acc + Number(f.settled_cents ?? (f.is_settled ? f.share_cents : 0)), 0),
    [friends],
  );
  const settledFriendsCount = useMemo(() => friends.filter((f) => f.is_settled).length, [friends]);

  const settledSubtitle = useMemo(() => {
    const hostId = participants.find((p) => p.is_host)?.id;
    const friendInsts = participantInstallments.filter((i) => i.participant_id !== hostId);
    if (friendInsts.length > 0) return `${friendInsts.filter((i) => i.is_settled).length} de ${friendInsts.length} parcelas pagas`;
    return `${settledFriendsCount} de ${friends.length} amigos baixados`;
  }, [participants, participantInstallments, settledFriendsCount, friends.length]);

  const hostNetCostCents = Math.max(0, totalCents - totalSettledFromFriendsCents);
  const netReportWeight = totalCents > 0 ? hostNetCostCents / totalCents : 1;
  const isCompleted = isSplitFullyCompleted(participants, participantInstallments);

  const persistParticipants = async (
    updatedParticipants: SplitParticipantItem[],
    options?: { markCompleted?: boolean; updatedInstallments?: SplitParticipantInstallment[] },
  ) => {
    const updatedSettledTotal = updatedParticipants
      .filter((p) => !p.is_host)
      .reduce((acc, f) => acc + Number(f.settled_cents ?? (f.is_settled ? f.share_cents : 0)), 0);
    const installmentsToPersist = options?.updatedInstallments ?? participantInstallments;
    const completed = options?.markCompleted ?? isSplitFullyCompleted(updatedParticipants, installmentsToPersist);

    const newPayload: SplitSharePayload = {
      ...payload, title: editedTitle.trim() || payload.title, pix_key: editedPixKey.trim() || payload.pix_key,
      participants: updatedParticipants,
      participant_installments: installmentsToPersist.length > 0 ? installmentsToPersist : undefined,
      total_settled_cents: updatedSettledTotal, is_completed: completed, installment_group_id: groupId,
    };

    setParticipants(updatedParticipants);
    if (options?.updatedInstallments) setParticipantInstallments(options.updatedInstallments);

    await updateShareMutation.mutateAsync({
      id: share.id,
      payload: newPayload as unknown as Record<string, unknown>,
      isRevoked: completed,
    });

    if (payload.expense_id && hasLinkedExpense) {
      try {
        await syncSplitExpenseReportWeights({
          expenseId: payload.expense_id, installments: installmentsToPersist,
          hostId: updatedParticipants.find((p) => p.is_host)?.id, totalCents, installmentsCount: payload.installments_count, groupId,
        });
        void queryClient.invalidateQueries({ queryKey: ["expenses"] });
        void queryClient.invalidateQueries({ queryKey: ["card-expenses"] });
      } catch (err) { console.warn("Não foi possível sincronizar pesos contábeis das parcelas:", err); }
    }

    if (linkedDebt && !linkedDebt.paid_at) {
      try {
        const remaining = Math.max(0, friends.reduce((acc, f) => acc + f.share_cents, 0) - updatedSettledTotal);
        if (completed || remaining === 0) await settleDebtMutation.mutateAsync({ debtId: linkedDebt.id, result: hostNetCostCents / 100 });
        else await updateDebtMutation.mutateAsync({ id: linkedDebt.id, input: { amount: remaining / 100 } });
      } catch (err) { console.warn("Não foi possível sincronizar a dívida vinculada:", err); }
    }
  };

  const handleSettleFull = async (participantId: string) => {
    const next = applyParticipantFullSettle(participants, participantInstallments, participantId);
    try {
      await persistParticipants(next.participants, { updatedInstallments: next.installments, markCompleted: isSplitFullyCompleted(next.participants, next.installments) });
      triggerSensory("action");
      pushToast({ title: "Baixa registrada!", description: "Reembolso integral do participante registrado.", variant: "success" });
    } catch { triggerSensory("destructive"); }
  };

  const handleConfirmCustomSettle = async () => {
    if (!customInputParticipantId) return;
    const next = applyParticipantCustomSettle(participants, participantInstallments, customInputParticipantId, customInputCents);
    try {
      await persistParticipants(next.participants, { updatedInstallments: next.installments, markCompleted: isSplitFullyCompleted(next.participants, next.installments) });
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
    const next = applyParticipantUnsettle(participants, participantInstallments, participantId);
    try {
      await persistParticipants(next.participants, { updatedInstallments: next.installments, markCompleted: false });
      triggerSensory("selection");
      pushToast({ title: "Baixa desfeita", description: "O participante voltou ao status de pendente.", variant: "default" });
    } catch { triggerSensory("destructive"); }
  };

  const handleToggleSettleInstallment = async (installmentId: string, markSettled: boolean) => {
    const next = applyInstallmentToggle(participants, participantInstallments, installmentId, markSettled);
    if (!next) return;
    try {
      await persistParticipants(next.participants, { updatedInstallments: next.installments, markCompleted: isSplitFullyCompleted(next.participants, next.installments) });
      triggerSensory("action");
      pushToast({
        title: markSettled ? "Parcela marcada como paga!" : "Baixa da parcela desfeita",
        description: markSettled ? `Parcela ${next.target.installment_number}/${next.target.total_installments} quitada com sucesso.` : `Parcela ${next.target.installment_number}/${next.target.total_installments} reaberta como pendente.`,
        variant: "success",
      });
    } catch { triggerSensory("destructive"); }
  };

  const handleFinalizeSplit = async () => {
    try {
      await persistParticipants(participants, { markCompleted: true });
      triggerSensory("success");
      setConfirmFinalizeOpen(false);
      pushToast({ title: "Racha finalizado com sucesso!", description: `Sua despesa foi ajustada para ${formatCentsAsBRL(hostNetCostCents)} e a cobrança foi liquidada.`, variant: "success" });
      onSuccess?.();
      onOpenChange(false);
    } catch { triggerSensory("destructive"); }
  };

  const handleSaveInfo = async () => {
    try {
      await persistParticipants(participants);
      setIsEditingInfo(false);
      triggerSensory("success");
      pushToast({ title: "Dados atualizados com sucesso!", variant: "default" });
    } catch { triggerSensory("destructive"); }
  };

  const handleDeleteSplit = async () => {
    setIsDeleting(true);
    try {
      if (deleteOriginalExpense && payload.expense_id && hasLinkedExpense) {
        try {
          await deleteAllSplitExpenses({ expenseId: payload.expense_id, groupId });
          void queryClient.invalidateQueries({ queryKey: ["expenses"] });
          void queryClient.invalidateQueries({ queryKey: ["card-expenses"] });
        } catch (err) { console.warn("Não foi possível excluir despesa vinculada (pode já ter sido excluída):", err); }
      } else if (!deleteOriginalExpense && payload.expense_id && hasLinkedExpense) {
        try {
          const targets = groupExpenses && groupExpenses.length > 0 ? groupExpenses.map((e) => e.id) : [payload.expense_id];
          for (const id of targets) await updateExpenseMutation.mutateAsync({ id, input: { report_weight: 1 } });
        } catch (err) { console.warn("Não foi possível restaurar peso da despesa vinculada (pode já ter sido excluída):", err); }
      }
      if (deleteLinkedDebt && linkedDebt) {
        try { await deleteDebtMutation.mutateAsync(linkedDebt.id); } catch (err) { console.warn("Não foi possível excluir dívida vinculada (pode já ter sido excluída):", err); }
      }
      await deleteShareMutation.mutateAsync(share.id);
      triggerSensory("destructive");
      setConfirmDeleteOpen(false);
      pushToast({
        title: "Racha excluído com sucesso!",
        description: deleteOriginalExpense && hasLinkedExpense ? "O racha e a despesa vinculada foram removidos." : hasLinkedExpense ? "O racha foi removido e a despesa original foi restaurada para 100%." : "O racha foi removido.",
        variant: "default",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {
      triggerSensory("destructive");
      pushToast({ title: "Erro ao excluir racha", description: "Não foi possível concluir a exclusão. Tente novamente.", variant: "destructive" });
    } finally { setIsDeleting(false); }
  };

  return {
    payload, linkedExpense, isExpenseFetched, hasLinkedExpense, participants, friends, participantInstallments,
    customInputParticipantId, setCustomInputParticipantId, customInputCents, setCustomInputCents,
    confirmFinalizeOpen, setConfirmFinalizeOpen, confirmDeleteOpen, setConfirmDeleteOpen,
    deleteLinkedDebt, setDeleteLinkedDebt, deleteOriginalExpense, setDeleteOriginalExpense, isDeleting,
    isEditingInfo, setIsEditingInfo, editedTitle, setEditedTitle, editedPixKey, setEditedPixKey,
    totalCents, totalSettledFromFriendsCents, settledSubtitle, hostNetCostCents, netReportWeight, isCompleted,
    handleOpenDeleteConfirm: () => { setDeleteLinkedDebt(Boolean(linkedDebt)); setDeleteOriginalExpense(false); setConfirmDeleteOpen(true); },
    handleOpenCustomSettle: (p: SplitParticipantItem) => { setCustomInputParticipantId(p.id || null); setCustomInputCents(p.share_cents); },
    handleSettleFull, handleConfirmCustomSettle, handleUnsettle, handleToggleSettleInstallment,
    handleFinalizeSplit, handleSaveInfo, handleDeleteSplit,
  };
}
