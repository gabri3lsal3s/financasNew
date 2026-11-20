import { useMemo } from "react";
import { User, Users } from "lucide-react";
import { SegmentedControl } from "@/components/ui";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { buildBudgetSpendModeExplanationBreakdown } from "@/domain/calculation-memory";

export interface BudgetsMetricToggleProps {
  spendMetric: "personal" | "household";
  onSpendMetricChange: (metric: "personal" | "household") => void;
}

/** Alternador de visualização de gastos (Minha Parte vs Total Bruto) com memória explicativa padronizada. */
export function BudgetsMetricToggle({
  spendMetric,
  onSpendMetricChange,
}: BudgetsMetricToggleProps) {
  const explanationBreakdown = useMemo(() => {
    return buildBudgetSpendModeExplanationBreakdown({ currentMetric: spendMetric });
  }, [spendMetric]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
        Acompanhe os gastos por categoria e defina o teto mensal.
      </p>

      <div className="flex items-center gap-1.5 self-start sm:self-auto">
        <SegmentedControl
          value={spendMetric}
          onChange={onSpendMetricChange}
          options={[
            {
              value: "personal",
              label: "Minha Parte",
              icon: <User aria-hidden="true" />,
              title: "Considera apenas a sua participação pessoal efetiva nas compras (com rateios e reembolsos)",
            },
            {
              value: "household",
              label: "Total Bruto",
              icon: <Users aria-hidden="true" />,
              title: "Considera o valor bruto total nominal das compras (100% de cada despesa, sem rateios)",
            },
          ]}
          ariaLabel="Modo de cálculo dos gastos"
        />

        <CalculationMemoryModal
          breakdown={explanationBreakdown}
          align="end"
        />
      </div>
    </div>
  );
}
