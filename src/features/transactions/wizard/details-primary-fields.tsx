import { Sparkles } from "lucide-react";
import { Alert, Badge, DatePicker, FormField, Input, Select, Skeleton } from "@/components/ui";
import type { DescriptionSuggestion } from "@/domain/predictions";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import type { ChargeKind, PaymentMethod, ReceiveType } from "@/types";

export interface DetailsPrimaryFieldsProps {
  isExpense: boolean;
  date: string;
  paymentMethod: PaymentMethod;
  cardId: string | null;
  chargeKind?: ChargeKind;
  receiveType: ReceiveType;
  description: string;
  descriptionSuggestions: DescriptionSuggestion[];
  cards: { id: string; name: string }[] | undefined;
  cardsLoading: boolean;
  cardsError: unknown;
  onDateChange: (date: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardChange: (cardId: string) => void;
  onChargeKindChange?: (kind: ChargeKind) => void;
  onReceiveTypeChange: (type: ReceiveType) => void;
  onDescriptionChange: (description: string) => void;
  onNext?: () => void;
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

const CHARGE_KIND_OPTIONS: Array<{ value: ChargeKind; label: string }> = [
  { value: "regular", label: "Consumo normal" },
  { value: "interest", label: "Juros" },
  { value: "fine", label: "Multa" },
  { value: "tax", label: "IOF / Tributos" },
  { value: "bank_fee", label: "Tarifa / Encargos" },
];

export function DetailsPrimaryFields({
  isExpense,
  date,
  paymentMethod,
  cardId,
  chargeKind,
  receiveType,
  description,
  descriptionSuggestions,
  cards,
  cardsLoading,
  cardsError,
  onDateChange,
  onPaymentMethodChange,
  onCardChange,
  onChargeKindChange,
  onReceiveTypeChange,
  onDescriptionChange,
  onNext,
}: DetailsPrimaryFieldsProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Data">
          <DatePicker value={date} onValueChange={onDateChange} />
        </FormField>

        {isExpense ? (
          <FormField label="Forma de pagamento">
            <Select
              value={paymentMethod}
              onValueChange={(value) => onPaymentMethodChange(value as PaymentMethod)}
              options={PAYMENT_METHOD_OPTIONS}
              ariaLabel="Forma de pagamento"
            />
          </FormField>
        ) : (
          <FormField label="Como recebeu">
            <Select
              value={receiveType}
              onValueChange={(value) => onReceiveTypeChange(value as ReceiveType)}
              options={RECEIVE_TYPE_OPTIONS}
              ariaLabel="Tipo de recebimento"
            />
          </FormField>
        )}
      </div>

      {isExpense && paymentMethod === "credit_card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Cartão">
            {cardsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : cardsError ? (
              <Alert variant="error">{getErrorMessage(cardsError)}</Alert>
            ) : (
              <Select
                value={cardId ?? ""}
                onValueChange={onCardChange}
                options={(cards ?? []).map((card) => ({ value: card.id, label: card.name }))}
                placeholder="Selecione o cartão"
                ariaLabel="Cartão de crédito"
              />
            )}
          </FormField>

          <FormField label="Tipo de gasto / encargo">
            <Select
              value={chargeKind ?? "regular"}
              onValueChange={(val) => onChargeKindChange?.(val as ChargeKind)}
              options={CHARGE_KIND_OPTIONS}
              ariaLabel="Tipo de encargo ou gasto"
            />
          </FormField>
        </div>
      ) : null}

      <FormField label="Descrição" optional>
        <Input
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={isExpense ? "Ex.: Supermercado do mês, Uber, Farmácia..." : "Ex.: Salário, Rendimentos, Pix..."}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onNext?.();
            }
          }}
        />
        {description.trim().length >= 2 && descriptionSuggestions.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-1">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
              Sugestões de descrição
            </p>
            <div role="listbox" aria-label="Sugestões de descrição" className="flex flex-wrap gap-1.5">
              {descriptionSuggestions.map((suggestion) => (
                <button
                  key={suggestion.description}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    triggerSensory("action");
                    onDescriptionChange(suggestion.description);
                  }}
                  className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-surface-raised px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate">{suggestion.description}</span>
                  {suggestion.frequency > 1 ? (
                    <Badge variant="muted" size="xs">
                      {suggestion.frequency}×
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </FormField>
    </div>
  );
}
