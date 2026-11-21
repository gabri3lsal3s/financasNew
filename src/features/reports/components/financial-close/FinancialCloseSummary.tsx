import { ReportExecutiveSummary } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks/percent";
import type { FinancialDREData } from "./financial-close-types";

export interface FinancialCloseSummaryProps {
  periodLabel?: string;
  dre: FinancialDREData;
  effectiveGrossIncomeBruto: number;
  effectiveTotalExpensesBruto: number;
  effectiveGrossSavingsBruto: number;
  effectiveGrossSavingsRatePct: number;
  hasBrutoRef: boolean;
}

export function FinancialCloseSummary({
  dre,
  effectiveGrossIncomeBruto,
  effectiveTotalExpensesBruto,
  effectiveGrossSavingsBruto,
  effectiveGrossSavingsRatePct,
  hasBrutoRef,
}: FinancialCloseSummaryProps) {
  return (
    <ReportExecutiveSummary
      title="SÍNTESE DO FLUXO CONTÁBIL & RESULTADO"
      items={[
        {
          label: "Receitas Totais",
          value: <MoneyText cents={effectiveGrossIncomeBruto} tone="positive" className="text-base sm:text-lg font-bold whitespace-nowrap" />,
          subtext:
            hasBrutoRef && dre.grossIncomeCents !== effectiveGrossIncomeBruto ? (
              <span>
                Ponderado: <MoneyText cents={dre.grossIncomeCents} className="inline text-[10px]" />
              </span>
            ) : (
              "Entradas no Período"
            ),
        },
        {
          label: "Despesas Totais",
          value: <MoneyText cents={effectiveTotalExpensesBruto} tone="negative" className="text-base sm:text-lg font-bold whitespace-nowrap" />,
          subtext:
            hasBrutoRef && dre.totalExpensesCents !== effectiveTotalExpensesBruto ? (
              <span>
                Ponderado: <MoneyText cents={dre.totalExpensesCents} className="inline text-[10px]" />
              </span>
            ) : (
              "Saídas no Período"
            ),
        },
        {
          label: "Res. Operacional",
          value: (
            <MoneyText
              cents={effectiveGrossSavingsBruto}
              tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"}
              sign="explicit"
              className="text-base sm:text-lg font-bold whitespace-nowrap"
            />
          ),
          subtext: effectiveGrossSavingsBruto >= 0 ? "Superávit do Período" : "Déficit do Período",
        },
        {
          label: "Taxa de Poupança",
          value: `${formatPercent(effectiveGrossSavingsRatePct)}%`,
          subtext: "Eficiência de Renda",
        },
      ]}
    />
  );
}
