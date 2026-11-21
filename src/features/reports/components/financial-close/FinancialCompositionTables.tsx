import { useMemo } from "react";
import { PieChart, Wallet } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent, formatSignedPct } from "@/services/masks";
import { sanitizeReportText } from "@/domain/reports";
import { cn } from "@/lib/utils";
import type {
  FinancialReportCategoryItem,
  FinancialReportPaidInvoiceItem,
  FinancialReportPaymentMethodItem,
} from "./financial-close-types";
import { FinancialPaidInvoicesSection } from "./FinancialPaidInvoicesSection";

export interface FinancialCompositionTablesProps {
  categories: readonly FinancialReportCategoryItem[];
  paymentMethods: readonly FinancialReportPaymentMethodItem[];
  paidInvoices?: readonly FinancialReportPaidInvoiceItem[];
  hasBrutoRef: boolean;
  hasBudgets: boolean;
}

export function FinancialCompositionTables({
  categories,
  paymentMethods,
  paidInvoices,
  hasBrutoRef,
  hasBudgets,
}: FinancialCompositionTablesProps) {
  // Ordenação decrescente por valor realizado para escaneabilidade contábil
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const valA = a.brutoCents ?? a.totalCents;
      const valB = b.brutoCents ?? b.totalCents;
      return valB - valA;
    });
  }, [categories]);

  const totalCatBudget = useMemo(() => {
    return categories.reduce((acc, c) => acc + (c.budgetLimitCents ?? 0), 0);
  }, [categories]);

  const totalCatRealizado = useMemo(() => {
    return categories.reduce((acc, c) => acc + (c.brutoCents ?? c.totalCents), 0);
  }, [categories]);

  const totalCatPonderado = useMemo(() => {
    return categories.reduce((acc, c) => acc + (c.ponderadoCents ?? c.totalCents), 0);
  }, [categories]);

  const totalCatDeviationPct = useMemo(() => {
    if (totalCatBudget <= 0) return null;
    return Math.round(((totalCatRealizado - totalCatBudget) / totalCatBudget) * 1000) / 10;
  }, [totalCatRealizado, totalCatBudget]);

  const sortedPaymentMethods = useMemo(() => {
    return [...paymentMethods].sort((a, b) => {
      const valA = a.brutoCents ?? a.totalCents;
      const valB = b.brutoCents ?? b.totalCents;
      return valB - valA;
    });
  }, [paymentMethods]);

  const totalPaymentRealizado = useMemo(() => {
    return paymentMethods.reduce((acc, m) => acc + (m.brutoCents ?? m.totalCents), 0);
  }, [paymentMethods]);

  return (
    <div className="flex flex-col gap-3 break-inside-avoid">
      {/* 1. Despesas por Categoria (100% de largura útil para evitar quebras em 3 linhas) */}
      <section aria-label="Despesas por Categoria" className="w-full flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 print:bg-surface print:border-border shadow-xs min-w-0">
        <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
          <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <span>DESPESAS POR CATEGORIA</span>
        </div>
        {sortedCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 italic">Nenhum gasto registrado no período.</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
            <table className="w-full min-w-[320px] sm:min-w-0 text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left bg-muted/40">
                  <th className="py-1.5 px-2 font-bold">Categoria</th>
                  {hasBudgets && <th className="py-1.5 px-2 text-right font-bold">Orçado (R$)</th>}
                  <th className="py-1.5 px-2 text-right font-bold">Realizado (R$)</th>
                  {hasBrutoRef && <th className="py-1.5 px-2 text-right font-bold">Ponderado (R$)</th>}
                  <th className="py-1.5 px-2 text-right font-bold">{hasBudgets ? "Desvio" : "% do Total"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedCategories.map((cat, idx) => {
                  const hasLimit = cat.budgetLimitCents != null && cat.budgetLimitCents > 0;
                  return (
                    <tr key={cat.name ?? `cat-${idx}`} className="even:bg-muted/20 print:even:bg-muted/20">
                      <td className="py-1.5 px-2 font-medium text-foreground">{sanitizeReportText(cat.name)}</td>
                      {hasBudgets && (
                        <td className="py-1.5 px-2 text-right num font-mono text-muted-foreground whitespace-nowrap">
                          {hasLimit ? <MoneyText cents={cat.budgetLimitCents!} tone="default" hideCurrency /> : "—"}
                        </td>
                      )}
                      <td className="py-1.5 px-2 text-right num font-mono whitespace-nowrap">
                        <MoneyText cents={cat.brutoCents ?? cat.totalCents} tone="negative" className="font-bold" hideCurrency />
                      </td>
                      {hasBrutoRef && (
                        <td className="py-1.5 px-2 text-right num font-mono whitespace-nowrap text-muted-foreground">
                          {cat.ponderadoCents !== undefined ? (
                            <MoneyText cents={cat.ponderadoCents} tone="default" hideCurrency />
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="py-1.5 px-2 text-right num font-mono whitespace-nowrap">
                        {hasBudgets ? (
                          hasLimit ? (
                            (() => {
                              const vPct =
                                cat.variancePct != null
                                  ? cat.variancePct
                                  : Math.round(((cat.totalCents - cat.budgetLimitCents!) / cat.budgetLimitCents!) * 1000) / 10;
                              return (
                                <span
                                  className={cn(
                                    "font-semibold tabular-nums text-[11px]",
                                    vPct > 0 ? "text-critical-strong" : "text-positive-strong",
                                  )}
                                >
                                  {formatSignedPct(vPct)}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">{formatPercent(cat.pct)}%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border/80 bg-muted/30 font-bold text-foreground">
                <tr>
                  <td className="py-1.5 px-2 uppercase text-[10px] font-bold text-muted-foreground">Total</td>
                  {hasBudgets && (
                    <td className="py-1.5 px-2 text-right num font-mono font-bold whitespace-nowrap">
                      {totalCatBudget > 0 ? <MoneyText cents={totalCatBudget} tone="default" hideCurrency /> : "—"}
                    </td>
                  )}
                  <td className="py-1.5 px-2 text-right num font-mono font-bold whitespace-nowrap">
                    <MoneyText cents={totalCatRealizado} tone="negative" hideCurrency />
                  </td>
                  {hasBrutoRef && (
                    <td className="py-1.5 px-2 text-right num font-mono font-bold whitespace-nowrap">
                      <MoneyText cents={totalCatPonderado} tone="default" hideCurrency />
                    </td>
                  )}
                  <td className="py-1.5 px-2 text-right num font-mono font-bold text-muted-foreground whitespace-nowrap">
                    {hasBudgets ? (
                      totalCatDeviationPct !== null ? (
                        <span
                          className={cn(
                            "tabular-nums text-[11px]",
                            totalCatDeviationPct > 0 ? "text-critical-strong" : "text-positive-strong",
                          )}
                        >
                          {formatSignedPct(totalCatDeviationPct)}
                        </span>
                      ) : (
                        "—"
                      )
                    ) : (
                      "100,0%"
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Linha Inferior: Formas de Pagamento e Faturas de Cartão Quitadas */}
      <div className={cn("grid gap-3 break-inside-avoid", paidInvoices && paidInvoices.length > 0 ? "grid-cols-1 sm:grid-cols-2 print:grid-cols-2" : "grid-cols-1")}>
        {/* 2. Formas de Pagamento */}
        <section aria-label="Formas de Pagamento" className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 print:bg-surface print:border-border shadow-xs min-w-0">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
            <Wallet className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
            <span>FORMAS DE PAGAMENTO</span>
          </div>
          {sortedPaymentMethods.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">Nenhuma transação registrada no período.</p>
          ) : (
            <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
              <table className="w-full min-w-[300px] sm:min-w-0 text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left bg-muted/40">
                    <th className="py-1.5 px-2 font-bold">Meio de Pagamento</th>
                    <th className="py-1.5 px-2 text-right font-bold">{hasBrutoRef ? "Valor Bruto (R$)" : "Total (R$)"}</th>
                    <th className="py-1.5 px-2 text-right font-bold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedPaymentMethods.map((pm, idx) => {
                    const label = pm.label ?? pm.method;
                    return (
                      <tr key={label ?? `pm-${idx}`} className="even:bg-muted/20 print:even:bg-muted/20">
                        <td className="py-1.5 px-2 font-medium text-foreground">{sanitizeReportText(label)}</td>
                        <td className="py-1.5 px-2 text-right num font-mono font-bold whitespace-nowrap">
                          <MoneyText cents={pm.brutoCents ?? pm.totalCents} tone="default" hideCurrency />
                        </td>
                        <td className="py-1.5 px-2 text-right num font-mono text-muted-foreground whitespace-nowrap">
                          {formatPercent(pm.pct)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border/80 bg-muted/30 font-bold text-foreground">
                  <tr>
                    <td className="py-1.5 px-2 uppercase text-[10px] font-bold text-muted-foreground">Total</td>
                    <td className="py-1.5 px-2 text-right num font-mono font-bold whitespace-nowrap">
                      <MoneyText cents={totalPaymentRealizado} tone="default" hideCurrency />
                    </td>
                    <td className="py-1.5 px-2 text-right num font-mono font-bold text-muted-foreground whitespace-nowrap">
                      100,0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* 3. Faturas Quitadas no Período */}
        {paidInvoices && paidInvoices.length > 0 && (
          <FinancialPaidInvoicesSection paidInvoices={paidInvoices} />
        )}
      </div>
    </div>
  );
}
