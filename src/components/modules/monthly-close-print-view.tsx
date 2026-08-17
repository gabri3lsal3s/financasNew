import { Fragment } from "react";
import { Banknote, Landmark, PiggyBank, ReceiptText, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import type { OverviewTotals } from "@/domain/overview";
import type { DetailedCloseCategory } from "@/domain/reports";

export interface MonthlyCloseCategory {
  name: string;
  totalCents: number;
  /** % do total de despesas do mês (0–100). */
  pct: number;
}

export interface MonthlyCloseInvoice {
  cardName: string;
  competenceMonth: string;
  amountCents: number;
  /** YYYY-MM-DD (data do pagamento). */
  date: string;
}

export interface MonthlyClosePrintViewProps {
  /** Rótulo do período (ex.: "Agosto de 2026", "2026", "01/01/2026 a 31/01/2026"). */
  periodLabel: string;
  totals: OverviewTotals;
  expenseCount: number;
  incomeCount: number;
  categories: MonthlyCloseCategory[];
  paidInvoices: MonthlyCloseInvoice[];
  /**
   * F22 evolução — despesas em detalhe (categoria → dia → gasto com
   * descrição, método de pagamento, cartão e parcela). Quando presente e
   * não vazio, renderiza a seção "Despesas em detalhe" após o resumo.
   */
  detailedCategories?: DetailedCloseCategory[];
  /** App + identidade do documento. */
  appName?: string;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Fechamento do período imprimível (F22) — documento executivo do mês, ano
 * ou período personalizado com folha de estilo de impressão própria (é
 * renderizado dentro do portal `PrintSheet` com a classe `.print-sheet` +
 * @media print em globals.css). Valores SEMPRE em centavos (entrada) e REAIS
 * (não ponderados pelo peso de relatório — é um fechamento financeiro).
 */
export function MonthlyClosePrintView({
  periodLabel,
  totals,
  expenseCount,
  incomeCount,
  categories,
  paidInvoices,
  detailedCategories = [],
  appName = "Finanças Pessoais",
}: MonthlyClosePrintViewProps) {
  const generatedAt = formatDate(new Date().toISOString().slice(0, 10));
  const savingsLabel = totals.savingsRatePercent.toFixed(1).replace(".", ",");

  const kpis = [
    {
      label: "Rendas",
      icon: Banknote,
      value: <MoneyText cents={totals.incomeCents} tone="positive" />,
    },
    {
      label: "Despesas",
      icon: ReceiptText,
      value: <MoneyText cents={totals.expenseCents} tone="negative" />,
    },
    {
      label: "Saldo do mês",
      icon: Landmark,
      value: <MoneyText cents={totals.balanceCents} tone="default" />,
    },
    {
      label: "Taxa de poupança",
      icon: PiggyBank,
      value: <span>{savingsLabel}%</span>,
    },
  ];

  return (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* Cabeçalho do documento */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 border-b border-border pb-4 print:flex-row print:items-start">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight">{appName}</span>
            <span className="text-xs text-muted-foreground">Fechamento do período</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground print:items-end print:text-right">
          <span className="font-semibold text-sm text-foreground">{periodLabel}</span>
          <span>Gerado em {generatedAt}</span>
        </div>
      </header>

      {/* KPIs executivos */}
      <section aria-label="Resumo do mês">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <kpi.icon className="size-3.5" aria-hidden="true" />
                {kpi.label}
              </div>
              <div className="mt-1.5 text-lg font-semibold">{kpi.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {incomeCount} {incomeCount === 1 ? "receita" : "receitas"} · {expenseCount}{" "}
          {expenseCount === 1 ? "despesa" : "despesas"} no período.
        </p>
      </section>

      {/* Despesas por categoria */}
      <section aria-label="Despesas por categoria">
        <h2 className="text-sm font-semibold text-foreground">Despesas por categoria</h2>
        {categories.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma despesa registrada no período.</p>
        ) : (
          <div className="mt-2 w-full overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[340px] sm:min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Categoria</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Valor</th>
                  <th className="py-1.5 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.name} className="border-b border-border/60">
                    <td className="py-1.5 pr-2">{category.name}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      <MoneyText cents={category.totalCents} tone="negative" />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{category.pct.toFixed(1).replace(".", ",")}%</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 pr-2">Total</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    <MoneyText cents={totals.expenseCents} tone="negative" />
                  </td>
                  <td className="py-2 text-right tabular-nums">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Despesas em detalhe (F22 evolução) — categoria → dia → gasto com
          descrição, método de pagamento, cartão e parcela (mês, ano ou custom). */}
      {detailedCategories.length > 0 ? (
        <section aria-label="Despesas em detalhe">
          <h2 className="text-sm font-semibold text-foreground">Despesas em detalhe</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada gasto do período separado por categoria e dia, com método de pagamento.
          </p>
          <div className="mt-3 flex flex-col gap-4">
            {detailedCategories.map((category) => (
              <div key={category.categoryId} className="break-inside-avoid">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
                  <span className="text-xs font-semibold text-foreground">{category.name}</span>
                  <span className="text-xs font-semibold tabular-nums">
                    <MoneyText cents={category.totalCents} tone="negative" />
                  </span>
                </div>
                <div className="w-full overflow-x-auto print:overflow-visible">
                  <table className="w-full min-w-[420px] sm:min-w-full border-collapse text-sm">
                    <tbody>
                      {category.days.map((day) => (
                        <Fragment key={day.date}>
                          <tr className="bg-muted/40">
                            <td colSpan={3} className="py-1.5 pl-2 text-xs font-medium text-muted-foreground">
                              {day.label} · {day.weekdayLabel}
                            </td>
                            <td className="py-1.5 pr-2 text-right text-xs font-semibold tabular-nums">
                              <MoneyText cents={day.totalCents} tone="negative" />
                            </td>
                          </tr>
                          {day.entries.map((entry) => (
                            <tr key={entry.id} className="border-b border-border/40">
                              <td className="py-1 pl-4 pr-2">{entry.description}</td>
                              <td className="py-1 pr-2 text-xs text-muted-foreground">
                                {entry.paymentMethodLabel}
                                {entry.cardName ? ` · ${entry.cardName}` : ""}
                              </td>
                              <td className="py-1 pr-2 text-xs text-muted-foreground">
                                {entry.installmentLabel ?? ""}
                              </td>
                              <td className="py-1 pr-2 text-right tabular-nums">
                                <MoneyText cents={entry.valueCents} tone="negative" />
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Faturas quitadas */}
      <section aria-label="Faturas quitadas">
        <h2 className="text-sm font-semibold text-foreground">Faturas quitadas</h2>
        {paidInvoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum pagamento de fatura no período.</p>
        ) : (
          <div className="mt-2 w-full overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[400px] sm:min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Cartão</th>
                  <th className="py-1.5 pr-2 font-medium">Competência</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Valor</th>
                  <th className="py-1.5 text-right font-medium">Data do pagamento</th>
                </tr>
              </thead>
              <tbody>
                {paidInvoices.map((invoice) => (
                  <tr key={`${invoice.cardName}-${invoice.competenceMonth}-${invoice.date}-${invoice.amountCents}`} className="border-b border-border/60">
                    <td className="py-1.5 pr-2">{invoice.cardName}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{invoice.competenceMonth}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      <MoneyText cents={invoice.amountCents} tone="negative" />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatDate(invoice.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
        Documento gerado automaticamente — valores em reais (BRL).
      </footer>
    </div>
  );
}
