import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveBillCompetence } from "@/domain/competence";
import { todayISO } from "@/domain/debts";
import { evaluateExpensePriceEvolution } from "@/domain/insights";
import { formatDateBR, shiftMonth } from "@/lib/date";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { getErrorMessage } from "@/services/errors";
import { shareText } from "@/services/export-actions";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCategories, useCreateExpense, useCreditCards, useDebts, useDeleteExpense,
  useDeleteRecurrenceOccurrences, useExpenses, useExpensesByInstallmentGroup, useFamilyMode, useMyFamily,
  useMyPublicShares, useSyncSplitFromExpenseEdit, useUpdateDebt, useUpdateExpense, useUpdateExpenseGrouped, useUpdateRecurrenceOccurrences,
} from "@/state";
import { useDeletePublicShareMutation } from "@/state/mutations/use-public-share-mutations";
import {
  TRIP_QUERY_KEYS, useDeleteTripExpenseLinkedMutation, useTripDetails, useUpdateTripExpenseLinkedMutation,
} from "@/state/queries/use-trips";
import { useSafeBusinessMode, useSafeDeleteInternalTransferPair } from "@/hooks/use-safe-business-scope";
import type { Expense, InstallmentDeleteMode, RecurrenceGroupFields, SplitSharePayload } from "@/types";
import type { ExpenseEditSavePayload } from "./expense-edit-form";
import type { TripDeleteMode } from "./transaction-group-constants";

function useSafeQueryClient() {
  try { return useQueryClient(); } catch { return null; }
}

