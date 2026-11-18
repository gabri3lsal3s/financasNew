import { useState } from "react";
import { extractLastFourDigits } from "@/domain/notifications";
import { getErrorMessage } from "@/services/errors";
import { recordTransactionLearning } from "@/services/merchant-learning";
import { storeMerchantCategory } from "@/services/native";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCreateExpense,
  useCreateIncome,
  useCreateIncomeInstallments,
  useCreateRecurrence,
  useUpdateCustomSettings,
} from "@/state";
import { useLinkPersonalExpenseToTripMutation } from "@/state/queries/use-trips";
import type { Category, CreditCard, DbInsert, Income, Trip, TripMember } from "@/types";
import {
  buildExpenseInstallments,
  buildIncomeInstallments,
  defaultLaunchState,
  effectiveReportWeight,
  recurrenceRuleFromLaunchState,
} from "./wizard-state";
import type { CreatedSplitExpense, EntryType, LaunchState, ReceiptMeta } from "./wizard-types";

export interface UseLaunchWizardSubmitParams {
  state: LaunchState;
  setState: (next: LaunchState) => void;
  initialType: EntryType;
  initialValues?: Partial<LaunchState>;
  isReadOnlyMode: boolean;
  guardAction: (fn: () => void, label: string) => void;
  isFamilyActive: boolean;
  categories: Category[] | undefined;
  selectedCard: CreditCard | undefined;
  currentUserId: string | undefined;
  currentTrip: Trip | undefined;
  tripMembers: TripMember[];
  receiptMeta: ReceiptMeta | null;
  setReceiptMeta: (meta: ReceiptMeta | null) => void;
  setCreatedSplitExpense: (data: CreatedSplitExpense | null) => void;
  onSuccess?: () => void;
  onOpenChange?: (open: boolean) => void;
  onFallbackBack: () => void;
}

function buildExpensePayload(state: LaunchState, closingDay: number | null) {
  const isPerInstallment = state.splitEnabled && state.installments > 1 && state.splitDebtMode === "per_installment";
  return {
    value: state.valueCents / 100,
    date: state.date,
    categoryId: state.categoryId,
    paymentMethod: state.paymentMethod,
    cardId: state.paymentMethod === "credit_card" ? state.cardId : null,
    description: state.description || null,
    reportWeight: effectiveReportWeight(state),
    installments: buildExpenseInstallments({
      totalCents: state.valueCents, count: state.installments, startDate: state.date,
      closingDay: state.paymentMethod === "credit_card" ? closingDay : null,
    }),
    debtName: state.debtEnabled && state.splitEnabled ? `Racha: ${state.description || "Despesa"}` : null,
    debtAmount: state.debtEnabled
      ? (isPerInstallment ? Math.round(state.debtAmountCents / state.installments) : state.debtAmountCents) / 100
      : null,
    debtDueDate: state.debtEnabled && state.debtDueDate ? state.debtDueDate : null,
    debtType: state.debtEnabled ? state.debtType : null,
    isFamily: state.isFamily,
    debtInstallmentMode: state.debtEnabled
      ? state.installments > 1 && state.splitEnabled ? state.splitDebtMode : ("single_total" as const)
      : null,
  };
}

