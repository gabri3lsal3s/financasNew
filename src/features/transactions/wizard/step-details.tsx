import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PredictionSuggestions } from "@/components/modules";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL } from "@/services/masks/money";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import type { PaymentMethod, ReceiveType } from "@/types";
import { REPORT_WEIGHT_OPTIONS } from "../components/report-weight-constants";
import { CUSTOM_WEIGHT_VALUE, effectiveReportWeight, isPresetWeight } from "./wizard-state";
import type { LaunchState } from "./wizard-state";

export interface StepDetailsProps {
  state: LaunchState;
  onDateChange: (date: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardChange: (cardId: string) => void;
  onReceiveTypeChange: (type: ReceiveType) => void;
  onDescriptionChange: (description: string) => void;
  onReportWeightChange: (weight: number) => void;
  onReportCustomAmountChange: (cents: number) => void;
  onDebtToggle: (enabled: boolean) => void;
  onDebtAmountChange: (cents: number) => void;
  onDebtDueDateChange: (date: string) => void;
  /** Aplica uma sugestão preditiva (F21) — preenche categoria/forma/cartão/valor. */
  onApplySuggestion: (suggestion: {
    categoryId: string;
    paymentMethod: string | null;
    cardId: string | null;
    receiveType: string | null;
    value: number;
  }) => void;
  /** Sugestões derivadas do histórico (F21) — vazio oculta o bloco. */
  suggestions: {
    categoryId: string;
    categoryName: string;
    paymentMethod: string | null;
    cardId: string | null;
    receiveType: string | null;
    value: number;
    confidence: number;
  }[];
  cards: { id: string; name: string }[] | undefined;
  cardsLoading: boolean;
  cardsError: unknown;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Débito" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "pix", label: "Pix" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

const RECEIVE_TYPE_OPTIONS: { value: ReceiveType; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

/** Passo 3 — detalhes do lançamento. */
export function StepDetails({
  state,
  onDateChange,
  onPaymentMethodChange,
  onCardChange,
  onReceiveTypeChange,
  onDescriptionChange,
  onReportWeightChange,
  onReportCustomAmountChange,
  onDebtToggle,
  onDebtAmountChange,
  onDebtDueDateChange,
  onApplySuggestion,
  suggestions,
  cards,
  cardsLoading,
  cardsError,
}: StepDetailsProps) {
  const isExpense = state.type === "expense";

  const cardLabels = Object.fromEntries((cards ?? []).map((card) => [card.id, card.name]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Data</span>
        <DatePicker value={state.date} onValueChange={onDateChange} />
      </div>

      {isExpense ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Forma de pagamento</span>
            <Select
              value={state.paymentMethod}
              onValueChange={(value) => onPaymentMethodChange(value as PaymentMethod)}
              options={PAYMENT_METHOD_OPTIONS}
              ariaLabel="Forma de pagamento"
            />
          </div>

          {state.paymentMethod === "credit_card" ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Cartão</span>
              {cardsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : cardsError ? (
                <Alert variant="error">{getErrorMessage(cardsError)}</Alert>
              ) : (
                <Select
                  value={state.cardId ?? ""}
                  onValueChange={onCardChange}
                  options={(cards ?? []).map((card) => ({ value: card.id, label: card.name }))}
                  placeholder="Selecione o cartão"
                  ariaLabel="Cartão de crédito"
                />
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Como recebeu</span>
          <Select
            value={state.receiveType}
            onValueChange={(value) => onReceiveTypeChange(value as ReceiveType)}
            options={RECEIVE_TYPE_OPTIONS}
            ariaLabel="Tipo de recebimento"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Descrição (opcional)</span>
        <Input
          value={state.description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={isExpense ? "Ex.: Supermercado do mês" : "Ex.: Salário"}
        />
        {state.description.trim().length >= 3 ? (
          <PredictionSuggestions
            suggestions={suggestions}
            paymentLabels={PAYMENT_METHOD_LABELS}
            cardLabels={cardLabels}
            receiveLabels={RECEIVE_TYPE_LABELS}
            onApply={(suggestion) =>
              onApplySuggestion({
                categoryId: suggestion.categoryId,
                paymentMethod: suggestion.paymentMethod,
                cardId: suggestion.cardId,
                receiveType: suggestion.receiveType,
                value: suggestion.value,
              })
            }
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Peso no relatório</span>
        <Select
          value={isPresetWeight(state.reportWeight) ? String(state.reportWeight) : "custom"}
          onValueChange={(value) =>
            onReportWeightChange(value === "custom" ? CUSTOM_WEIGHT_VALUE : Number(value))
          }
          options={REPORT_WEIGHT_OPTIONS}
          ariaLabel="Peso no relatório"
        />
        {!isPresetWeight(state.reportWeight) ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-3">
            <span className="text-xs font-medium text-foreground">Valor gasto real considerado no relatório</span>
            <MoneyInput
              cents={state.reportCustomAmountCents}
              onCentsChange={onReportCustomAmountChange}
              aria-label="Valor considerado no relatório"
            />
            {state.valueCents > 0 ? (
              <span className="text-xs text-muted-foreground">
                Equivale a {Math.round(effectiveReportWeight(state) * 100)}% do valor total ({formatCentsAsBRL(state.valueCents)}).
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isExpense ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <Checkbox
            checked={state.debtEnabled}
            onCheckedChange={onDebtToggle}
            label="Criar cobrança vinculada (dívida a pagar)"
          />
          {state.debtEnabled ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Valor da cobrança</span>
                <MoneyInput
                  cents={state.debtAmountCents}
                  onCentsChange={onDebtAmountChange}
                  aria-label="Valor da cobrança vinculada"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Vencimento</span>
                <DatePicker value={state.debtDueDate} onValueChange={onDebtDueDateChange} />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
