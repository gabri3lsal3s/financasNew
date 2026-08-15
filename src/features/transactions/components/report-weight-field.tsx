import { MoneyInput, Select } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks";
import { REPORT_WEIGHT_OPTIONS } from "./report-weight-constants";

export interface ReportWeightFieldProps {
  /** Valor total do lançamento (centavos). */
  valueCents: number;
  /** Modo atual: preset como string ("1"|"0.75"|…) ou "custom". */
  mode: string;
  onModeChange: (mode: string) => void;
  /** Valor considerado no relatório (centavos) — modo custom. */
  customAmountCents: number;
  onCustomAmountChange: (cents: number) => void;
  /** Rótulo do bloco custom (ex.: "Valor gasto real considerado no relatório"). */
  customLabel: string;
  ariaLabelCustom?: string;
}

/**
 * Peso no relatório (DRY — usado nos diálogos de despesa e receita):
 * presets 100/75/50/25/0% + modo personalizado com valor em reais.
 */
export function ReportWeightField({
  valueCents,
  mode,
  onModeChange,
  customAmountCents,
  onCustomAmountChange,
  customLabel,
  ariaLabelCustom = "Valor considerado no relatório",
}: ReportWeightFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Peso no relatório
        <Select
          value={mode}
          onValueChange={onModeChange}
          options={REPORT_WEIGHT_OPTIONS}
          ariaLabel="Peso no relatório"
        />
      </label>

      {mode === "custom" ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-3">
          <span className="text-xs font-medium text-foreground">{customLabel}</span>
          <MoneyInput
            cents={customAmountCents}
            onCentsChange={onCustomAmountChange}
            aria-label={ariaLabelCustom}
          />
          {valueCents > 0 ? (
            <span className="text-xs text-muted-foreground">
              Equivale a {Math.round((customAmountCents / valueCents) * 100)}% do valor total ({formatCentsAsBRL(valueCents)}).
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
