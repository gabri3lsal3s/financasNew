import { ReportExecutiveSummary } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks/percent";
import type { FinancialDREData } from "./financial-close-types";

export interface FinancialCloseSummaryProps {
  periodLabel: string;
  dre: FinancialDREData;
  effectiveGrossIncomeBruto: number;
  effectiveTotalExpensesBruto: number;
  effectiveGrossSavingsBruto: number;
  effectiveGrossSavingsRatePct: number;
  hasBrutoRef: boolean;
}

export function FinancialCloseSummary({
  periodLabel,
  dre,
  effectiveGrossIncomeBruto,
  effectiveTotalExpensesBruto,
  effectiveGrossSavingsBruto,
  effectiveGrossSavingsRatePct,
  hasBrutoRef,
}: FinancialCloseSummaryProps) {
  const netCashFlow = effectiveGrossSavingsBruto - dre.investedAporteCents;

  return (
    <ReportExecutiveSummary
      title="SÍNTESE DO FLUXO CONTÁBIL & RESULTADO"
      items={[
        {
          label: "Receitas Totais",
          value: <MoneyText cents={effectiveGrossIncomeBruto} tone="positive" />,
          subtext:
            hasBrutoRef && dre.grossIncomeCents !== effectiveGrossIncomeBruto ? (
              <span>
                Ponderada: <MoneyText cents={dre.grossIncomeCents} className="inline text-[10px]" />
              </span>
            ) : (
              "Entradas no Período"
            ),
        },
        {
          label: "Despesas Totais",
          value: <MoneyText cents={effectiveTotalExpensesBruto} tone="negative" />,
          subtext:
            hasBrutoRef && dre.totalExpensesCents !== effectiveTotalExpensesBruto ? (
              <span>
                Ponderada: <MoneyText cents={dre.totalExpensesCents} className="inline text-[10px]" />
              </span>
            ) : (
              "Saídas no Período"
            ),
        },
        {
          label: "Resultado Operacional",
          value: (
            <MoneyText
              cents={effectiveGrossSavingsBruto}
              tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"}
            />
          ),
          subtext: effectiveGrossSavingsBruto >= 0 ? "Superávit" : "Déficit",
        },
        {
          label: "Taxa de Poupança",
          value: `${formatPercent(effectiveGrossSavingsRatePct)}%`,
          subtext: "Eficiência de Renda",
        },
      ]}
      narrative={
        <span>
          No período apurado (<strong>{periodLabel}</strong>), a receita operacional bruta totalizou{" "}
          <strong>
            <MoneyText cents={effectiveGrossIncomeBruto} tone="positive" className="inline font-bold" />
          </strong>{" "}
          frente a despesas realizadas de{" "}
          <strong>
            <MoneyText cents={effectiveTotalExpensesBruto} tone="negative" className="inline font-bold" />
          </strong>
          , gerando resultado operacional de{" "}
          <strong>
            <MoneyText
              cents={effectiveGrossSavingsBruto}
              tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"}
              className="inline font-bold"
            />
          </strong>{" "}
          (taxa de poupança de <strong>{formatPercent(effectiveGrossSavingsRatePct)}%</strong>). Foram direcionados{" "}
          <strong>
            <MoneyText cents={dre.investedAporteCents} className="inline font-bold" />
          </strong>{" "}
          para investimentos, resultando em variação líquida de caixa de{" "}
          <strong>
            <MoneyText
              cents={netCashFlow}
              tone={netCashFlow >= 0 ? "positive" : "negative"}
              className="inline font-bold"
            />
          </strong>
          .
        </span>
      }
    />
  );
}
