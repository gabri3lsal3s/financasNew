import { useId } from "react";
import { FormField, MoneyInput, MoneyText, Select } from "@/components/ui";
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
  const selectId = useId();
  const customInputId = useId();
  const isSplit = mode !== "1";
  const effectiveCents =
    mode === "custom"
      ? customAmountCents
      : Number.isFinite(Number(mode))
        ? Math.round(valueCents * Number(mode))
        : valueCents;

  return (
    <div className="flex flex-col gap-2.5">
      <FormField label="Sua Participação / Rateio" htmlFor={selectId}>
        <Select
          id={selectId}
          value={mode}
          onValueChange={onModeChange}
          options={REPORT_WEIGHT_OPTIONS}
          ariaLabel="Sua Participação / Rateio"
        />
      </FormField>

      {isSplit ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Aviso de Rateio:</span> O valor bancário cobrado permanece 100% (
          <MoneyText cents={valueCents} variant="caption" tone="default" className="text-[11px] font-medium" />
          ). Nos relatórios e metas entrará apenas a sua cota de{" "}
          <MoneyText cents={effectiveCents} variant="caption" tone="default" className="text-[11px] font-medium" />.
        </p>
      ) : null}

      {mode === "custom" ? (
        <div className="rounded-xl bg-surface-raised p-3">
          <FormField
            label={customLabel}
            htmlFor={customInputId}
            helperText={
              valueCents > 0 ? (
                <>
                  Equivale a {Math.round((customAmountCents / valueCents) * 100)}% do valor total cobrado (
                  <MoneyText cents={valueCents} variant="caption" tone="default" className="text-[11px] font-normal text-muted-foreground" />
                  ).
                </>
              ) : undefined
            }
          >
            <MoneyInput
              id={customInputId}
              cents={customAmountCents}
              onCentsChange={onCustomAmountChange}
              aria-label={ariaLabelCustom}
            />
          </FormField>
        </div>
      ) : null}
    </div>
  );
}
