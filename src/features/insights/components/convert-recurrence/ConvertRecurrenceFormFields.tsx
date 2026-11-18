import { DatePicker, Input, MoneyInput, Select } from "@/components/ui";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import type { Category, CreditCard, PaymentMethod, RecurrenceFrequency } from "@/types";
import {
  DURATION_OPTIONS,
  FREQUENCY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "./convert-recurrence-utils";

export interface ConvertRecurrenceFormFieldsProps {
  occurrence: RecurrenceOccurrence;
  description: string;
  onDescriptionChange: (val: string) => void;
  valueCents: number;
  onValueCentsChange: (val: number) => void;
  frequency: RecurrenceFrequency;
  onFrequencyChange: (val: RecurrenceFrequency) => void;
  resolvedCategoryId: string;
  onCategoryChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (val: PaymentMethod) => void;
  resolvedCardId: string;
  onCardChange: (val: string) => void;
  durationMode: string;
  onDurationModeChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  expenseCategories: readonly Category[];
  creditCards: readonly CreditCard[];
  isSubmitting: boolean;
}

export function ConvertRecurrenceFormFields({
  occurrence,
  description,
  onDescriptionChange,
  valueCents,
  onValueCentsChange,
  frequency,
  onFrequencyChange,
  resolvedCategoryId,
  onCategoryChange,
  startDate,
  onStartDateChange,
  paymentMethod,
  onPaymentMethodChange,
  resolvedCardId,
  onCardChange,
  durationMode,
  onDurationModeChange,
  endDate,
  onEndDateChange,
  expenseCategories,
  creditCards,
  isSubmitting,
}: ConvertRecurrenceFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="recurrence-desc" className="text-xs font-semibold text-foreground">
          Descrição do agendamento
        </label>
        <Input
          id="recurrence-desc"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Ex.: Netflix, Aluguel, Plano de Saúde"
          className="text-base sm:text-sm"
          disabled={isSubmitting}
        />
        <span className="text-[11px] text-muted-foreground">
          Nome legível que identifica a recorrência no extrato e relatórios.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="recurrence-value" className="text-xs font-semibold text-foreground">
          Valor recorrente planejado
        </label>
        <MoneyInput
          id="recurrence-value"
          cents={valueCents}
          onCentsChange={onValueCentsChange}
          disabled={isSubmitting}
        />
        <span className="text-[11px] text-muted-foreground">
          Sugerido a partir do valor médio detectado.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">Frequência</label>
        <Select
          value={frequency}
          onValueChange={(val) => onFrequencyChange(val as RecurrenceFrequency)}
          options={FREQUENCY_OPTIONS}
          disabled={isSubmitting}
          ariaLabel="Frequência do agendamento"
        />
        <span className="text-[11px] text-muted-foreground">
          Intervalo padrão de repetição do lançamento.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">Categoria</label>
        <Select
          value={resolvedCategoryId}
          onValueChange={onCategoryChange}
          options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Selecione a categoria"
          disabled={isSubmitting}
          ariaLabel="Categoria do agendamento"
        />
        <span className="text-[11px] text-muted-foreground">
          Categoria financeira para os orçamentos mensais.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">Primeiro lançamento em</label>
        <DatePicker
          value={startDate}
          onValueChange={onStartDateChange}
          disabled={isSubmitting}
          ariaLabel="Data da primeira cobrança"
        />
        <span className="text-[11px] text-muted-foreground">
          {occurrence.typicalDayOfMonth
            ? `Calculado para o dia ~${occurrence.typicalDayOfMonth} habitual.`
            : "Data em que a recorrência se inicia."}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">Forma de pagamento</label>
        <Select
          value={paymentMethod}
          onValueChange={(val) => onPaymentMethodChange(val as PaymentMethod)}
          options={PAYMENT_METHOD_OPTIONS}
          disabled={isSubmitting}
          ariaLabel="Forma de pagamento"
        />
      </div>

      {paymentMethod === "credit_card" && creditCards.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">Cartão de crédito</label>
          <Select
            value={resolvedCardId}
            onValueChange={onCardChange}
            options={creditCards.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Selecione o cartão"
            disabled={isSubmitting}
            ariaLabel="Cartão de crédito"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className="text-xs font-semibold text-foreground">Duração planejada</label>
        <Select
          value={durationMode}
          onValueChange={onDurationModeChange}
          options={DURATION_OPTIONS}
          disabled={isSubmitting}
          ariaLabel="Duração planejada da recorrência"
        />
      </div>

      {durationMode === "custom_date" ? (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-foreground">Data final de término</label>
          <DatePicker
            value={endDate}
            onValueChange={onEndDateChange}
            disabled={isSubmitting}
            ariaLabel="Data de término da recorrência"
          />
        </div>
      ) : null}
    </div>
  );
}
