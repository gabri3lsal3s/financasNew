import { useState } from "react";
import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Stepper } from "@/components/ui/stepper";
import { getErrorMessage } from "@/services/errors";
import { buildDescriptionSuggestions, buildHabitualEntries, dayOfMonth } from "@/domain/predictions";
import { todayISO } from "@/domain/debts";
import {
  useActiveCreditCards,
  useCategories,
  useCreateExpense,
  useCreateIncome,
  useCreateIncomeInstallments,
  useCreateRecurrence,
  usePredictionHistory,
} from "@/state";
import type { RecurrenceFrequency } from "@/domain/recurrences";
import type { DbInsert, Income, PaymentMethod, ReceiveType } from "@/types";
import { StepCategory } from "./step-category";
import { StepDetails } from "./step-details";
import { StepReview } from "./step-review";
import { StepValue } from "./step-value";
import {
  buildExpenseInstallments,
  buildIncomeInstallments,
  canProceed,
  defaultLaunchState,
  effectiveReportWeight,
  isPresetWeight,
  recurrenceRuleFromLaunchState,
  WIZARD_STEPS,
} from "./wizard-state";
import type { EntryType, LaunchState } from "./wizard-state";

export interface LaunchWizardProps {
  /** Controla a exibição em modal/overlay (padrão true). */
  open?: boolean;
  /** Notificação de alteração de abertura. */
  onOpenChange?: (open: boolean) => void;
  /** Callback executado ao fechar/cancelar. */
  onClose?: () => void;
  /** Callback executado após a criação bem-sucedida. */
  onSuccess?: () => void;
}

