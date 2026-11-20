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
  return (
    <ReportExecutiveSummary
      title="SÍNTESE DO FLUXO CONTÁBIL & RESULTADO"
      items={[
        {
          label: "Receitas Totais",
          value: <MoneyText cents={effectiveGrossIncomeBruto} tone="positive" className="text-base sm:text-lg font-bold" />,
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
          value: <MoneyText cents={effectiveTotalExpensesBruto} tone="negative" className="text-base sm:text-lg font-bold" />,
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
          label: "Resultado Operacional",
          value: (
            <MoneyText
              cents={effectiveGrossSavingsBruto}
              tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"}
              className="text-base sm:text-lg font-bold"
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
          (taxa de poupança líquida de{" "}
          <strong className="text-foreground">{formatPercent(effectiveGrossSavingsRatePct)}%</strong>
          {dre.investedAporteCents > 0 && (
            <>
              , com aportes patrimoniais direcionados de{" "}
              <strong>
                <MoneyText cents={dre.investedAporteCents} tone="default" className="inline font-bold" />
              </strong>
            </>
          )}
          ).
        </span>
      }
    />
  );
}
