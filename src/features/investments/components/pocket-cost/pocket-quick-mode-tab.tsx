import { Check, Zap } from "lucide-react";
import { Button, DatePicker, FormField, MoneyInput } from "@/components/ui";

export interface PocketQuickModeTabProps {
  quickDate: string;
  onQuickDateChange: (date: string) => void;
  quickAmountCents: number;
  onQuickAmountCentsChange: (cents: number) => void;
  isSaving: boolean;
  onSaveQuick: () => void;
}

export function PocketQuickModeTab({
  quickDate,
  onQuickDateChange,
  quickAmountCents,
  onQuickAmountCentsChange,
  isSaving,
  onSaveQuick,
}: PocketQuickModeTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-2 shadow-xs">
        <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
          <Zap className="size-4 text-warning-strong" aria-hidden="true" />
          Marco Zero Consolidado em 1 Clique
        </span>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Se você não possui o histórico mês a mês ou prefere praticidade imediata, basta informar a{" "}
          <strong>data em que começou a investir</strong> nesta carteira e o{" "}
          <strong>total que saiu do seu bolso até hoje</strong>. O sistema registrará um marco único e calculará a TIR com base nesse horizonte.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs">
        <FormField label="Data de Início da Carteira" htmlFor="pocket-quick-date">
          <DatePicker
            id="pocket-quick-date"
            value={quickDate}
            onValueChange={(d) => {
              if (d) onQuickDateChange(d);
            }}
            placeholder="Data de início"
            ariaLabel="Data de início da carteira"
          />
        </FormField>

        <FormField label="Capital Total Desembolsado do Bolso" htmlFor="pocket-quick-amount">
          <MoneyInput
            id="pocket-quick-amount"
            cents={quickAmountCents}
            onCentsChange={onQuickAmountCentsChange}
            placeholder="R$ 0,00"
            className="text-base sm:text-sm"
            showCalculatorAction
          />
        </FormField>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          variant="default"
          size="sm"
          loading={isSaving}
          onClick={onSaveQuick}
          disabled={isSaving || quickAmountCents <= 0}
          sensoryIntent={false}
          className="gap-1.5 w-full sm:w-auto"
        >
          <Check className="size-3.5" aria-hidden="true" />
          <span>Definir Marco Zero Consolidado</span>
        </Button>
      </div>
    </div>
  );
}
