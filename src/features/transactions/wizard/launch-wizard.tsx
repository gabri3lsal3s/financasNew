import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ClipboardPaste } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Stepper } from "@/components/ui/stepper";
import { PasteReceiptDialog } from "@/components/modules/paste-receipt-dialog";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { buildDescriptionSuggestions, buildHabitualEntries, dayOfMonth } from "@/domain/predictions";
import { todayISO } from "@/domain/debts";
import {
  inferCategoryKeyword,
  lookupMerchantCategory,
  matchCategoryBySlug,
  type CanonicalCategorySlug,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import {
  getBankAssistantPreferences,
  storeMerchantCategory,
  useMerchantCategoryMapping,
} from "@/services/native";

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
  /** Tipo de entrada inicial (despesa ou receita). */
  initialType?: EntryType;
  /** Valores iniciais pré-preenchidos (ex.: atalhos, sugestões nativas). */
  initialValues?: Partial<LaunchState>;
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
  initialType = "expense",
  initialValues,
  onOpenChange,
  onClose,
  onSuccess,
}: LaunchWizardProps = {}) {
  const navigate = useNavigate();
  const [state, setState] = useState<LaunchState>(() => defaultLaunchState(initialType, initialValues));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const merchantMemory = useMerchantCategoryMapping();

  // Dados preenchidos no fluxo (valor/categoria/descrição) — fechar com o

  // formulário em andamento pede confirmação (anti-perda acidental).
  const isDirty = state.valueCents > 0 || state.categoryId !== "" || state.description.trim() !== "";

  const handleClose = () => {
    setState(defaultLaunchState(initialType, initialValues));
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
    triggerSensory("selection");
    setError(null);
    setState((prev) => ({ ...prev, step }));
  };

  const selectedCard = state.paymentMethod === "credit_card"
    ? cardsQuery.data?.find((card) => card.id === state.cardId)
    : undefined;

  // Auto-seleção contextual de categoria e avanço para confirmação rápida em 1 toque (Fase 12 — Tarefa 28)
  useEffect(() => {
    if (!categoriesQuery.data || categoriesQuery.data.length === 0) return;

    // Se a categoria selecionada atual já é válida no conjunto de categorias ativas, não sobrescreve
    const currentValid = categoriesQuery.data.some((c) => c.id === state.categoryId);
    if (currentValid) return;

    // 1. Tenta resolver por initialValues?.categoryId (pode ser UUID ou slug canônico)
    const target = initialValues?.categoryId || state.categoryId;
    let matchedCategory = target
      ? categoriesQuery.data.find((c) => c.id === target) ||
        matchCategoryBySlug(categoriesQuery.data, target as CanonicalCategorySlug)
      : undefined;

    // 2. Se não encontrou por target, mas temos descrição preenchida, infere deterministicamente
    // se o usuário não tiver desabilitado a auto-categorização nas preferências
    if (!matchedCategory && state.description) {
      const prefs = getBankAssistantPreferences();
      if (prefs.autoCategoryInferenceEnabled) {
        const slug = inferCategoryKeyword(state.description);
        if (slug) {
          matchedCategory = matchCategoryBySlug(categoriesQuery.data, slug);
        }
      }
    }

    if (matchedCategory) {
      const targetCategoryId = matchedCategory.id;
      const timer = setTimeout(() => {
        setState((prev) => {
          // Se o valor estiver preenchido e a categoria foi resolvida/inferida,
          // avança o step para 3 ("Detalhes") permitindo confirmação rápida em 1 toque
          const nextStep = prev.valueCents > 0 && prev.step <= 2 ? 3 : prev.step;
          return {
            ...prev,
            categoryId: targetCategoryId,
            step: nextStep,
          };
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [categoriesQuery.data, initialValues?.categoryId, state.categoryId, state.description]);

  // Pré-seleção automática de cartão quando cartão de crédito selecionado e só há 1 cartão ativo
  useEffect(() => {
    if (state.type !== "expense" || state.paymentMethod !== "credit_card") return;
    if (state.cardId || !cardsQuery.data || cardsQuery.data.length === 0) return;

    if (cardsQuery.data.length === 1 && cardsQuery.data[0]) {
      const singleCardId = cardsQuery.data[0].id;
      const timer = setTimeout(() => {
        setState((prev) => ({ ...prev, cardId: singleCardId }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [state.type, state.paymentMethod, state.cardId, cardsQuery.data]);

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

      if (state.description && state.categoryId) {
        storeMerchantCategory(state.description, state.categoryId);
      }

      triggerSensory("success");
      setState(defaultLaunchState(initialType));
      setPending(false);
      onSuccess?.();
      onOpenChange?.(false);
      if (!onSuccess && !onOpenChange) {
        navigate(-1);
      }
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
      setPending(false);
    }
  };

  const handlePasteParsed = (parsed: ParsedBankTransaction) => {
    setState((prev) => {
      const next = { ...prev };
      next.type = parsed.type;
      next.valueCents = parsed.amountCents;
      if (parsed.description) next.description = parsed.description;
      if (parsed.date) next.date = parsed.date;
      if (parsed.paymentMethod) next.paymentMethod = parsed.paymentMethod;
      if (parsed.installments && parsed.installments > 1) {
        next.installments = parsed.installments;
      }
      // 1. Prioriza categoria memorizada do estabelecimento
      let categoryMatched = false;
      if (parsed.merchant && categoriesQuery.data) {
        const memorized = lookupMerchantCategory(parsed.merchant, merchantMemory);
        if (memorized) {
          const found = categoriesQuery.data.find(
            (c) =>
              c.id === memorized ||
              c.icon === memorized ||
              c.name.toLowerCase() === memorized.toLowerCase() ||
              c.name.toLowerCase().includes(memorized.toLowerCase()),
          );
          if (found) {
            next.categoryId = found.id;
            categoryMatched = true;
          }
        }
      }
      // 2. Fallback para slug inferido por palavras-chave
      if (!categoryMatched && parsed.categorySlug && categoriesQuery.data) {
        const found = categoriesQuery.data.find(
          (c) =>
            c.name.toLowerCase().includes(parsed.categorySlug!.toLowerCase()) ||
            parsed.categorySlug!.toLowerCase().includes(c.name.toLowerCase()),
        );
        if (found) next.categoryId = found.id;
      }
      if (parsed.paymentMethod === "credit_card" && cardsQuery.data) {
        const matchingCard = cardsQuery.data.find((card) =>
          card.name.toLowerCase().includes(parsed.bankName.toLowerCase()),
        );
        if (matchingCard) next.cardId = matchingCard.id;
      }
      return next;
    });

    triggerSensory("success");

    pushToast({
      title: "Dados preenchidos",
      description: `${parsed.description} preenchido no formulário de lançamento.`,
      variant: "success",
    });
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
      size="xl"
      showCalculator
      headerActions={
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setPasteOpen(true)}
          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 cursor-pointer"
          aria-label="Colar comprovante"
        >
          <ClipboardPaste className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Colar comprovante</span>
        </Button>
      }
      footer={
        <ModalFooter className="mt-0 pt-0 border-t-0 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={state.step === 1 || pending}
            onClick={() => goTo(state.step - 1)}
          >
            Voltar
          </Button>
          {isLastStep ? (
            <Button
              type="button"
              disabled={!canProceed(state) || pending}
              onClick={() => void handleSubmit()}
            >
              {pending ? "Confirmando…" : "Confirmar lançamento"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canProceed(state)}
              onClick={() => goTo(state.step + 1)}
            >
              Continuar
            </Button>
          )}
        </ModalFooter>
      }
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
            onNext={() => {
              if (canProceed(state)) {
                goTo(2);
              }
            }}
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
            onNext={() => {
              if (canProceed(state)) {
                goTo(4);
              }
            }}
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

        <PasteReceiptDialog
          open={pasteOpen}
          onOpenChange={setPasteOpen}
          onParsed={handlePasteParsed}
        />
      </div>
    </Modal>
  );
}
