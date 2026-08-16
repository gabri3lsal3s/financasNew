import { useState } from "react";
import { useNavigate } from "react-router";
import { X } from "lucide-react";
import { CalculatorButton } from "@/components/layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { getErrorMessage } from "@/services/errors";
import { buildDescriptionSuggestions, buildHabitualEntries, dayOfMonth } from "@/domain/predictions";
import { todayISO } from "@/domain/debts";
import { useActiveCreditCards, useCategories, useCreateExpense, useCreateIncome, usePredictionHistory } from "@/state";
import type { DbInsert, Income, PaymentMethod, ReceiveType } from "@/types";
import { StepCategory } from "./step-category";
import { StepDetails } from "./step-details";
import { StepReview } from "./step-review";
import { StepValue } from "./step-value";
import {
  buildExpenseInstallments,
  canProceed,
  defaultLaunchState,
  effectiveReportWeight,
  isPresetWeight,
  WIZARD_STEPS,
} from "./wizard-state";
import type { EntryType, LaunchState } from "./wizard-state";

/** Wizard de lançamento em tela cheia (D10) — 4 passos navegáveis. */
export function LaunchWizard() {
  const navigate = useNavigate();
  const [state, setState] = useState<LaunchState>(defaultLaunchState);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const categoriesQuery = useCategories(state.type);
  const cardsQuery = useActiveCreditCards();
  const createExpense = useCreateExpense();
  const createIncome = useCreateIncome();

  // F21 — histórico preditivo: ativo apenas nos passos de entrada (1 e 3),
  // zero custo nos demais (Online First — sugestões 100% locais).
  const predictionActive = state.step === 1 || state.step === 3;
  const prediction = usePredictionHistory(predictionActive);
  const today = todayISO();
  const selectedCategory = categoriesQuery.data?.find((category) => category.id === state.categoryId);
  // Etapa 1 — habituais: limite estrito de 3 + ranqueamento temporal (janela
  // de ±5–±10 dias do mês da transação) × frequência × recência (hotfix).
  const habits = buildHabitualEntries(prediction.entries, state.type, {
    limit: 3,
    referenceDay: dayOfMonth(state.date),
    todayISO: today,
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
      if (state.type === "expense") {
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
      navigate("/transacoes", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setPending(false);
    }
  };

  const isLastStep = state.step === WIZARD_STEPS.length;

  return (
    // Mobile (D10): fluxo em tela cheia, alinhado ao topo, sem bordas.
    // Desktop: painel centralizado (vertical e horizontal) com tratamento de modal.
    <div className="flex min-h-dvh w-full items-start justify-center p-4 md:items-center md:bg-muted/30 md:p-6">
      <div className="flex w-full max-w-lg flex-col gap-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:rounded-2xl md:border md:border-border md:bg-surface md:p-6 md:shadow-lg">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Novo lançamento</h1>
          <div className="flex shrink-0 items-center gap-1">
            {/* Mesmo padrão dos modais (F10): calculadora acessível no wizard, que fica fora do PageShell. */}
            <CalculatorButton />
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={() => navigate("/transacoes")}>
              <X aria-hidden="true" />
            </Button>
          </div>
        </header>

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
          onDebtAmountChange={(cents) => set("debtAmountCents", cents)}
          onDebtDueDateChange={(date) => set("debtDueDate", date)}
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

      <footer className="mt-auto flex items-center justify-between gap-2 pt-4">
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
    </div>
  );
}
