import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Alert, Button, Modal, ModalFooter } from "@/components/ui";
import { useCategories, useCreateRecurrence, useCreditCards, useSetFeedback } from "@/state";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import type { PaymentMethod, RecurrenceFrequency } from "@/types";
import { ConvertRecurrenceFormFields } from "./convert-recurrence/ConvertRecurrenceFormFields";
import {
  calculateDefaultStartDate,
  resolveDefaultPaymentMethod,
} from "./convert-recurrence/convert-recurrence-utils";

export interface ConvertRecurrenceDialogProps {
  occurrence: RecurrenceOccurrence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (occurrenceKey: string) => void;
}

function ConvertRecurrenceDialogInner({
  occurrence,
  open,
  onOpenChange,
  onSuccess,
}: Omit<ConvertRecurrenceDialogProps, "occurrence"> & { occurrence: RecurrenceOccurrence }) {
  const categoriesQuery = useCategories("expense");
  const cardsQuery = useCreditCards();
  const createRecurrence = useCreateRecurrence();
  const setFeedback = useSetFeedback();

  const expenseCategories = categoriesQuery.data ?? [];
  const creditCards = cardsQuery.data ?? [];

  const [description, setDescription] = useState(() => occurrence.name);
  const [valueCents, setValueCents] = useState(() =>
    occurrence.averageCents > 0 ? occurrence.averageCents : 0,
  );
  const [categoryId, setCategoryId] = useState(() => occurrence.categoryId ?? "");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [startDate, setStartDate] = useState(() => calculateDefaultStartDate(occurrence));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    resolveDefaultPaymentMethod(occurrence),
  );
  const [cardId, setCardId] = useState(() => occurrence.expenses?.[0]?.cardId ?? "");
  const [durationMode, setDurationMode] = useState("12");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (durationMode === "custom_date" && !endDate) {
      setError("Informe a data de término da recorrência.");
      return;
    }

    const occurrencesTotal = durationMode !== "custom_date" ? parseInt(durationMode, 10) : null;

    setIsSubmitting(true);
    try {
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

      await setFeedback.mutateAsync({
        occurrenceKey: occurrence.key,
        decision: "confirm",
      });

      pushToast({
        title: "Recorrência formal fixada com sucesso",
        description: `"${cleanDescription}" agora é um agendamento fixo do seu planejamento.`,
        variant: "success",
      });

      onSuccess?.(occurrence.key);
      onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      showCalculator
      title="Fixar como Recorrência Formal"
      description="Converta este insight em um agendamento formal com valor e vencimento planejados."
      footer={
        <ModalFooter borderless>
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
            sensoryIntent="success"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            <span>{isSubmitting ? "Fixando..." : "Fixar Recorrência"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {error ? (
          <Alert variant="error" className="text-xs">
            {error}
          </Alert>
        ) : null}

        <ConvertRecurrenceFormFields
          occurrence={occurrence}
          description={description}
          onDescriptionChange={setDescription}
          valueCents={valueCents}
          onValueCentsChange={setValueCents}
          frequency={frequency}
          onFrequencyChange={setFrequency}
          resolvedCategoryId={resolvedCategoryId}
          onCategoryChange={setCategoryId}
          startDate={startDate}
          onStartDateChange={setStartDate}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          resolvedCardId={resolvedCardId}
          onCardChange={setCardId}
          durationMode={durationMode}
          onDurationModeChange={setDurationMode}
          endDate={endDate}
          onEndDateChange={setEndDate}
          expenseCategories={expenseCategories}
          creditCards={creditCards}
          isSubmitting={isSubmitting}
        />
      </div>
    </Modal>
  );
}

export function ConvertRecurrenceDialog(props: ConvertRecurrenceDialogProps) {
  if (!props.open || !props.occurrence) return null;
  return (
    <ConvertRecurrenceDialogInner
      key={props.occurrence.key}
      occurrence={props.occurrence}
      open={props.open}
      onOpenChange={props.onOpenChange}
      onSuccess={props.onSuccess}
    />
  );
}
