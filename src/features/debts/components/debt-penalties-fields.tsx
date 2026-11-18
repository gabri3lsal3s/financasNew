import { Button, FormField, MoneyInput, MoneyText } from "@/components/ui";

export interface DebtPenaltiesFieldsProps {
  showPenalties: boolean;
  onTogglePenalties: () => void;
  fineCents: number;
  onFineCentsChange: (cents: number) => void;
  interestCents: number;
  onInterestCentsChange: (cents: number) => void;
  discountCents: number;
  onDiscountCentsChange: (cents: number) => void;
  effectivePayableCents: number;
}

export function DebtPenaltiesFields({
  showPenalties,
  onTogglePenalties,
  fineCents,
  onFineCentsChange,
  interestCents,
  onInterestCentsChange,
  discountCents,
  onDiscountCentsChange,
  effectivePayableCents,
}: DebtPenaltiesFieldsProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface-raised p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground">Acréscimos e Descontos</span>
        <Button type="button" variant="ghost" size="sm" onClick={onTogglePenalties}>
          {showPenalties ? "Ocultar" : "Informar multa/juros/desconto"}
        </Button>
      </div>

      {showPenalties ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <FormField label="Multa por atraso" htmlFor="fine-cents">
            <MoneyInput
              id="fine-cents"
              cents={fineCents}
              onCentsChange={onFineCentsChange}
              aria-label="Multa por atraso"
            />
          </FormField>

          <FormField label="Juros / Mora" htmlFor="interest-cents">
            <MoneyInput
              id="interest-cents"
              cents={interestCents}
              onCentsChange={onInterestCentsChange}
              aria-label="Juros de mora"
            />
          </FormField>

          <FormField label="Desconto" htmlFor="discount-cents">
            <MoneyInput
              id="discount-cents"
              cents={discountCents}
              onCentsChange={onDiscountCentsChange}
              aria-label="Desconto obtido"
            />
          </FormField>
        </div>
      ) : null}

      {fineCents > 0 || interestCents > 0 || discountCents > 0 ? (
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/80 text-foreground font-medium">
          <span>Valor efetivo pago:</span>
          <MoneyText cents={effectivePayableCents} tone="default" className="text-sm font-semibold" />
        </div>
      ) : null}
    </div>
  );
}
