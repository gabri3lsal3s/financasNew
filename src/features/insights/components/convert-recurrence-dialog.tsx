import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import {
  Alert,
  Button,
  DatePicker,
  Input,
  Modal,
  MoneyInput,
  Select,
} from "@/components/ui";
import { useCategories, useCreateRecurrence, useCreditCards, useSetFeedback } from "@/state";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { todayLocalIso } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import type { PaymentMethod, RecurrenceFrequency } from "@/types";

export interface ConvertRecurrenceDialogProps {
  occurrence: RecurrenceOccurrence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (occurrenceKey: string) => void;
}

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: RECURRENCE_FREQUENCY_LABELS.monthly },
  { value: "weekly", label: RECURRENCE_FREQUENCY_LABELS.weekly },
  { value: "quarterly", label: RECURRENCE_FREQUENCY_LABELS.quarterly },
  { value: "yearly", label: RECURRENCE_FREQUENCY_LABELS.yearly },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "credit_card", label: PAYMENT_METHOD_LABELS.credit_card },
  { value: "pix", label: PAYMENT_METHOD_LABELS.pix },
  { value: "debit", label: PAYMENT_METHOD_LABELS.debit },
  { value: "cash", label: PAYMENT_METHOD_LABELS.cash },
  { value: "transfer", label: PAYMENT_METHOD_LABELS.transfer },
  { value: "other", label: PAYMENT_METHOD_LABELS.other },
];

const DURATION_OPTIONS = [
  { value: "12", label: "12 ocorrências (1 ano)" },
  { value: "24", label: "24 ocorrências (2 anos)" },
  { value: "36", label: "36 ocorrências (3 anos)" },
  { value: "custom_date", label: "Até data de término" },
];

