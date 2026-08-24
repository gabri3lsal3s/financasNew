import { Fragment } from "react";
import { CreditCard, Landmark, ReceiptText, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { ReportHeader, ReportKpiGrid, ReportFooter } from "./reports";

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
  accountHolder?: string;
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
 * globals.css): paleta clara fixa, tipografia única e paginação multi-página.
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
  accountHolder,
}: CardInvoicePrintViewProps) {
  return (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title={`${cardName} · ${competenceLabel}`}
        subtitle="Fatura de cartão de crédito"
        periodLabel={`Competência ${competenceMonth}`}
        appName={appName}
        icon={CreditCard}
        accountHolder={accountHolder}
      />

      {/* 2. Grade de 3 KPIs da Fatura */}
      <ReportKpiGrid
        columns={3}
        items={[
          {
            label: "Fatura total (bruto)",
            value: <MoneyText cents={totalBrutoCents} tone="negative" />,
            subtext:
              totalBrutoCents !== totalPonderadoCents ? (
                <span>Ponderada: <MoneyText cents={totalPonderadoCents} className="inline text-[10px]" /></span>
              ) : undefined,
            icon: ReceiptText,
            tone: "negative",
          },
          {
            label: "Pago",
            value: <MoneyText cents={pagoCents} tone="positive" />,
            icon: Landmark,
            tone: "positive",
          },
          {
            label: "Saldo aberto (bruto)",
            value: <MoneyText cents={saldoAbertoCents} tone={saldoAbertoCents > 0 ? "negative" : "positive"} />,
            subtext:
              saldoPonderadoCents !== saldoAbertoCents ? (
                <span>Ponderado: <MoneyText cents={saldoPonderadoCents} className="inline text-[10px]" /></span>
              ) : undefined,
            icon: TrendingUp,
            tone: saldoAbertoCents > 0 ? "negative" : "positive",
          },
        ]}
      />

      {/* 3. Gastos da fatura (apenas o cartão da competência) */}
      <section aria-label="Gastos da fatura" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Gastos da fatura</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">Nenhum gasto lançado nesta competência.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80 print:overflow-visible">
            <table className="w-full min-w-[540px] sm:min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 px-2 font-medium">Data</th>
                  <th className="py-1.5 px-2 font-medium">Descrição</th>
                  <th className="py-1.5 px-2 font-medium">Categoria</th>
                  <th className="py-1.5 px-2 text-right font-medium">Valor (R$)</th>
                  <th className="py-1.5 px-2 text-right font-medium">Valor p/ relatório</th>
                  <th className="py-1.5 px-2 text-right font-medium">Parcelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {expenses.map((expense, index) => (
                  <Fragment key={`${expense.date}-${expense.description}-${index}`}>
                    <tr className="hover:bg-muted/20">
                      <td className="py-1.5 px-2 tabular-nums">{formatDate(expense.date)}</td>
                      <td className="py-1.5 px-2 font-medium text-foreground">{expense.description}</td>
                      <td className="py-1.5 px-2 text-xs text-muted-foreground">{expense.categoryName}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        <MoneyText cents={expense.valueCents} tone="negative" />
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        <MoneyText cents={expense.reportValueCents} tone="default" />
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{expense.installments}</td>
                    </tr>
                  </Fragment>
                ))}
                <tr className="font-semibold bg-muted/30 border-t border-border">
                  <td className="py-2 px-2" colSpan={3}>
                    Total ({expenses.length} {expenses.length === 1 ? "gasto" : "gastos"})
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    <MoneyText cents={totalBrutoCents} tone="negative" />
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    <MoneyText cents={totalPonderadoCents} tone="default" />
                  </td>
                  <td className="py-2 px-2 text-right" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Pagamentos e estornos da competência */}
      {payments.length > 0 ? (
        <section aria-label="Pagamentos e estornos" className="flex flex-col gap-2 break-inside-avoid">
          <h2 className="text-sm font-semibold text-foreground">Pagamentos e estornos</h2>
          <div className="overflow-x-auto rounded-xl border border-border/80 print:overflow-visible">
            <table className="w-full min-w-[440px] sm:min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 px-2 font-medium">Data</th>
                  <th className="py-1.5 px-2 font-medium">Descrição</th>
                  <th className="py-1.5 px-2 text-right font-medium">Valor (R$)</th>
                  <th className="py-1.5 px-2 text-right font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payments.map((payment, index) => (
                  <tr key={`${payment.date}-${payment.note}-${index}`} className="hover:bg-muted/20">
                    <td className="py-1.5 px-2 tabular-nums">{formatDate(payment.date)}</td>
                    <td className="py-1.5 px-2 font-medium text-foreground">
                      {payment.note || (payment.isRefund ? "Estorno" : "Pagamento de fatura")}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      <MoneyText cents={payment.amountCents} tone={payment.isRefund ? "positive" : "negative"} />
                    </td>
                    <td className="py-1.5 px-2 text-right text-xs text-muted-foreground">
                      {payment.isRefund ? "Estorno" : "Pagamento"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* 5. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento gerado automaticamente — valores em reais (BRL). Confira com a fatura enviada pelo banco."
      />
    </div>
  );
}
