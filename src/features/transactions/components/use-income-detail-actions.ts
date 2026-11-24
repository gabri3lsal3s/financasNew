import { todayISO } from "@/domain/debts";
import { formatDateBR } from "@/lib/date";
import { RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { getErrorMessage } from "@/services/errors";
import { shareText } from "@/services/export-actions";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCategories,
  useCreateIncome,
  useDeleteIncome,
  useDeleteIncomeGrouped,
  useDeleteRecurrenceOccurrences,
  useFamilyMode,
  useMyFamily,
  useUpdateIncome,
  useUpdateIncomeGrouped,
  useUpdateRecurrenceOccurrences,
} from "@/state";
import { useSafeBusinessMode, useSafeDeleteInternalTransferPair } from "@/hooks/use-safe-business-scope";
import type { DbInsert, Income, InstallmentDeleteMode, RecurrenceGroupFields } from "@/types";
import type { IncomeEditSavePayload } from "./income-edit-form";

export interface UseIncomeDetailActionsParams {
  income: Income | null;
  onOpenChange: (open: boolean) => void;
  mode: InstallmentDeleteMode;
  editScope: InstallmentDeleteMode;
  setError: (err: string | null) => void;
  setConfirmOpen: (open: boolean) => void;
  setIsEditing: (editing: boolean) => void;
}