function calculateDefaultStartDate(occurrence: RecurrenceOccurrence): string {
  if (occurrence.nextDueDate) {
    return occurrence.nextDueDate;
  }
  const today = todayLocalIso();
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = parseInt(yearStr ?? "2026", 10);
  const month = parseInt(monthStr ?? "1", 10);
  const day = parseInt(dayStr ?? "1", 10);
  const typical = occurrence.typicalDayOfMonth ?? day;

  if (day <= typical) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const actualDay = Math.min(typical, daysInMonth);
    return `${yearStr}-${String(month).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
  }

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
  const actualDay = Math.min(typical, daysInNextMonth);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
}

export function ConvertRecurrenceDialog({
  occurrence,
  open,
  onOpenChange,
  onSuccess,
}: ConvertRecurrenceDialogProps) {
  const [description, setDescription] = useState("");
  const [valueCents, setValueCents] = useState(0);
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [startDate, setStartDate] = useState(todayLocalIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
  const [cardId, setCardId] = useState<string>("");
  const [durationMode, setDurationMode] = useState("12");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initializedKey, setInitializedKey] = useState<string | null>(null);

  const categoriesQuery = useCategories("expense");
  const cardsQuery = useCreditCards();
  const createRecurrence = useCreateRecurrence();
  const setFeedback = useSetFeedback();

  const expenseCategories = categoriesQuery.data ?? [];
  const creditCards = cardsQuery.data ?? [];

  // Sincroniza dados pré-preenchidos apenas na abertura ou quando a ocorrência selecionada muda
  const currentKey = open && occurrence ? occurrence.key : null;
  if (currentKey !== initializedKey) {
    setInitializedKey(currentKey);
    if (occurrence && open) {
      setDescription(occurrence.name);
      setValueCents(occurrence.averageCents > 0 ? occurrence.averageCents : 0);
      setFrequency("monthly");
      setDurationMode("12");
      setEndDate("");
      setError(null);
      setStartDate(calculateDefaultStartDate(occurrence));
      setCategoryId(occurrence.categoryId ?? (expenseCategories[0]?.id ?? ""));

      const firstExpense = occurrence.expenses?.[0];
      if (
        firstExpense?.paymentMethod &&
        PAYMENT_METHOD_OPTIONS.some((opt) => opt.value === firstExpense.paymentMethod)
      ) {
        setPaymentMethod(firstExpense.paymentMethod as PaymentMethod);
      } else {
        setPaymentMethod("credit_card");
      }

      setCardId(firstExpense?.cardId ?? (creditCards[0]?.id ?? ""));
    }
  }

  if (!occurrence) return null;

  const resolvedCategoryId = categoryId || (expenseCategories[0]?.id ?? "");
  const resolvedCardId = cardId || (creditCards[0]?.id ?? "");

  const handleSubmit = async () => {
    setError(null);

    const cleanDescription = description.trim();
    if (!cleanDescription) {
      setError("Informe a descrição da recorrência.");
      return;
    }

    if (valueCents <= 0) {
      setError("O valor recorrente deve ser maior que zero.");
      return;
    }

    if (!resolvedCategoryId) {
      setError("Selecione uma categoria para os lançamentos.");
      return;
    }

    if (!startDate) {
      setError("Selecione a data da primeira ocorrência.");
      return;
    }

    if (paymentMethod === "credit_card" && creditCards.length > 0 && !resolvedCardId) {
      setError("Selecione o cartão de crédito associado.");
      return;
    }

    const occurrencesTotal =
      durationMode !== "custom_date" ? parseInt(durationMode, 10) : null;

    if (durationMode === "custom_date" && !endDate) {
      setError("Informe a data de término da recorrência.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Cria a recorrência formal via RPC transacional
      await createRecurrence.mutateAsync({
        kind: "expense",
        frequency,
        value: valueCents / 100,
        categoryId: resolvedCategoryId,
        startDate,
        endDate: durationMode === "custom_date" ? endDate : null,
        occurrencesTotal,
        paymentMethod,
        cardId: paymentMethod === "credit_card" ? resolvedCardId || null : null,
        description: cleanDescription,
        reportWeight: 1,
      });

      // 2. Marca a ocorrência como aprendida/confirmada no feedback para não re-sugerir
      await setFeedback.mutateAsync({
        occurrenceKey: occurrence.key,
        decision: "confirm",
      });

      triggerSensory("success");
      pushToast({
        title: "Recorrência formal fixada com sucesso",
        description: `"${cleanDescription}" agora é um agendamento fixo do seu planejamento.`,
        variant: "success",
      });

      onSuccess?.(occurrence.key);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 w-full [&_button]:w-full [&_button]:sm:w-auto">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        variant="default"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="gap-1.5"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        <span>{isSubmitting ? "Fixando..." : "Fixar Recorrência"}</span>
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Fixar como Recorrência Formal"
      description="Converta este insight em um agendamento formal com valor e vencimento planejados."
      footer={footer}
    >
      <div className="flex flex-col gap-4 py-1">
        {error ? (
          <Alert variant="error" className="text-xs">
            {error}
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Descrição */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="recurrence-desc" className="text-xs font-semibold text-foreground">
              Descrição do agendamento
            </label>
            <Input
              id="recurrence-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Netflix, Aluguel, Plano de Saúde"
              disabled={isSubmitting}
            />
            <span className="text-[11px] text-muted-foreground">
              Nome legível que identifica a recorrência no extrato e relatórios.
            </span>
          </div>

          {/* Valor Recorrente Sugerido */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recurrence-value" className="text-xs font-semibold text-foreground">
              Valor recorrente planejado
            </label>
            <MoneyInput
              id="recurrence-value"
              cents={valueCents}
              onCentsChange={setValueCents}
              disabled={isSubmitting}
            />
            <span className="text-[11px] text-muted-foreground">
              Sugerido a partir do valor médio detectado.
            </span>
          </div>

          {/* Frequência */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Frequência
            </label>
            <Select
              value={frequency}
              onValueChange={(val) => setFrequency(val as RecurrenceFrequency)}
              options={FREQUENCY_OPTIONS}
              disabled={isSubmitting}
              ariaLabel="Frequência do agendamento"
            />
            <span className="text-[11px] text-muted-foreground">
              Intervalo padrão de repetição do lançamento.
            </span>
          </div>

          {/* Categoria */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Categoria
            </label>
            <Select
              value={resolvedCategoryId}
              onValueChange={setCategoryId}
              options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecione a categoria"
              disabled={isSubmitting}
              ariaLabel="Categoria do agendamento"
            />
            <span className="text-[11px] text-muted-foreground">
              Categoria financeira para os orçamentos mensais.
            </span>
          </div>

          {/* Data da Primeira Cobrança */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Primeiro lançamento em
            </label>
            <DatePicker
              value={startDate}
              onValueChange={setStartDate}
              disabled={isSubmitting}
              ariaLabel="Data da primeira cobrança"
            />
            <span className="text-[11px] text-muted-foreground">
              {occurrence.typicalDayOfMonth
                ? `Calculado para o dia ~${occurrence.typicalDayOfMonth} habitual.`
                : "Data em que a recorrência se inicia."}
            </span>
          </div>

          {/* Método de Pagamento */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Forma de pagamento
            </label>
            <Select
              value={paymentMethod}
              onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
              options={PAYMENT_METHOD_OPTIONS}
              disabled={isSubmitting}
              ariaLabel="Forma de pagamento"
            />
          </div>

          {/* Cartão de Crédito (quando aplicável) */}
          {paymentMethod === "credit_card" && creditCards.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Cartão de crédito
              </label>
              <Select
                value={resolvedCardId}
                onValueChange={setCardId}
                options={creditCards.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Selecione o cartão"
                disabled={isSubmitting}
                ariaLabel="Cartão de crédito"
              />
            </div>
          ) : null}

          {/* Duração / Quando Termina */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-foreground">
              Duração planejada
            </label>
            <Select
              value={durationMode}
              onValueChange={setDurationMode}
              options={DURATION_OPTIONS}
              disabled={isSubmitting}
              ariaLabel="Duração planejada da recorrência"
            />
          </div>

          {durationMode === "custom_date" ? (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-foreground">
                Data final de término
              </label>
              <DatePicker
                value={endDate}
                onValueChange={setEndDate}
                disabled={isSubmitting}
                ariaLabel="Data de término da recorrência"
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
