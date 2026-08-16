import { Fragment } from "react";
import { CreditCard, Landmark, ReceiptText, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";

export interface CardInvoiceExpenseRow {
  /** YYYY-MM-DD. */
  date: string;
  description: string;
  categoryName: string;
  valueCents: number;
  /** Valor com peso de relatório aplicado (report_weight). */
  reportValueCents: number;
  /** Ex.: "2/3" ou "—" (à vista). */
  installments: string;
}

export interface CardInvoicePaymentRow {
  /** YYYY-MM-DD. */
  date: string;
  note: string | null;
  amountCents: number;
  /** true = estorno. */
  isRefund: boolean;
}

export interface CardInvoicePrintViewProps {
  cardName: string;
  /** Competência da fatura (YYYY-MM). */
  competenceMonth: string;
  /** Rótulo amigável da competência (ex.: "Agosto de 2026"). */
  competenceLabel: string;
  totalBrutoCents: number;
  totalPonderadoCents: number;
  pagoCents: number;
  saldoAbertoCents: number;
  /** Saldo aberto com peso de relatório aplicado (diferente do bruto quando há pesos). */
  saldoPonderadoCents: number;
  /** Apenas os gastos lançados no cartão da competência. */
  expenses: CardInvoiceExpenseRow[];
  payments?: CardInvoicePaymentRow[];
  appName?: string;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Fatura do cartão imprimível (PDF) — documento executivo da competência com
 * APENAS os gastos lançados no cartão (compara com a fatura do banco).
 * Renderizado dentro do portal `PrintSheet` (`.print-sheet` + @media print em
 * globals.css): paleta clara fixa, tipografia única e paginação multi-página
 * em QUALQUER tema do app.
 */
export function CardInvoicePrintView({
  cardName,
  competenceMonth,
  competenceLabel,
  totalBrutoCents,
  totalPonderadoCents,
  pagoCents,
  saldoAbertoCents,
  saldoPonderadoCents,
  expenses,
  payments = [],
  appName = "Finanças Pessoais",
}: CardInvoicePrintViewProps) {
  const generatedAt = formatDate(new Date().toISOString().slice(0, 10));

  return (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground">
      {/* Cabeçalho do documento */}
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <CreditCard className="size-5 text-primary-strong" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight">{appName}</span>
            <span className="text-xs text-muted-foreground">Fatura de cartão de crédito</span>
          </div>
        </div>
        <div className="flex flex-col items-end text-right text-xs text-muted-foreground">
          <span className="font-semibold text-sm text-foreground">
            {cardName} · {competenceLabel}
          </span>
          <span>Competência {competenceMonth} · Gerado em {generatedAt}</span>
        </div>
      </header>

      {/* KPIs da fatura */}
      <section aria-label="Resumo da fatura">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ReceiptText className="size-3.5" aria-hidden="true" />
              Fatura total (bruto)
            </div>
            <div className="mt-1.5 text-lg font-semibold">
              <MoneyText cents={totalBrutoCents} tone="default" />
            </div>
            {totalBrutoCents !== totalPonderadoCents ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Ponderada: <MoneyText cents={totalPonderadoCents} tone="default" />
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Landmark className="size-3.5" aria-hidden="true" />
              Pago
            </div>
            <div className="mt-1.5 text-lg font-semibold">
              <MoneyText cents={pagoCents} tone="positive" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              Saldo aberto (bruto)
            </div>
            <div className="mt-1.5 text-lg font-semibold">
              <MoneyText cents={saldoAbertoCents} tone={saldoAbertoCents > 0 ? "negative" : "positive"} />
            </div>
            {saldoPonderadoCents !== saldoAbertoCents ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Ponderado: <MoneyText cents={saldoPonderadoCents} tone="default" />
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Gastos da fatura (apenas o cartão da competência) */}
      <section aria-label="Gastos da fatura">
        <h2 className="text-sm font-semibold text-foreground">Gastos da fatura</h2>
        {expenses.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum gasto lançado nesta competência.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Data</th>
                <th className="py-1.5 pr-2 font-medium">Descrição</th>
                <th className="py-1.5 pr-2 font-medium">Categoria</th>
                <th className="py-1.5 pr-2 text-right font-medium">Valor (R$)</th>
                <th className="py-1.5 pr-2 text-right font-medium">Valor p/ relatório</th>
                <th className="py-1.5 text-right font-medium">Parcelas</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => (
                <Fragment key={`${expense.date}-${expense.description}-${index}`}>
                  <tr className="border-b border-border/60">
                    <td className="py-1.5 pr-2 tabular-nums">{formatDate(expense.date)}</td>
                    <td className="py-1.5 pr-2">{expense.description}</td>
                    <td className="py-1.5 pr-2 text-xs text-muted-foreground">{expense.categoryName}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      <MoneyText cents={expense.valueCents} tone="negative" />
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      <MoneyText cents={expense.reportValueCents} tone="default" />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{expense.installments}</td>
                  </tr>
                </Fragment>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-2" colSpan={3}>
                  Total ({expenses.length} {expenses.length === 1 ? "gasto" : "gastos"})
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  <MoneyText cents={totalBrutoCents} tone="negative" />
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  <MoneyText cents={totalPonderadoCents} tone="default" />
                </td>
                <td className="py-2 text-right" />
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Pagamentos e estornos da competência */}
      {payments.length > 0 ? (
        <section aria-label="Pagamentos e estornos">
          <h2 className="text-sm font-semibold text-foreground">Pagamentos e estornos</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Data</th>
                <th className="py-1.5 pr-2 font-medium">Descrição</th>
                <th className="py-1.5 pr-2 text-right font-medium">Valor (R$)</th>
                <th className="py-1.5 text-right font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr key={`${payment.date}-${payment.note}-${index}`} className="border-b border-border/60">
                  <td className="py-1.5 pr-2 tabular-nums">{formatDate(payment.date)}</td>
                  <td className="py-1.5 pr-2">{payment.note || (payment.isRefund ? "Estorno" : "Pagamento de fatura")}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    <MoneyText cents={payment.amountCents} tone={payment.isRefund ? "positive" : "negative"} />
                  </td>
                  <td className="py-1.5 text-right text-xs text-muted-foreground">
                    {payment.isRefund ? "Estorno" : "Pagamento"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
        Documento gerado automaticamente — valores em reais (BRL). Confira com a fatura enviada pelo banco.
      </footer>
    </div>
  );
}