/** Wizard de lançamento guiado (D10) — modal contextual de 4 passos com preservação de rota. */
export function LaunchWizard({
  open = true,
  onOpenChange,
  onClose,
  onSuccess,
}: LaunchWizardProps = {}) {
  const navigate = useNavigate();
  const [state, setState] = useState<LaunchState>(defaultLaunchState);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // Dados preenchidos no fluxo (valor/categoria/descrição) — fechar com o
  // formulário em andamento pede confirmação (anti-perda acidental).
  const isDirty = state.valueCents > 0 || state.categoryId !== "" || state.description.trim() !== "";

  const handleClose = () => {
    setState(defaultLaunchState);
    setError(null);
    setPending(false);
    onClose?.();
    onOpenChange?.(false);
    if (!onClose && !onOpenChange) {
      navigate(-1);
    }
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmClose(true);
    } else {
      handleClose();
    }
  };

  const categoriesQuery = useCategories(state.type);
  const cardsQuery = useActiveCreditCards();
  const createExpense = useCreateExpense();
  const createIncome = useCreateIncome();
  const createIncomeInstallments = useCreateIncomeInstallments();
  const createRecurrence = useCreateRecurrence();

  // F21 — histórico preditivo: ativo apenas nos passos de entrada (1 e 3),
  // zero custo nos demais (Online First — sugestões 100% locais).
  const predictionActive = state.step === 1 || state.step === 3;
  const prediction = usePredictionHistory(predictionActive);
  const today = todayISO();
  const selectedCategory = categoriesQuery.data?.find((category) => category.id === state.categoryId);
  // Etapa 1 — habituais: limite estrito de 3 + ranqueamento temporal contextual 5D
  // (dia do mês × dia da semana × horário do dia × frequência × recência) +
  // supressão de contas mensais periódicas já cumpridas no mês (targetMonth).
  const habits = buildHabitualEntries(prediction.entries, state.type, {
    limit: 3,
    referenceDay: dayOfMonth(state.date),
    todayISO: today,
    targetMonth: state.date.slice(0, 7),
    referenceDate: state.date,
    currentHour: new Date().getHours(),
  });
  // Etapa 2 — sugestões de descrição pura: clique preenche SÓ a descrição
  // (nunca sobrescreve valor/data/forma) e exclui rótulos que sejam apenas o
  // nome da categoria selecionada (hotfix).
  const descriptionSuggestions = buildDescriptionSuggestions(prediction.entries, state.type, {
    limit: 3,
    categoryName: selectedCategory?.name ?? null,
    query: state.description,
    todayISO: today,
  });

  const set = <K extends keyof LaunchState>(key: K, value: LaunchState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const goTo = (step: number) => {
    setError(null);
    setState((prev) => ({ ...prev, step }));
  };

  const selectedCard = state.paymentMethod === "credit_card"
    ? cardsQuery.data?.find((card) => card.id === state.cardId)
    : undefined;

  const handleSubmit = async () => {
    setError(null);
    setPending(true);
    try {
      if (state.recurring) {
        const rule = recurrenceRuleFromLaunchState(state);
        if (!rule) {
          throw new Error("Defina o fim da recorrência (data ou número de ocorrências).");
        }
        await createRecurrence.mutateAsync({
          kind: rule.kind,
          frequency: rule.frequency,
          value: rule.valueCents / 100,
          categoryId: state.categoryId,
          startDate: rule.startDate,
          endDate: rule.endDate,
          occurrencesTotal: rule.occurrencesTotal,
          paymentMethod: state.type === "expense" ? state.paymentMethod : null,
          cardId: state.type === "expense" && state.paymentMethod === "credit_card" ? state.cardId : null,
          receiveType: state.type === "income" ? state.receiveType : null,
          description: state.description || null,
          reportWeight: effectiveReportWeight(state),
        });
      } else if (state.type === "expense") {
        await createExpense.mutateAsync({
          value: state.valueCents / 100,
          date: state.date,
          categoryId: state.categoryId,
          paymentMethod: state.paymentMethod,
          cardId: state.paymentMethod === "credit_card" ? state.cardId : null,
          description: state.description || null,
          reportWeight: effectiveReportWeight(state),
          installments: buildExpenseInstallments({
            totalCents: state.valueCents,
            count: state.installments,
            startDate: state.date,
            closingDay: state.paymentMethod === "credit_card" ? (selectedCard?.closing_day ?? null) : null,
          }),
          debtAmount: state.debtEnabled ? state.debtAmountCents / 100 : null,
          debtDueDate: state.debtEnabled && state.debtDueDate ? state.debtDueDate : null,
          debtType: state.debtEnabled ? state.debtType : null,
        });
      } else if (state.installments > 1) {
        await createIncomeInstallments.mutateAsync({
          value: state.valueCents / 100,
          date: state.date,
          categoryId: state.categoryId,
          receiveType: state.receiveType,
          description: state.description || null,
          reportWeight: effectiveReportWeight(state),
          installments: buildIncomeInstallments({
            totalCents: state.valueCents,
            count: state.installments,
            startDate: state.date,
          }),
        });
      } else {
        const input = {
          value: state.valueCents / 100,
          date: state.date,
          category_id: state.categoryId,
          receive_type: state.receiveType,
          description: state.description || null,
          report_weight: effectiveReportWeight(state),
          source_ref: null,
        } satisfies Omit<DbInsert<Income>, "user_id">;
        await createIncome.mutateAsync(input);
      }

      setState(defaultLaunchState);
      setPending(false);
      onSuccess?.();
      onOpenChange?.(false);
      if (!onSuccess && !onOpenChange) {
        navigate(-1);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setPending(false);
    }
  };

  const isLastStep = state.step === WIZARD_STEPS.length;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          requestClose();
        }
      }}
      title="Novo lançamento"
      size="lg"
      showCalculator
    >
      <div className="flex flex-col gap-6 pt-2">
        <Stepper steps={[...WIZARD_STEPS]} current={state.step} />

        {error ? <Alert variant="error">{error}</Alert> : null}

        {state.step === 1 ? (
          <StepValue
            state={state}
            onTypeChange={(type: EntryType) => {
              set("type", type);
              set("categoryId", "");
              set("cardId", null);
              set("debtEnabled", false);
              set("debtType", "payable");
              set("recurring", false);
              set("recurrenceEndDate", "");
            }}
            onValueChange={(cents) => set("valueCents", cents)}
            onInstallmentsChange={(count) => set("installments", count)}
            onApplyHabitual={(habit) => {
              set("valueCents", Math.round(habit.value * 100));
              set("categoryId", habit.categoryId);
              set("description", habit.description);
              if (habit.paymentMethod) {
                set("paymentMethod", habit.paymentMethod as PaymentMethod);
                set("cardId", habit.cardId);
              } else if (habit.receiveType) {
                set("receiveType", habit.receiveType as ReceiveType);
              }
            }}
            habits={habits}
          />
        ) : null}

        {state.step === 2 ? (
          <StepCategory
            categories={categoriesQuery.data}
            isLoading={categoriesQuery.isLoading}
            isError={categoriesQuery.isError}
            error={categoriesQuery.error}
            selectedId={state.categoryId}
            onSelect={(categoryId) => set("categoryId", categoryId)}
          />
        ) : null}

        {state.step === 3 ? (
          <StepDetails
            state={state}
            onDateChange={(date) => set("date", date)}
            onPaymentMethodChange={(method: PaymentMethod) => {
              set("paymentMethod", method);
              if (method !== "credit_card") set("cardId", null);
            }}
            onCardChange={(cardId) => set("cardId", cardId)}
            onReceiveTypeChange={(receiveType: ReceiveType) => set("receiveType", receiveType)}
            onDescriptionChange={(description) => set("description", description)}
            descriptionSuggestions={descriptionSuggestions}
            onReportWeightChange={(weight) => {
              set("reportWeight", weight);
              if (!isPresetWeight(weight) && state.reportCustomAmountCents === 0) {
                set("reportCustomAmountCents", state.valueCents);
              }
            }}
            onReportCustomAmountChange={(cents) => set("reportCustomAmountCents", cents)}
            onDebtToggle={(enabled) => set("debtEnabled", enabled)}
            onDebtTypeChange={(debtType) => set("debtType", debtType)}
            onDebtAmountChange={(cents) => set("debtAmountCents", cents)}
            onDebtDueDateChange={(date) => set("debtDueDate", date)}
            onRecurringToggle={(enabled) => {
              set("recurring", enabled);
              // Parcelamento e recorrência são mutuamente exclusivos.
              if (enabled) set("installments", 1);
            }}
            onRecurrenceFrequencyChange={(frequency: RecurrenceFrequency) => set("recurrenceFrequency", frequency)}
            onRecurrenceEndModeChange={(mode: "date" | "count") => set("recurrenceEndMode", mode)}
            onRecurrenceEndDateChange={(date) => set("recurrenceEndDate", date)}
            onRecurrenceCountChange={(count) => set("recurrenceCount", count)}
            cards={cardsQuery.data}
            cardsLoading={cardsQuery.isLoading}
            cardsError={cardsQuery.error}
          />
        ) : null}

        {state.step === 4 ? (
          <StepReview
            state={state}
            categoryName={selectedCategory?.name}
            closingDay={selectedCard?.closing_day}
          />
        ) : null}

        <ConfirmDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          title="Descartar lançamento?"
          description="Você preencheu dados deste lançamento. Ao sair, as informações digitadas serão perdidas."
          confirmLabel="Descartar"
          cancelLabel="Continuar preenchendo"
          variant="destructive"
          onConfirm={() => {
            setConfirmClose(false);
            handleClose();
          }}
        />

        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" disabled={state.step === 1 || pending} onClick={() => goTo(state.step - 1)}>
            Voltar
          </Button>
          {isLastStep ? (
            <Button type="button" disabled={!canProceed(state) || pending} onClick={() => void handleSubmit()}>
              {pending ? "Confirmando…" : "Confirmar lançamento"}
            </Button>
          ) : (
            <Button type="button" disabled={!canProceed(state)} onClick={() => goTo(state.step + 1)}>
              Continuar
            </Button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
