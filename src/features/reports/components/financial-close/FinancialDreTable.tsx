import { Landmark } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks/percent";
import type { FinancialDREData } from "./financial-close-types";

export interface FinancialDreTableProps {
  dre: FinancialDREData;
  incomeCount: number;
  expenseCount: number;
  effectiveGrossIncomeBruto: number;
  effectiveTotalExpensesBruto: number;
  effectiveGrossSavingsBruto: number;
  effectiveGrossSavingsRatePct: number;
  hasBrutoRef: boolean;
}

export function FinancialDreTable({
  dre,
  incomeCount,
  expenseCount,
  effectiveGrossIncomeBruto,
  effectiveTotalExpensesBruto,
  effectiveGrossSavingsBruto,
  effectiveGrossSavingsRatePct,
  hasBrutoRef,
}: FinancialDreTableProps) {
  const netCashFlow = effectiveGrossSavingsBruto - dre.investedAporteCents;

  return (
    <section aria-label="Demonstração do Resultado do Exercício" className="break-inside-avoid flex flex-col gap-2">
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-1">
        <Landmark className="size-3.5 text-primary-strong" aria-hidden="true" />
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
          DRE Pessoal — Demonstração do Período
        </h2>
      </div>

      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs print:overflow-visible">
        <table className="w-full min-w-[460px] sm:min-w-0 text-left text-xs border-collapse table-fixed">
          <colgroup>
            <col className={hasBrutoRef ? "w-[45%]" : "w-[60%]"} />
            <col className={hasBrutoRef ? "w-[20%]" : "w-[25%]"} />
            {hasBrutoRef && <col className="w-[20%]" />}
            <col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
              <th className="py-2 px-3">Linha / Estrutura Contábil</th>
              <th className="py-2 px-3 text-right">Valor Bruto (R$)</th>
              {hasBrutoRef && <th className="py-2 px-3 text-right">Ponderado (R$)</th>}
              <th className="py-2 px-3 text-right">% Receita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            <tr className="bg-positive/5">
              <td className="py-2 px-3 font-semibold text-positive-strong">
                (+) Receita Operacional Bruta ({incomeCount} {incomeCount === 1 ? "lançamento" : "lançamentos"})
              </td>
              <td className="py-2 px-3 text-right num font-mono font-bold whitespace-nowrap">
                <MoneyText cents={effectiveGrossIncomeBruto} tone="positive" />
              </td>
              {hasBrutoRef && (
                <td className="py-2 px-3 text-right num font-mono font-semibold text-foreground whitespace-nowrap">
                  <MoneyText cents={dre.grossIncomeCents} tone="default" />
                </td>
              )}
              <td className="py-2 px-3 text-right num font-mono font-semibold whitespace-nowrap">100,0%</td>
            </tr>
            <tr>
              <td className="py-2 px-3 pl-6 text-foreground">
                (-) Despesas Operacionais Realizadas ({expenseCount} {expenseCount === 1 ? "gasto" : "gastos"})
              </td>
              <td className="py-2 px-3 text-right num font-mono font-semibold whitespace-nowrap">
                <MoneyText cents={effectiveTotalExpensesBruto} tone="negative" />
              </td>
              {hasBrutoRef && (
                <td className="py-2 px-3 text-right num font-mono font-semibold text-foreground whitespace-nowrap">
                  <MoneyText cents={dre.totalExpensesCents} tone="default" />
                </td>
              )}
              <td className="py-2 px-3 text-right num font-mono text-muted-foreground whitespace-nowrap">
                {effectiveGrossIncomeBruto > 0
                  ? `${formatPercent((effectiveTotalExpensesBruto / effectiveGrossIncomeBruto) * 100)}%`
                  : "—"}
              </td>
            </tr>
            <tr className="bg-muted/20 font-semibold">
              <td className="py-2 px-3 text-foreground">(=) Resultado Operacional do Período</td>
              <td className="py-2 px-3 text-right num font-mono font-bold whitespace-nowrap">
                <MoneyText
                  cents={effectiveGrossSavingsBruto}
                  tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"}
                />
              </td>
              {hasBrutoRef && (
                <td className="py-2 px-3 text-right num font-mono font-bold text-foreground whitespace-nowrap">
                  <MoneyText cents={dre.operationalSavingsCents} tone="default" />
                </td>
              )}
              <td className="py-2 px-3 text-right num font-mono whitespace-nowrap">
                {formatPercent(effectiveGrossSavingsRatePct)}%
              </td>
            </tr>
            <tr>
              <td className="py-2 px-3 pl-6 text-muted-foreground">
                (-) Aportes &amp; Investimentos Direcionados
              </td>
              <td className="py-2 px-3 text-right num font-mono text-muted-foreground whitespace-nowrap">
                {dre.investedAporteCents > 0 ? (
                  <MoneyText cents={dre.investedAporteCents} tone="default" />
                ) : (
                  "—"
                )}
              </td>
              {hasBrutoRef && (
                <td className="py-2 px-3 text-right num font-mono text-muted-foreground whitespace-nowrap">
                  {dre.investedAporteCents > 0 ? (
                    <MoneyText cents={dre.investedAporteCents} tone="default" />
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="py-2 px-3 text-right num font-mono text-muted-foreground whitespace-nowrap">
                {effectiveGrossIncomeBruto > 0 && dre.investedAporteCents > 0
                  ? `${formatPercent((dre.investedAporteCents / effectiveGrossIncomeBruto) * 100)}%`
                  : "—"}
              </td>
            </tr>
            <tr className="border-t-2 border-border/80 font-bold bg-muted/30">
              <td className="py-2.5 px-3 text-foreground font-bold">(=) Saldo Líquido de Caixa Final</td>
              <td className="py-2.5 px-3 text-right num font-mono font-bold whitespace-nowrap text-sm">
                <MoneyText
                  cents={netCashFlow}
                  tone={netCashFlow >= 0 ? "positive" : "negative"}
                />
              </td>
              {hasBrutoRef && (
                <td className="py-2.5 px-3 text-right num font-mono font-bold whitespace-nowrap text-sm text-foreground">
                  <MoneyText cents={dre.netCashFlowCents} tone="default" />
                </td>
              )}
              <td className="py-2.5 px-3 text-right num font-mono font-bold whitespace-nowrap text-xs">
                {effectiveGrossIncomeBruto > 0
                  ? `${formatPercent((netCashFlow / effectiveGrossIncomeBruto) * 100)}%`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {hasBrutoRef && (
        <p className="text-[10px] text-muted-foreground italic">
          * O valor principal exibido é o valor bruto nominal (100%). Os valores ponderados são informados para fins de consulta analítica.
        </p>
      )}
    </section>
  );
}
