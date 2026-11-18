import { useId } from "react";
import { Card, CardHeader, FormField, MoneyInput, NumericInput, PercentInput } from "@/components/ui";

export interface CompoundParametersGridProps {
  initialAmountCents: number;
  onInitialAmountChange: (cents: number) => void;
  monthlyContributionCents: number;
  onMonthlyContributionChange: (cents: number) => void;
  annualRatePercent: number;
  onAnnualRateChange: (rate: number) => void;
  periodYears: number;
  onPeriodYearsChange: (years: number) => void;
  monthlyLivingCostCents: number;
  onMonthlyLivingCostChange: (cents: number) => void;
}

export function CompoundParametersGrid({
  initialAmountCents,
  onInitialAmountChange,
  monthlyContributionCents,
  onMonthlyContributionChange,
  annualRatePercent,
  onAnnualRateChange,
  periodYears,
  onPeriodYearsChange,
  monthlyLivingCostCents,
  onMonthlyLivingCostChange,
}: CompoundParametersGridProps) {
  const baseId = useId();

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-4">
          <FormField label="Patrimônio Inicial" htmlFor={`${baseId}-initial`}>
            <MoneyInput
              id={`${baseId}-initial`}
              cents={initialAmountCents}
              onCentsChange={onInitialAmountChange}
              size="md"
              aria-label="Patrimônio inicial"
            />
          </FormField>
        </CardHeader>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-4">
          <FormField label="Aporte Mensal" htmlFor={`${baseId}-contribution`}>
            <MoneyInput
              id={`${baseId}-contribution`}
              cents={monthlyContributionCents}
              onCentsChange={onMonthlyContributionChange}
              size="md"
              aria-label="Aporte mensal"
            />
          </FormField>
        </CardHeader>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-4">
          <FormField label="Rentabilidade (% a.a.)" htmlFor={`${baseId}-rate`}>
            <PercentInput
              id={`${baseId}-rate`}
              value={annualRatePercent}
              onValueChange={onAnnualRateChange}
              size="md"
              aria-label="Taxa de juros anual estimada"
            />
          </FormField>
        </CardHeader>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-4">
          <FormField label="Período (Anos)" htmlFor={`${baseId}-years`}>
            <NumericInput
              id={`${baseId}-years`}
              value={periodYears}
              onValueChange={(val) =>
                onPeriodYearsChange(Math.max(1, Math.min(50, Number(val) || 1)))
              }
              size="md"
              aria-label="Período em anos"
            />
          </FormField>
        </CardHeader>
      </Card>

      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-4">
          <FormField label="Custo de Vida Alvo" htmlFor={`${baseId}-living`}>
            <MoneyInput
              id={`${baseId}-living`}
              cents={monthlyLivingCostCents}
              onCentsChange={onMonthlyLivingCostChange}
              size="md"
              aria-label="Custo de vida mensal almejado na aposentadoria"
            />
          </FormField>
        </CardHeader>
      </Card>
    </section>
  );
}
