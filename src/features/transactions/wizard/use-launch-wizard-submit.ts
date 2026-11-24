import { useState } from "react";
import { splitMixedExpenseByPercent } from "@/domain/business";
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
import type { Category, CreditCard, DbInsert, Income, TransactionScope, Trip, TripMember } from "@/types";
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
  isBusinessActive?: boolean;
  defaultScope?: TransactionScope;
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
    chargeKind: state.paymentMethod === "credit_card" ? (state.chargeKind ?? "regular") : "regular",
    ...((state.scope ?? "personal") !== "personal" ? { scope: state.scope } : {}),
    ...((state.scope ?? "personal") === "business" && state.isTaxDeductible ? { isTaxDeductible: true } : {}),
  };
}

export function useLaunchWizardSubmit(params: UseLaunchWizardSubmitParams) {
  const {
    state, setState, initialType, initialValues, isReadOnlyMode, guardAction, isFamilyActive,
    isBusinessActive = false, defaultScope = "personal",
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
      const launchScope = state.scope ?? "personal";
      const submittedAsBusiness = isBusinessActive && launchScope === "business";
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
          ...(launchScope !== "personal" ? { scope: launchScope } : {}),
          ...(state.type === "expense" && state.paymentMethod === "credit_card" && (state.chargeKind ?? "regular") !== "regular"
            ? { chargeKind: state.chargeKind }
            : {}),
          ...(state.type === "expense" && launchScope === "business" && state.isTaxDeductible
            ? { isTaxDeductible: true }
            : {}),
        });
      } else if (state.type === "expense") {
        if (state.splitPFPJEnabled) {
          const splitResult = splitMixedExpenseByPercent({
            totalCents: state.valueCents,
            businessPercent: state.splitPFPJBusinessPercent ?? 50,
          });

          // 1. Lançamento da perna pessoal (PF)
          await createExpense.mutateAsync(
            buildExpensePayload(
              {
                ...state,
                valueCents: splitResult.personalCents,
                scope: "personal",
                reportWeight: 1,
                description: state.description
                  ? `${state.description} (Parcela Pessoal)`
                  : "Despesa mista (Parcela Pessoal)",
              },
              selectedCard?.closing_day ?? null,
            ),
          );

          // 2. Lançamento da perna negócio (PJ)
          await createExpense.mutateAsync(
            buildExpensePayload(
              {
                ...state,
                valueCents: splitResult.businessCents,
                scope: "business",
                reportWeight: 1,
                isTaxDeductible: state.isTaxDeductible,
                description: state.description
                  ? `${state.description} (Parcela Negócio)`
                  : "Despesa mista (Parcela Negócio)",
              },
              selectedCard?.closing_day ?? null,
            ),
          );

          triggerSensory("success");
          pushToast({
            title: "Despesa mista dividida entre PF e PJ com sucesso",
            description: `Registrados R$ ${(splitResult.personalCents / 100).toFixed(2).replace(".", ",")} no Pessoal e R$ ${(splitResult.businessCents / 100).toFixed(2).replace(".", ",")} no Negócio.`,
            variant: "success",
          });
          onSuccess?.();
          onOpenChange?.(false);
          setState(defaultLaunchState(initialType, defaultScope === "business" ? { scope: "business" } : undefined));
          return;
        }

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
          taxWithheld: state.taxWithheldCents ? state.taxWithheldCents / 100 : undefined,
          ...(launchScope !== "personal" ? { scope: launchScope } : {}),
        });
      } else {
        const input = {
          value: state.valueCents / 100, date: state.date, category_id: state.categoryId, receive_type: state.receiveType,
          description: state.description || null, report_weight: effectiveReportWeight(state), source_ref: null, is_family: state.isFamily,
          tax_withheld: state.taxWithheldCents ? state.taxWithheldCents / 100 : undefined,
          ...(launchScope !== "personal" ? { scope: launchScope } : {}),
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
          reportWeight: state.type === "expense" ? effectiveReportWeight(state) : undefined,
          isFamily: state.isFamily,
          semanticTags: receiptMeta?.semanticTags,
        });
      }

      triggerSensory("success");
      const splitData: CreatedSplitExpense | null = state.type === "expense" && state.splitEnabled && !state.tripId
        ? {
            id: typeof createdExpenseId === "string" ? createdExpenseId : "",
            value: state.valueCents / 100, description: state.description || null, date: state.date,
            peopleCount: state.splitPeopleCount,
            installmentsCount: state.installments > 1 ? state.installments : 1,
            installmentsMode: state.installments > 1 ? state.splitDebtMode : "single_total",
            categoryId: state.categoryId, categoryName: selectedCategory?.name, categoryIcon: selectedCategory?.icon ?? undefined,
          }
        : null;

      setState(defaultLaunchState(initialType, defaultScope === "business" ? { scope: "business" } : undefined));
      setReceiptMeta(null);
      setPending(false);

      if (splitData) { setCreatedSplitExpense(splitData); return; }
      pushToast({
        title: state.type === "expense" ? "Despesa registrada" : "Receita registrada",
        description: submittedAsBusiness
          ? "Lançamento adicionado ao Meu Negócio (PJ)."
          : isFamilyActive && state.isFamily
            ? "Lançamento adicionado à visão Familiar."
            : undefined,
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