export function useIncomeDetailActions({
  income,
  onOpenChange,
  mode,
  editScope,
  setError,
  setConfirmOpen,
  setIsEditing,
}: UseIncomeDetailActionsParams) {
  const categories = useCategories("income").data ?? [];
  const { isFamilyModeEnabled } = useFamilyMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const { isBusinessModeEnabled: isBusinessActive } = useSafeBusinessMode();
  const { data: myFamilyData } = useMyFamily();

  const deleteIncome = useDeleteIncome();
  const deleteIncomeGrouped = useDeleteIncomeGrouped();
  const deleteTransferPair = useSafeDeleteInternalTransferPair();
  const deleteRecurrence = useDeleteRecurrenceOccurrences();
  const updateIncome = useUpdateIncome();
  const updateIncomeGrouped = useUpdateIncomeGrouped();
  const updateRecurrence = useUpdateRecurrenceOccurrences();
  const createIncome = useCreateIncome();

  const currentCategory = categories.find((c) => c.id === income?.category_id);
  const isInternalTransfer = Boolean(income?.is_internal_transfer && income?.transfer_pair_id);
  const isReadOnly = income?.source_ref != null || isInternalTransfer;
  const isInstallment = income != null && (income.installments_total ?? 1) > 1;
  const isRecurring = income?.recurrence_id != null;
  const isGrouped = isInstallment || isRecurring;
  const editPending = updateIncome.isPending || updateIncomeGrouped.isPending || updateRecurrence.isPending;
  const deletePending =
    deleteIncome.isPending ||
    deleteIncomeGrouped.isPending ||
    deleteTransferPair.isPending ||
    deleteRecurrence.isPending;

  const handleConfirmDelete = async () => {
    if (!income) return;
    setError(null);
    setConfirmOpen(false);
    onOpenChange(false);
    try {
      if (isInternalTransfer && income.transfer_pair_id) {
        await deleteTransferPair.mutateAsync(income.transfer_pair_id);
        pushToast({
          title: "Transferência pareada removida das duas esferas (PF e PJ)",
          variant: "success",
        });
      } else if (isRecurring) {
        await deleteRecurrence.mutateAsync({ occurrenceId: income.id, mode });
        pushToast({ title: mode === "single" ? "Ocorrência excluída com sucesso" : "Recorrências excluídas com sucesso", variant: "success" });
      } else if (isGrouped) {
        await deleteIncomeGrouped.mutateAsync({ id: income.id, mode });
        pushToast({ title: mode !== "single" ? "Parcelas excluídas com sucesso" : "Receita excluída com sucesso", variant: "success" });
      } else {
        const deletedPayload = {
          value: income.value,
          date: income.date,
          category_id: income.category_id,
          description: income.description || "",
          receive_type: income.receive_type,
          report_weight: income.report_weight ?? 1,
          is_family: Boolean(income.is_family),
          family_id: income.is_family ? (income.family_id ?? myFamilyData?.family?.id ?? null) : null,
          source_ref: income.source_ref ?? null,
        };
        await deleteIncome.mutateAsync(income.id);
        pushToast({
          title: "Receita excluída",
          variant: "default",
          duration: 7000,
          action: {
            label: "Desfazer",
            onClick: () => {
              triggerSensory("action");
              void createIncome.mutateAsync(deletedPayload);
              pushToast({ title: "Receita restaurada com sucesso", variant: "success" });
            },
          },
        });
      }
    } catch { /* Tratado no onError da mutation */ }
  };

  const handleSaveEdit = async (payload: IncomeEditSavePayload) => {
    if (!income) return;
    if (isInternalTransfer) {
      setError("Transferências pareadas entre PF e PJ não podem ser alteradas isoladamente. Para ajustar o valor ou a data, exclua o par e realize uma nova transferência.");
      return;
    }
    setError(null);
    const resolvedFamilyId = payload.is_family ? (myFamilyData?.family?.id ?? income.family_id ?? null) : null;
    if (isGrouped) {
      const fields: RecurrenceGroupFields = {
        description: payload.description,
        value: payload.value,
        category_id: payload.category_id,
        receive_type: payload.receive_type,
        report_weight: payload.report_weight,
        is_family: payload.is_family,
      };
      if (isRecurring) {
        await updateRecurrence.mutateAsync({ occurrenceId: income.id, mode: editScope, fields: { ...fields, family_id: resolvedFamilyId } });
      } else {
        await updateIncomeGrouped.mutateAsync({ id: income.id, mode: editScope, fields: { ...fields, family_id: resolvedFamilyId } });
      }
    } else {
      await updateIncome.mutateAsync({
        id: income.id,
        input: {
          ...payload,
          family_id: resolvedFamilyId,
          ...(isBusinessActive && payload.scope !== undefined ? { scope: payload.scope } : {}),
        },
      });
    }

    const familyChanged = isFamilyActive && payload.is_family !== undefined && payload.is_family !== income.is_family;
    pushToast({
      title: "Receita atualizada com sucesso",
      description: familyChanged
        ? payload.is_family
          ? "Esta receita foi marcada como Familiar e agora pertence à visão Familiar."
          : "Esta receita foi marcada como Individual e agora pertence à visão Pessoal."
        : undefined,
      variant: "success",
    });
    setIsEditing(false);
    onOpenChange(false);
  };

  const handleShare = async () => {
    if (!income) return;
    const text = [
      `Receita: ${income.description || currentCategory?.name || "Receita"}`,
      `Valor: ${formatCentsAsBRL(Math.round(income.value * 100))}`,
      `Data: ${formatDateBR(income.date)}`,
      `Categoria: ${currentCategory?.name ?? "Outra"}`,
      `Recebimento: ${RECEIVE_TYPE_LABELS[income.receive_type] ?? income.receive_type}`,
    ].join("\n");
    const result = await shareText("Receita — Axir", text);
    if (result === "copied") pushToast({ title: "Copiado para a área de transferência", variant: "default" });
    else if (result === "unsupported") pushToast({ title: "Compartilhamento não suportado neste navegador", variant: "default" });
  };

  const handleRepeat = async () => {
    if (!income) return;
    setError(null);
    const date = todayISO();
    try {
      const input = {
        value: income.value,
        date,
        category_id: income.category_id,
        receive_type: income.receive_type,
        description: income.description || null,
        report_weight: income.report_weight,
        is_family: Boolean(income.is_family),
        family_id: income.is_family ? (myFamilyData?.family?.id ?? income.family_id ?? null) : null,
        source_ref: null,
      } satisfies Omit<DbInsert<Income>, "user_id">;
      await createIncome.mutateAsync(input);
      onOpenChange(false);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  return {
    categories, currentCategory, isFamilyActive, isBusinessActive, isInternalTransfer, isReadOnly, isInstallment, isRecurring, isGrouped,
    editPending, deletePending, repeatPending: createIncome.isPending,
    handleConfirmDelete, handleSaveEdit, handleShare, handleRepeat,
  };
}
