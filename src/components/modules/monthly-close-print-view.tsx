import { Banknote, Landmark, PiggyBank, ReceiptText, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { monthLabel } from "@/lib/date";
import type { OverviewTotals } from "@/domain/overview";

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
  /** YYYY-MM */
  month: string;
  totals: OverviewTotals;
  expenseCount: number;
  incomeCount: number;
  categories: MonthlyCloseCategory[];
  paidInvoices: MonthlyCloseInvoice[];
  /** App + identidade do documento. */
  appName?: string;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Fechamento mensal imprimível (F22) — documento executivo do mês com
 * folha de estilo de impressão própria (classe `.print-area` + @media print
 * em globals.css). Valores SEMPRE em centavos (entrada) e REAIS (não
 * ponderados pelo peso de relatório — é um fechamento financeiro).
 */
export function MonthlyClosePrintView({
  month,
  totals,
  expenseCount,
  incomeCount,
  categories,
  paidInvoices,
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
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground">
      {/* Cabeçalho do documento */}
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="size-5 text-primary-strong" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight">{appName}</span>
            <span className="text-xs text-muted-foreground">Fechamento Mensal</span>
          </div>
        </div>
        <div className="flex flex-col items-end text-right text-xs text-muted-foreground">
          <span className="font-semibold text-sm text-foreground">{monthLabel(month)}</span>
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
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma despesa registrada no mês.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
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
        )}
      </section>

      {/* Faturas quitadas */}
      <section aria-label="Faturas quitadas">
        <h2 className="text-sm font-semibold text-foreground">Faturas quitadas</h2>
        {paidInvoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum pagamento de fatura no mês.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
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
        )}
      </section>

      <footer className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
        Documento gerado automaticamente — valores em reais (BRL).
      </footer>
    </div>
  );
}