export interface UseExpenseDetailActionsParams {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InstallmentDeleteMode;
  editScope: InstallmentDeleteMode;
  tripDeleteMode: TripDeleteMode;
  setError: (err: string | null) => void;
  setConfirmOpen: (open: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  onRequestOpenSplit?: (updatedExpense: Expense) => void;
}

export function useExpenseDetailActions({
  expense, open, onOpenChange, mode, editScope, tripDeleteMode, setError, setConfirmOpen, setIsEditing, onRequestOpenSplit,
}: UseExpenseDetailActionsParams) {
  const queryClient = useSafeQueryClient();
  const categories = useCategories("expense").data ?? [];
  const cards = useCreditCards().data ?? [];
  const isFamilyActive = Boolean(useFamilyMode().isFamilyModeEnabled);
  const { isBusinessModeEnabled: isBusinessActive } = useSafeBusinessMode();
  const { data: myFamilyData } = useMyFamily();

  const deleteExpense = useDeleteExpense();
  const deleteTransferPair = useSafeDeleteInternalTransferPair();
  const deleteRecurrence = useDeleteRecurrenceOccurrences();
  const updateExpense = useUpdateExpense();
  const updateExpenseGrouped = useUpdateExpenseGrouped();
  const updateRecurrence = useUpdateRecurrenceOccurrences();
  const createExpense = useCreateExpense();
  const deletePublicShare = useDeletePublicShareMutation({ silentError: true });
  const syncSplitFromExpenseEdit = useSyncSplitFromExpenseEdit();
  const updateDebt = useUpdateDebt();
  const deleteTripExpenseLinked = useDeleteTripExpenseLinkedMutation(expense?.trip_id ?? "");
  const updateTripExpenseLinked = useUpdateTripExpenseLinkedMutation(expense?.trip_id ?? "");

  const currentCategory = categories.find((c) => c.id === expense?.category_id);
  const expenseMonth = expense ? expense.date.slice(0, 7) : "";
  const isDetailOpen = open && Boolean(expense);
  const tripName = useTripDetails(isDetailOpen && Boolean(expense?.trip_id) ? expense?.trip_id : null).data?.trip?.title;
  const expQ = useExpenses(expenseMonth, { enabled: isDetailOpen });
  const p1 = useExpenses(shiftMonth(expenseMonth, -1), { enabled: isDetailOpen && Boolean(expenseMonth) });
  const p2 = useExpenses(shiftMonth(expenseMonth, -2), { enabled: isDetailOpen && Boolean(expenseMonth) });
  const p3 = useExpenses(shiftMonth(expenseMonth, -3), { enabled: isDetailOpen && Boolean(expenseMonth) });
  const { data: splitShares } = useMyPublicShares("split", { enabled: isDetailOpen });
  const { data: debts } = useDebts({ enabled: isDetailOpen });
  const { data: groupExpensesRaw } = useExpensesByInstallmentGroup(
    isDetailOpen ? expense?.installment_group_id : null,
  );

  const groupExpenses = useMemo(() => {
    if (groupExpensesRaw && groupExpensesRaw.length > 0) return groupExpensesRaw;
    return expense ? [expense] : [];
  }, [groupExpensesRaw, expense]);

  const groupTotalCents = useMemo(() => {
    if (!expense) return 0;
    if (groupExpenses.length > 1) {
      return groupExpenses.reduce((acc, item) => acc + Math.round(Number(item.value) * 100), 0);
    }
    if (expense.installments_total > 1) {
      return Math.round(Number(expense.value) * 100) * expense.installments_total;
    }
    return Math.round(Number(expense.value) * 100);
  }, [groupExpenses, expense]);

  const linkedSplitShare = useMemo(() => {
    if (!expense || !splitShares) return null;
    return splitShares.find((s) => {
      const p = (s.payload ?? {}) as unknown as SplitSharePayload;
      return (
        s.expense_id === expense.id ||
        p.expense_id === expense.id ||
        Boolean(
          expense.installment_group_id &&
            (s.installment_group_id === expense.installment_group_id ||
              p.installment_group_id === expense.installment_group_id),
        )
      );
    }) ?? null;
  }, [expense, splitShares]);

  const linkedRachaDebt = useMemo(() => {
    if (!expense || !debts) return null;
    const shareDebtId = linkedSplitShare?.debt_id || (linkedSplitShare?.payload as Record<string, unknown> | undefined)?.debt_id;
    return debts.find((d) =>
      (typeof shareDebtId === "string" && d.id === shareDebtId) ||
      (d.type === "receivable" &&
        (d.expense_id === expense.id ||
          (expense.installment_group_id && d.installment_group_id === expense.installment_group_id)) &&
        (d.name.toLowerCase().startsWith("racha:") || d.name.toLowerCase().includes("racha"))),
    ) ?? null;
  }, [expense, debts, linkedSplitShare]);

  const hasLinkedSplit = Boolean(linkedSplitShare);
  const isRachaExpense = Boolean(linkedSplitShare || linkedRachaDebt || (expense && expense.report_weight < 1));
  const priceEvolution = useMemo(() => {
    if (!expense) return null;
    return evaluateExpensePriceEvolution(expense, [...(expQ.data ?? []), ...(p1.data ?? []), ...(p2.data ?? []), ...(p3.data ?? [])]);
  }, [expense, expQ.data, p1.data, p2.data, p3.data]);

  const isInternalTransfer = Boolean(expense?.is_internal_transfer && expense?.transfer_pair_id);
  const isInstallment = expense != null && expense.installments_total > 1;
  const isRecurring = expense?.recurrence_id != null;
  const isGrouped = isInstallment || isRecurring;
  const editPending =
    updateExpense.isPending ||
    updateExpenseGrouped.isPending ||
    updateRecurrence.isPending ||
    syncSplitFromExpenseEdit.isPending ||
    updateDebt.isPending;
  const deletePending =
    deleteExpense.isPending ||
    deleteTransferPair.isPending ||
    deleteRecurrence.isPending ||
    deleteTripExpenseLinked.isPending;

  const deleteBaseExpense = async () => {
    if (!expense) return;
    if (isRecurring) await deleteRecurrence.mutateAsync({ occurrenceId: expense.id, mode });
    else await deleteExpense.mutateAsync({ expenseId: expense.id, mode });
  };

  const handleConfirmDelete = async () => {
    if (!expense) return;
    setError(null);
    setConfirmOpen(false);
    onOpenChange(false);
    try {
      if (isInternalTransfer && expense.transfer_pair_id) {
        await deleteTransferPair.mutateAsync(expense.transfer_pair_id);
        pushToast({
          title: "Transferência pareada removida das duas esferas (PF e PJ)",
          variant: "success",
        });
        return;
      }
      if (linkedSplitShare) {
        try { await deletePublicShare.mutateAsync(linkedSplitShare.id); } catch { /* segue */ }
      }
      if (expense.trip_id && tripDeleteMode === "both") {
        const res = await deleteTripExpenseLinked.mutateAsync({ personalExpenseId: expense.id, deletePersonal: true });
        if (!res) {
          await deleteBaseExpense();
          queryClient?.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(expense.trip_id) });
        }
        pushToast({ title: "Despesa excluída do extrato e da viagem", variant: "success" });
      } else if (expense.trip_id && tripDeleteMode === "personal_only") {
        await deleteBaseExpense();
        queryClient?.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(expense.trip_id) });
        pushToast({ title: "Despesa excluída do extrato pessoal", description: "O lançamento foi mantido na viagem.", variant: "success" });
      } else if (isRecurring) {
        await deleteRecurrence.mutateAsync({ occurrenceId: expense.id, mode });
        pushToast({ title: mode === "single" ? "Ocorrência excluída com sucesso" : "Recorrências excluídas com sucesso", variant: "success" });
      } else {
        const deletedPayload = {
          value: expense.value, date: expense.date, categoryId: expense.category_id, description: expense.description || "",
          paymentMethod: expense.payment_method, cardId: expense.card_id ?? null, reportWeight: expense.report_weight ?? 1,
          isFamily: Boolean(expense.is_family),
          installments: [{ date: expense.date, value: expense.value, billCompetence: expense.bill_competence ?? null }],
        };
        await deleteExpense.mutateAsync({ expenseId: expense.id, mode });
        ["my-public-shares", "public-share", "public-shares", "debts", "expenses", "overview"].forEach((k) => queryClient?.invalidateQueries({ queryKey: [k] }));
        if (!isInstallment) {
          pushToast({
            title: isRachaExpense ? "Despesa e racha vinculado excluídos" : "Despesa excluída",
            variant: "default", duration: 7000,
            action: {
              label: "Desfazer",
              onClick: () => {
                triggerSensory("action");
                void createExpense.mutateAsync(deletedPayload);
                pushToast({ title: "Despesa restaurada com sucesso", variant: "success" });
              },
            },
          });
        } else {
          pushToast({
            title: isRachaExpense ? "Parcelas e racha vinculado excluídos com sucesso" : mode !== "single" ? "Parcelas excluídas com sucesso" : "Despesa excluída com sucesso",
            variant: "success",
          });
        }
      }
    } catch { /* Tratado no onError */ }
  };

  const handleSaveEdit = async (payload: ExpenseEditSavePayload) => {
    if (!expense) return;
    if (isInternalTransfer) {
      setError("Transferências pareadas entre PF e PJ não podem ser alteradas isoladamente. Para ajustar o valor ou a data, exclua o par e realize uma nova transferência.");
      return;
    }
    setError(null);
    const resolvedFamilyId = payload.is_family ? (myFamilyData?.family?.id ?? null) : null;
    if (isGrouped) {
      const fields: RecurrenceGroupFields = {
        description: payload.description, value: payload.value, category_id: payload.category_id,
        payment_method: payload.payment_method, card_id: payload.card_id, report_weight: payload.report_weight, is_family: payload.is_family,
        ...(editScope === "single" ? { bill_competence: payload.bill_competence } : {}),
      };
      if (isRecurring) await updateRecurrence.mutateAsync({ occurrenceId: expense.id, mode: editScope, fields: { ...fields, family_id: resolvedFamilyId } });
      else await updateExpenseGrouped.mutateAsync({ id: expense.id, mode: editScope, fields: { ...fields, family_id: resolvedFamilyId } });
    } else {
      await updateExpense.mutateAsync({
        id: expense.id,
        input: {
          description: payload.description,
          value: payload.value,
          base_amount: payload.value,
          date: payload.date,
          category_id: payload.category_id,
          payment_method: payload.payment_method,
          card_id: payload.card_id,
          bill_competence: payload.bill_competence,
          report_weight: payload.report_weight,
          is_family: payload.is_family,
          family_id: resolvedFamilyId,
          charge_kind: payload.charge_kind ?? expense.charge_kind ?? "regular",
          ...(isBusinessActive && payload.scope !== undefined
            ? {
                scope: payload.scope,
                is_tax_deductible: payload.scope === "business" ? Boolean(payload.is_tax_deductible) : false,
              }
            : {}),
        },
      });
    }
    if (linkedSplitShare) {
      const editedCents = Math.round(payload.value * 100);
      const nextTotalCents =
        isInstallment && groupExpenses.length > 1
          ? editScope === "single"
            ? groupExpenses
                .filter((item) => item.id !== expense.id)
                .reduce((acc, item) => acc + Math.round(Number(item.value) * 100), 0) + editedCents
            : groupTotalCents
          : editedCents;
      await syncSplitFromExpenseEdit.mutateAsync({
        share: linkedSplitShare,
        expense,
        nextTitle: payload.description,
        nextTotalCents,
        nextDate: payload.date,
        linkedDebt: linkedRachaDebt,
      });
    } else if (linkedRachaDebt) {
      const nextDebtName = `Racha: ${payload.description.trim() || "Despesa"}`;
      if (linkedRachaDebt.name !== nextDebtName) {
        try {
          await updateDebt.mutateAsync({ id: linkedRachaDebt.id, input: { name: nextDebtName } });
        } catch { /* segue */ }
      }
    }
    if (expense.trip_id) {
      const catName = categories.find((c) => c.id === payload.category_id)?.name;
      try { await updateTripExpenseLinked.mutateAsync({ personalExpenseId: expense.id, value: payload.value, description: payload.description, date: payload.date, categoryName: catName }); } catch { /* segue */ }
    }
    const familyChanged = isFamilyActive && payload.is_family !== undefined && payload.is_family !== expense.is_family;
    pushToast({
      title: linkedSplitShare
        ? "Despesa e racha sincronizados com sucesso"
        : expense.trip_id && !familyChanged
          ? "Despesa atualizada no extrato e na viagem"
          : "Despesa atualizada com sucesso",
      description: familyChanged
        ? payload.is_family ? "Esta despesa foi marcada como Familiar e agora pertence à visão Familiar." : "Esta despesa foi marcada como Individual e agora pertence à visão Pessoal."
        : expense.trip_id ? "Os valores e a divisão na viagem foram sincronizados." : undefined,
      variant: "success",
    });
    setIsEditing(false);
    if (payload.convertToSplit && !linkedSplitShare && !expense.trip_id) {
      onRequestOpenSplit?.({
        ...expense,
        description: payload.description || null,
        value: payload.value,
        base_amount: payload.value,
        date: payload.date,
        category_id: payload.category_id,
        payment_method: payload.payment_method,
        card_id: payload.card_id,
        bill_competence: payload.bill_competence,
        report_weight: payload.report_weight,
        is_family: Boolean(payload.is_family),
      });
      return;
    }
    onOpenChange(false);
  };

  const handleShare = async () => {
    if (!expense) return;
    const text = [
      `Despesa: ${expense.description || currentCategory?.name || "Despesa"}`,
      `Valor: ${formatCentsAsBRL(Math.round(expense.value * 100))}`,
      `Data: ${formatDateBR(expense.date)}`,
      `Categoria: ${currentCategory?.name ?? "Outra"}`,
      `Pagamento: ${PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}`,
    ].join("\n");
    const result = await shareText("Despesa — Axir", text);
    if (result === "copied") pushToast({ title: "Copiado para a área de transferência", variant: "default" });
    else if (result === "unsupported") pushToast({ title: "Compartilhamento não suportado neste navegador", variant: "default" });
  };

  const handleRepeat = async () => {
    if (!expense) return;
    setError(null);
    const card = cards.find((c) => c.id === expense.card_id);
    const date = todayISO();
    try {
      await createExpense.mutateAsync({
        value: expense.value, date, categoryId: expense.category_id, paymentMethod: expense.payment_method,
        cardId: expense.payment_method === "credit_card" ? expense.card_id : null,
        description: expense.description || null, reportWeight: expense.report_weight,
        installments: [{
          date, value: expense.value,
          billCompetence: expense.payment_method === "credit_card" ? resolveBillCompetence(new Date(`${date}T12:00:00`), card?.closing_day ?? 10) : null,
        }],
        debtAmount: null, debtDueDate: null,
      });
      onOpenChange(false);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  return {
    categories, cards, currentCategory, isFamilyActive, isBusinessActive, isInternalTransfer, tripName, priceEvolution, isRachaExpense,
    hasLinkedSplit, linkedSplitShare, linkedRachaDebt, groupExpenses, groupTotalCents,
    isInstallment, isRecurring, isGrouped, editPending, deletePending, repeatPending: createExpense.isPending,
    handleConfirmDelete, handleSaveEdit, handleShare, handleRepeat,
  };
}
