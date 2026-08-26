import { Fragment } from "react";
import { Banknote, Landmark, PiggyBank, ReceiptText } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { ReportHeader, ReportKpiGrid, ReportFooter } from "./reports";
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
   * descrição, método de pagamento, cartão e parcela).
   */
  detailedCategories?: DetailedCloseCategory[];
  /** App + identidade do documento. */
  appName?: string;
  accountHolder?: string;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Fechamento do período imprimível (F22/F44) — documento executivo do mês, ano
 * ou período personalizado com folha de estilo de impressão própria (renderizado
 * dentro do portal `PrintSheet` com a classe `.print-sheet` + @media print).
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
  accountHolder,
}: MonthlyClosePrintViewProps) {
  const savingsLabel = totals.savingsRatePercent.toFixed(1).replace(".", ",");

  return (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title="Fechamento Consolidado do Período"
        subtitle="Fechamento do período"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      {/* 2. Grade de 4 KPIs Executivos */}
      <ReportKpiGrid
        columns={4}
        items={[
          {
            label: "Rendas",
            value: <MoneyText cents={totals.incomeCents} tone="positive" />,
            subtext: `${incomeCount} ${incomeCount === 1 ? "receita" : "receitas"}`,
            icon: Banknote,
            tone: "positive",
          },
          {
            label: "Despesas",
            value: <MoneyText cents={totals.expenseCents} tone="negative" />,
            subtext: `${expenseCount} ${expenseCount === 1 ? "despesa" : "despesas"}`,
            icon: ReceiptText,
            tone: "negative",
          },
          {
            label: "Saldo do mês",
            value: <MoneyText cents={totals.balanceCents} tone="default" />,
            subtext: totals.balanceCents >= 0 ? "Superávit" : "Déficit",
            icon: Landmark,
            tone: totals.balanceCents >= 0 ? "positive" : "negative",
          },
          {
            label: "Taxa de poupança",
            value: `${savingsLabel}%`,
            subtext: "Economia do Período",
            icon: PiggyBank,
            tone: "primary",
          },
        ]}
      />

      {/* 3. Despesas por categoria */}
      <section aria-label="Despesas por categoria" className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Despesas por categoria</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">Nenhuma despesa registrada no período.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/80 print:overflow-visible shadow-2xs">
            <table className="w-full min-w-[340px] sm:min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left">
                  <th className="py-2 px-2.5">Categoria</th>
                  <th className="py-2 px-2.5 text-right">Valor</th>
                  <th className="py-2 px-2.5 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((category) => (
                  <tr key={category.name} className="break-inside-avoid even:bg-muted/20 print:even:bg-slate-50/50">
                    <td className="py-1.5 px-2.5 font-bold text-foreground">{category.name}</td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums font-mono">
                      <MoneyText cents={category.totalCents} tone="negative" />
                    </td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums font-mono text-muted-foreground">
                      {category.pct.toFixed(1).replace(".", ",")}%
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-muted/40 border-t border-border/80 text-foreground break-inside-avoid">
                  <td className="py-2 px-2.5 uppercase text-[10px] tracking-wider">Total</td>
                  <td className="py-2 px-2.5 text-right tabular-nums font-mono">
                    <MoneyText cents={totals.expenseCents} tone="negative" />
                  </td>
                  <td className="py-2 px-2.5 text-right tabular-nums font-mono">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Despesas em detalhe (se houver) */}
      {detailedCategories.length > 0 ? (
        <section aria-label="Despesas em detalhe" className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Despesas em detalhe</h2>
          <p className="text-[11px] text-muted-foreground">
            Cada gasto do período separado por categoria e dia, com método de pagamento.
          </p>
          <div className="flex flex-col gap-3 pt-1">
            {detailedCategories.map((category) => (
              <div key={category.categoryId} className="break-inside-avoid">
                <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-1">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">{category.name}</span>
                  <span className="text-xs font-bold tabular-nums font-mono">
                    <MoneyText cents={category.totalCents} tone="negative" />
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border/80 mt-1.5 print:overflow-visible shadow-2xs">
                  <table className="w-full min-w-[420px] sm:min-w-full border-collapse text-xs">
                    <tbody>
                      {category.days.map((day) => (
                        <Fragment key={day.date}>
                          <tr className="bg-muted/40 font-bold text-muted-foreground border-b border-border/70 break-inside-avoid">
                            <td colSpan={3} className="py-1 px-2.5 text-[10px] uppercase tracking-wider">
                              {day.label} · {day.weekdayLabel}
                            </td>
                            <td className="py-1 px-2.5 text-right text-xs font-bold tabular-nums font-mono">
                              <MoneyText cents={day.totalCents} tone="negative" />
                            </td>
                          </tr>
                          {day.entries.map((entry) => (
                            <tr key={entry.id} className="border-b border-border/40 break-inside-avoid even:bg-muted/20 print:even:bg-slate-50/50">
                              <td className="py-1 px-2.5 pl-4 text-foreground font-medium">{entry.description}</td>
                              <td className="py-1 px-2.5 text-[11px] text-muted-foreground">
                                {entry.paymentMethodLabel}
                                {entry.cardName ? ` · ${entry.cardName}` : ""}
                              </td>
                              <td className="py-1 px-2.5 text-[11px] text-muted-foreground font-mono">
                                {entry.installmentLabel ?? ""}
                              </td>
                              <td className="py-1 px-2.5 text-right tabular-nums font-mono">
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

      {/* 5. Faturas quitadas */}
      <section aria-label="Faturas quitadas" className="flex flex-col gap-2 break-inside-avoid">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Faturas quitadas</h2>
        {paidInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">Nenhum pagamento de fatura no período.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/80 print:overflow-visible shadow-2xs">
            <table className="w-full min-w-[400px] sm:min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left">
                  <th className="py-2 px-2.5">Cartão</th>
                  <th className="py-2 px-2.5">Competência</th>
                  <th className="py-2 px-2.5 text-right">Valor</th>
                  <th className="py-2 px-2.5 text-right">Data do Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paidInvoices.map((invoice) => (
                  <tr
                    key={`${invoice.cardName}-${invoice.competenceMonth}-${invoice.date}-${invoice.amountCents}`}
                    className="break-inside-avoid even:bg-muted/20 print:even:bg-slate-50/50"
                  >
                    <td className="py-1.5 px-2.5 font-bold text-foreground">{invoice.cardName}</td>
                    <td className="py-1.5 px-2.5 tabular-nums font-mono text-muted-foreground">{invoice.competenceMonth}</td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums font-mono">
                      <MoneyText cents={invoice.amountCents} tone="negative" />
                    </td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums font-mono text-muted-foreground">{formatDate(invoice.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>


      {/* 6. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento gerado automaticamente — valores em reais (BRL)."
      />
    </div>
  );
}