export function useLaunchWizardSubmit(params: UseLaunchWizardSubmitParams) {
  const {
    state, setState, initialType, initialValues, isReadOnlyMode, guardAction, isFamilyActive,
    categories, selectedCard, currentUserId, currentTrip, tripMembers, receiptMeta,
    setReceiptMeta, setCreatedSplitExpense, onSuccess, onOpenChange, onFallbackBack,
  } = params;

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const createExpense = useCreateExpense();
  const createIncome = useCreateIncome();
  const createIncomeInstallments = useCreateIncomeInstallments();
  const createRecurrence = useCreateRecurrence();
  const linkPersonalExpenseToTrip = useLinkPersonalExpenseToTripMutation();
  const updateCustomSettings = useUpdateCustomSettings();

  const submit = async () => {
    if (isReadOnlyMode) { guardAction(() => {}, "Criar Lançamento"); return; }
    setError(null);
    setPending(true);
    let createdExpenseId: string | null = null;

    try {
      const selectedCategory = categories?.find((c) => c.id === state.categoryId);
      if (state.recurring) {
        const rule = recurrenceRuleFromLaunchState(state);
        if (!rule) throw new Error("Defina o fim da recorrência (data ou número de ocorrências).");
        await createRecurrence.mutateAsync({
          kind: rule.kind, frequency: rule.frequency, value: rule.valueCents / 100, categoryId: state.categoryId,
          startDate: rule.startDate, endDate: rule.endDate, occurrencesTotal: rule.occurrencesTotal,
          paymentMethod: state.type === "expense" ? state.paymentMethod : null,
          cardId: state.type === "expense" && state.paymentMethod === "credit_card" ? state.cardId : null,
          receiveType: state.type === "income" ? state.receiveType : null,
          description: state.description || null, reportWeight: effectiveReportWeight(state), isFamily: state.isFamily,
        });
      } else if (state.type === "expense") {
        createdExpenseId = await createExpense.mutateAsync(buildExpensePayload(state, selectedCard?.closing_day ?? null));
        if (state.tripId && createdExpenseId) {
          try {
            await linkPersonalExpenseToTrip.mutateAsync({
              personalExpenseId: createdExpenseId,
              tripId: state.tripId,
              tripExpense: {
                amountCents: state.valueCents, description: state.description || "Despesa da viagem",
                categoryName: selectedCategory?.name ?? "Geral", expenseDate: state.date,
                currentUserId, hostUserId: currentTrip?.host_user_id, members: tripMembers,
              },
            });
            if (state.categoryId) {
              void updateCustomSettings.mutateAsync({ preferredTripCategoryId: state.categoryId }).catch(() => {});
            }
          } catch { /* Mantém lançamento pessoal principal */ }
        }
      } else if (state.installments > 1) {
        await createIncomeInstallments.mutateAsync({
          value: state.valueCents / 100, date: state.date, categoryId: state.categoryId, receiveType: state.receiveType,
          description: state.description || null, reportWeight: effectiveReportWeight(state),
          installments: buildIncomeInstallments({ totalCents: state.valueCents, count: state.installments, startDate: state.date }),
          isFamily: state.isFamily,
        });
      } else {
        const input = {
          value: state.valueCents / 100, date: state.date, category_id: state.categoryId, receive_type: state.receiveType,
          description: state.description || null, report_weight: effectiveReportWeight(state), source_ref: null, is_family: state.isFamily,
        } satisfies Omit<DbInsert<Income>, "user_id">;
        await createIncome.mutateAsync(input);
      }

      if (state.description && state.categoryId) {
        storeMerchantCategory(state.description, state.categoryId);
        recordTransactionLearning({
          merchant: receiptMeta?.merchant || state.description, categoryId: state.categoryId,
          paymentMethod: state.type === "expense" ? state.paymentMethod : "pix",
          cardId: state.type === "expense" && state.paymentMethod === "credit_card" && state.cardId ? state.cardId : undefined,
          cardLastDigits: receiptMeta?.cardLastDigits || extractLastFourDigits(initialValues?.cardId) || extractLastFourDigits(state.cardId),
          taxId: receiptMeta?.taxId, packageName: receiptMeta?.packageName, pixKey: receiptMeta?.pixKey, nature: state.type,
        });
      }

      triggerSensory("success");
      const splitData: CreatedSplitExpense | null = state.type === "expense" && state.splitEnabled && !state.tripId
        ? {
            id: typeof createdExpenseId === "string" ? createdExpenseId : "",
            value: state.valueCents / 100, description: state.description || null, date: state.date,
            peopleCount: state.splitPeopleCount,
            installmentsCount: state.splitDebtMode === "per_installment" && state.installments > 1 ? state.installments : 1,
            categoryId: state.categoryId, categoryName: selectedCategory?.name, categoryIcon: selectedCategory?.icon ?? undefined,
          }
        : null;

      setState(defaultLaunchState(initialType));
      setReceiptMeta(null);
      setPending(false);

      if (splitData) { setCreatedSplitExpense(splitData); return; }
      pushToast({
        title: state.type === "expense" ? "Despesa registrada" : "Receita registrada",
        description: isFamilyActive && state.isFamily ? "Lançamento adicionado à visão Familiar." : undefined,
        variant: "success",
      });
      onSuccess?.();
      onOpenChange?.(false);
      if (!onSuccess && !onOpenChange) onFallbackBack();
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
      setPending(false);
    }
  };

  return { submit, pending, error, setError };
}
