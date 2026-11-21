import { Fragment } from "react";
import { CreditCard, Landmark, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { formatDateBR } from "@/lib/date";
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
  appName = "Axir",
  accountHolder,
}: CardInvoicePrintViewProps) {
  return (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title={`Fatura de Cartão de Crédito — ${cardName}`}
        subtitle="Demonstrativo Analítico de Lançamentos, Rateio & Pagamentos"
        periodLabel={competenceLabel || `Competência ${competenceMonth}`}
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
              ) : (
                "Total consolidado"
              ),
            icon: CreditCard,
            tone: "negative",
          },
          {
            label: "Pago",
            value: <MoneyText cents={pagoCents} tone="positive" />,
            subtext: pagoCents > 0 ? "Pagamento liquidado" : "Nenhum pagamento registrado",
            icon: Landmark,
            tone: "positive",
          },
          {
            label: "Saldo aberto (bruto)",
            value: <MoneyText cents={saldoAbertoCents} tone={saldoAbertoCents > 0 ? "negative" : "positive"} />,
            subtext:
              saldoAbertoCents === 0 ? (
                <span className="text-positive-strong font-medium">Fatura quitada</span>
              ) : saldoPonderadoCents !== saldoAbertoCents ? (
                <span>Ponderado: <MoneyText cents={saldoPonderadoCents} className="inline text-[10px]" /></span>
              ) : (
                "Aguardando liquidação"
              ),
            icon: TrendingUp,
            tone: saldoAbertoCents > 0 ? "negative" : "positive",
          },
        ]}
      />

      {/* 3. Gastos da fatura (apenas o cartão da competência) */}
      <section aria-label="Gastos da fatura" className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">LANÇAMENTOS DA FATURA</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">Nenhum gasto lançado nesta competência.</p>
        ) : (
          <div className="w-full min-w-0 rounded-lg border border-border/80 bg-surface shadow-xs overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
            <table className="w-full min-w-[540px] sm:min-w-full print:min-w-0 print:w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "32%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left">
                  <th className="py-2 px-2.5">Data</th>
                  <th className="py-2 pl-2.5 pr-3.5">Descrição</th>
                  <th className="py-2 px-2">Categoria</th>
                  <th className="py-2 px-2.5 text-right">Valor (R$)</th>
                  <th className="py-2 px-2.5 text-right">Ponderado (R$)</th>
                  <th className="py-2 px-2.5 text-right">Parcelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {expenses.map((expense, index) => (
                  <Fragment key={`${expense.date}-${expense.description}-${index}`}>
                    <tr className="break-inside-avoid even:bg-muted/20 print:even:bg-muted/20">
                      <td className="py-1.5 px-2.5 tabular-nums font-mono text-muted-foreground whitespace-nowrap">{formatDateBR(expense.date)}</td>
                      <td className="py-1.5 pl-2.5 pr-3.5 font-bold text-foreground break-words whitespace-normal leading-tight line-clamp-2">{expense.description}</td>
                      <td className="py-1.5 px-2 text-[11px] text-muted-foreground break-words whitespace-normal leading-tight line-clamp-2">{expense.categoryName}</td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums font-mono whitespace-nowrap">
                        <MoneyText cents={expense.valueCents} tone="negative" hideCurrency />
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums font-mono text-muted-foreground whitespace-nowrap">
                        <MoneyText cents={expense.reportValueCents} tone="default" hideCurrency />
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums font-mono text-muted-foreground whitespace-nowrap">
                        {expense.installments &&
                        expense.installments.trim() !== "" &&
                        expense.installments.trim() !== "—" &&
                        expense.installments.trim() !== "1/1" &&
                        expense.installments.trim() !== "1x" &&
                        expense.installments.trim() !== "1" &&
                        !expense.installments.toLowerCase().includes("vista")
                          ? expense.installments
                          : "—"}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border/80 bg-muted/40 font-bold text-foreground break-inside-avoid">
                <tr>
                  <td className="py-2 px-2.5 uppercase text-[10px] tracking-wider" colSpan={3}>
                    Total ({expenses.length} {expenses.length === 1 ? "gasto" : "gastos"})
                  </td>
                  <td className="py-2 px-2.5 text-right tabular-nums font-mono whitespace-nowrap">
                    <MoneyText cents={totalBrutoCents} tone="negative" hideCurrency />
                  </td>
                  <td className="py-2 px-2.5 text-right tabular-nums font-mono whitespace-nowrap">
                    <MoneyText cents={totalPonderadoCents} tone="default" hideCurrency />
                  </td>
                  <td className="py-2 px-2.5 text-right" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* 4. Pagamentos e estornos da competência */}
      {payments.length > 0 ? (
        <section aria-label="Pagamentos e estornos" className="flex flex-col gap-2 break-inside-avoid">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Pagamentos e estornos</h2>
          <div className="w-full min-w-0 rounded-lg border border-border/80 bg-surface shadow-xs overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
            <table className="w-full min-w-[440px] sm:min-w-full print:min-w-0 print:w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "55%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left">
                  <th className="py-2 px-2.5">Data</th>
                  <th className="py-2 px-2.5">Descrição</th>
                  <th className="py-2 px-2.5 text-right">Valor (R$)</th>
                  <th className="py-2 px-2.5 text-right">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payments.map((payment, index) => (
                  <tr key={`${payment.date}-${payment.note}-${index}`} className="break-inside-avoid even:bg-muted/20 print:even:bg-muted/20">
                    <td className="py-1.5 px-2.5 tabular-nums font-mono text-muted-foreground whitespace-nowrap">{formatDateBR(payment.date)}</td>
                    <td className="py-1.5 px-2.5 font-bold text-foreground break-words whitespace-normal leading-tight line-clamp-2">
                      {payment.note || (payment.isRefund ? "Estorno" : "Pagamento de fatura")}
                    </td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums font-mono whitespace-nowrap">
                      <MoneyText cents={payment.amountCents} tone={payment.isRefund ? "positive" : "default"} hideCurrency />
                    </td>
                    <td className="py-1.5 px-2.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">
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
        disclaimer="Documento gerado automaticamente. Valores expressos em reais (BRL). Confira com a fatura enviada pelo banco."
        reportType="invoice"
        documentId={`FAT-${competenceMonth.replace("-", "")}-${cardName.slice(0, 3).toUpperCase()}`}
        currentPage={1}
        totalPages={1}
        showQrCode
      />
    </div>
  );
}
