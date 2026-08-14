import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/services/errors";
import type { PaymentMethod, ReceiveType } from "@/types";
import type { LaunchState } from "./wizard-state";

export interface StepDetailsProps {
  state: LaunchState;
  onDateChange: (date: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardChange: (cardId: string) => void;
  onReceiveTypeChange: (type: ReceiveType) => void;
  onDescriptionChange: (description: string) => void;
  onReportWeightChange: (weight: number) => void;
  onDebtToggle: (enabled: boolean) => void;
  onDebtAmountChange: (cents: number) => void;
  onDebtDueDateChange: (date: string) => void;
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

const WEIGHT_OPTIONS = [
  { value: "1", label: "100% (conta integralmente)" },
  { value: "0.75", label: "75%" },
  { value: "0.5", label: "50%" },
  { value: "0.25", label: "25%" },
  { value: "0", label: "Não contar nos relatórios" },
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
  onDebtToggle,
  onDebtAmountChange,
  onDebtDueDateChange,
  cards,
  cardsLoading,
  cardsError,
}: StepDetailsProps) {
  const isExpense = state.type === "expense";

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
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Peso no relatório</span>
        <Select
          value={String(state.reportWeight)}
          onValueChange={(value) => onReportWeightChange(Number(value))}
          options={WEIGHT_OPTIONS}
          ariaLabel="Peso no relatório"
        />
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
