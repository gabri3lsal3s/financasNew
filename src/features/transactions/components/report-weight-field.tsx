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
  /** Rótulo do bloco custom (ex.: "Sua cota considerada no relatório"). */
  customLabel?: string;
  ariaLabelCustom?: string;
}

/**
 * Campo de participação / rateio no relatório (DRY — usado nos diálogos de despesa e receita):
 * Presets 100/75/50/25/0% + modo personalizado em reais com aviso explícito de que o valor bancário cobrado permanece 100%.
 */
export function ReportWeightField({
  valueCents,
  mode,
  onModeChange,
  customAmountCents,
  onCustomAmountChange,
  customLabel = "Sua cota considerada no relatório",
  ariaLabelCustom = "Valor considerado no relatório",
}: ReportWeightFieldProps) {
  const isSplit = mode !== "1";
  const effectiveCents =
    mode === "custom"
      ? customAmountCents
      : Number.isFinite(Number(mode))
        ? Math.round(valueCents * Number(mode))
        : valueCents;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Sua Participação / Rateio
        <Select
          value={mode}
          onValueChange={onModeChange}
          options={REPORT_WEIGHT_OPTIONS}
          ariaLabel="Sua Participação / Rateio"
        />
      </label>

      {isSplit ? (
        <div className="rounded-md border border-border/80 bg-surface px-2.5 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Aviso de Rateio:</span> O valor bancário cobrado permanece 100% ({formatCentsAsBRL(valueCents)}). Nos relatórios e metas entrará apenas a sua cota de {formatCentsAsBRL(effectiveCents)}.
        </div>
      ) : null}

      {mode === "custom" ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-3">
          <span className="text-xs font-semibold text-foreground">{customLabel}</span>
          <MoneyInput
            cents={customAmountCents}
            onCentsChange={onCustomAmountChange}
            aria-label={ariaLabelCustom}
          />
          {valueCents > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              Equivale a {Math.round((customAmountCents / valueCents) * 100)}% do valor total cobrado ({formatCentsAsBRL(valueCents)}).
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
