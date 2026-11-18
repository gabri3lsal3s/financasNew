import { PieChart, Wallet } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks/percent";
import { sanitizeReportText } from "@/domain/reports";
import { cn } from "@/lib/utils";
import type {
  FinancialReportCategoryItem,
  FinancialReportPaymentMethodItem,
} from "./financial-close-types";

export interface FinancialCompositionTablesProps {
  categories: readonly FinancialReportCategoryItem[];
  paymentMethods: readonly FinancialReportPaymentMethodItem[];
  hasBrutoRef: boolean;
  hasBudgets: boolean;
}

export function FinancialCompositionTables({
  categories,
  paymentMethods,
  hasBrutoRef,
  hasBudgets,
}: FinancialCompositionTablesProps) {
  return (
    <section aria-label="Composição de Gastos" className="grid grid-cols-1 sm:grid-cols-2 gap-3 break-inside-avoid print:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 print:bg-surface print:border-border shadow-xs min-w-0">
        <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
          <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <span>DESPESAS POR CATEGORIA</span>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 italic">Nenhum gasto registrado no período.</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
            <table className="w-full min-w-[320px] sm:min-w-0 text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left bg-muted/40">
                  <th className="py-1 px-1.5 font-bold">Categoria</th>
                  {hasBudgets && <th className="py-1 px-1.5 text-right font-bold">Orçado</th>}
                  <th className="py-1 px-1.5 text-right font-bold">Realizado</th>
                  <th className="py-1 px-1.5 text-right font-bold">{hasBudgets ? "Desvio" : "%"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {categories.map((cat) => {
                  const hasLimit = cat.budgetLimitCents != null && cat.budgetLimitCents > 0;
                  return (
                    <tr key={cat.name} className="even:bg-muted/20 print:even:bg-muted/20">
                      <td className="py-1.5 px-1.5 font-medium text-foreground">{sanitizeReportText(cat.name)}</td>
                      {hasBudgets && (
                        <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground whitespace-nowrap">
                          {hasLimit ? <MoneyText cents={cat.budgetLimitCents!} /> : "—"}
                        </td>
                      )}
                      <td className="py-1.5 px-1.5 text-right num font-mono whitespace-nowrap">
                        <MoneyText cents={cat.brutoCents ?? cat.totalCents} tone="negative" className="font-bold" />
                        {hasBrutoRef && cat.brutoCents !== undefined && cat.ponderadoCents !== undefined && cat.brutoCents !== cat.ponderadoCents && (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            Ponderado: <MoneyText cents={cat.ponderadoCents} tone="default" className="inline text-[10px]" />
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-1.5 text-right num font-mono whitespace-nowrap">
                        {hasBudgets && hasLimit && cat.variancePct != null ? (
                          <span
                            className={cn(
                              "font-semibold tabular-nums text-[11px]",
                              cat.variancePct > 0 ? "text-critical-strong" : "text-positive-strong",
                            )}
                          >
                            {cat.variancePct > 0 ? `+${cat.variancePct}%` : `${cat.variancePct}%`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{formatPercent(cat.pct)}%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 print:bg-surface print:border-border shadow-xs min-w-0">
        <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
          <Wallet className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <span>FORMAS DE PAGAMENTO</span>
        </div>
        {paymentMethods.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 italic">Nenhuma transação registrada no período.</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
            <table className="w-full min-w-[300px] sm:min-w-0 text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left bg-muted/40">
                  <th className="py-1 px-1.5 font-bold">Meio de Pagamento</th>
                  <th className="py-1 px-1.5 text-right font-bold">Total Bruto</th>
                  <th className="py-1 px-1.5 text-right font-bold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paymentMethods.map((pm) => (
                  <tr key={pm.method} className="even:bg-muted/20 print:even:bg-muted/20">
                    <td className="py-1.5 px-1.5 font-medium text-foreground">{sanitizeReportText(pm.label)}</td>
                    <td className="py-1.5 px-1.5 text-right num font-mono whitespace-nowrap">
                      <MoneyText cents={pm.brutoCents ?? pm.totalCents} tone="default" className="font-bold" />
                      {hasBrutoRef && pm.brutoCents !== undefined && pm.ponderadoCents !== undefined && pm.brutoCents !== pm.ponderadoCents && (
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          Ponderado: <MoneyText cents={pm.ponderadoCents} tone="default" className="inline text-[10px]" />
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground whitespace-nowrap">
                      {formatPercent(pm.pct)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
