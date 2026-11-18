import { DatePicker, FormField, MoneyText, NumericInput } from "@/components/ui";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import { computeCorporateEventFactor, computeCorporateEventPreview } from "@/domain/portfolio";
import type { AssetCurrency } from "@/types";

export interface OrderSplitFieldsProps {
  mode: "split" | "reverse_split";
  currency: AssetCurrency;
  currentQuantity: number;
  currentAveragePrice: number;
  splitFromStr: string;
  onSplitFromChange: (value: string) => void;
  splitToStr: string;
  onSplitToChange: (value: string) => void;
  date: string;
  onDateChange: (date: string) => void;
  idPrefix: string;
}

export function OrderSplitFields({
  mode,
  currency,
  currentQuantity,
  currentAveragePrice,
  splitFromStr,
  onSplitFromChange,
  splitToStr,
  onSplitToChange,
  date,
  onDateChange,
  idPrefix,
}: OrderSplitFieldsProps) {
  const factor = computeCorporateEventFactor(
    mode,
    parseDecimalNumber(splitFromStr),
    parseDecimalNumber(splitToStr),
  );
  const preview = computeCorporateEventPreview(currentQuantity, currentAveragePrice, mode, factor);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-xs font-semibold text-foreground">
            {mode === "split" ? "Fator (1 para N) · Proporção X para Y" : "Fator (N para 1) · Proporção X para Y"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Ex.: {mode === "split" ? "1 para 10 ou 10 para 11 (bonif.)" : "10 para 1 ou 5 para 2"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="De (cotas atuais)" htmlFor={`${idPrefix}-split-from`}>
            <NumericInput
              id={`${idPrefix}-split-from`}
              value={splitFromStr}
              onValueChange={onSplitFromChange}
              placeholder={mode === "split" ? "1" : "10"}
              className="text-base sm:text-sm"
            />
          </FormField>

          <FormField label="Para (novas cotas)" htmlFor={`${idPrefix}-split-to`}>
            <NumericInput
              id={`${idPrefix}-split-to`}
              value={splitToStr}
              onValueChange={onSplitToChange}
              placeholder={mode === "split" ? "10" : "1"}
              className="text-base sm:text-sm"
            />
          </FormField>

          <FormField label="Data do Evento">
            <DatePicker value={date} onValueChange={onDateChange} />
          </FormField>
        </div>
      </div>

      {preview.isValid && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface-raised/60 p-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Posição Resultante:</span>
            <span className="font-mono font-bold text-foreground">
              {preview.newQuantity} cotas a{" "}
              <MoneyText cents={numberToCents(preview.newAveragePrice)} currency={currency} className="inline font-bold" />
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border/60 pt-1">
            <span>
              Antes: {currentQuantity} cotas a{" "}
              <MoneyText cents={numberToCents(currentAveragePrice)} currency={currency} variant="caption" tone="default" className="inline" />
            </span>
            <span>Custo total preservado</span>
          </div>
        </div>
      )}
    </div>
  );
}
