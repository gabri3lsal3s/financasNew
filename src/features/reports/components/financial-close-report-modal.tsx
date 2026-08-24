import { usePrint } from "@/components/ui";
import {
  Banknote,
  Landmark,
  PieChart,
  PiggyBank,
  Printer,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button, Modal } from "@/components/ui";

import { MoneyText } from "@/components/ui/money-text";
import { PrintSheet } from "@/components/ui/print-sheet";
import { formatPercent } from "@/services/masks/percent";

export interface FinancialDREData {
  grossIncomeCents: number;
  totalExpensesCents: number;
  operationalSavingsCents: number;
  savingsRatePct: number;
  investedAporteCents: number;
  netCashFlowCents: number;
  /** Valor bruto (sem ponderação) de receitas — exibido quando pesos estão ativos. */
  grossIncomeBrutoCents?: number;
  /** Valor bruto (sem ponderação) de despesas — exibido quando pesos estão ativos. */
  totalExpensesBrutoCents?: number;
}

export interface FinancialReportCategoryItem {
  name: string;
  totalCents: number;
  pct: number;
}

export interface FinancialReportPaymentMethodItem {
  method: string;
  label: string;
  totalCents: number;
  pct: number;
}

export interface FinancialReportPaidInvoiceItem {
  cardName: string;
  competenceMonth: string;
  amountCents: number;
  date: string;
}

export interface FinancialCloseReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel: string;
  appName?: string;
  dre: FinancialDREData;
  categories: readonly FinancialReportCategoryItem[];
  paymentMethods: readonly FinancialReportPaymentMethodItem[];
  paidInvoices?: readonly FinancialReportPaidInvoiceItem[];
  expenseCount: number;
  incomeCount: number;
  /** Quando true, exibe linha de bruto vs. ponderado na DRE. */
  showWeightedNote?: boolean;
}

function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/**
 * Modal Executivo de Finanças Pessoais & DRE (F42).
 * Exibe a Demonstração do Resultado do Exercício (DRE Pessoal),
 * composição de despesas e impressão padronizada A4 / PDF.
 */
export function FinancialCloseReportModal({
  open,
  onOpenChange,
  periodLabel,
  appName = "Finanças Pessoais",
  dre,
  categories,
  paymentMethods,
  paidInvoices = [],
  expenseCount,
  incomeCount,
  showWeightedNote = false,
}: FinancialCloseReportModalProps) {
  const { printing, triggerPrint } = usePrint();
  const generatedAt = new Date().toLocaleDateString("pt-BR");

  const hasBrutoRef =
    showWeightedNote &&
    (dre.grossIncomeBrutoCents !== undefined || dre.totalExpensesBrutoCents !== undefined);


  const reportContent = (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* Cabeçalho Institucional do Documento */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4 print:flex-row print:items-start">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary-strong">
            <TrendingUp className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-foreground">{appName}</span>
            <span className="text-xs text-muted-foreground">Relatório de Finanças Pessoais &amp; DRE</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground print:items-end print:text-right">
          <span className="font-semibold text-sm text-foreground">{periodLabel}</span>
          <span>Emitido em {generatedAt}</span>
        </div>
      </header>

      {/* Grade de KPIs do Período */}
      <section aria-label="Resumo Financeiro" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Banknote className="size-3.5" aria-hidden="true" />
            <span>Receitas Totais</span>
          </div>
          <MoneyText cents={dre.grossIncomeCents} tone="positive" className="text-base sm:text-lg font-bold" />
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ReceiptText className="size-3.5" aria-hidden="true" />
            <span>Despesas Totais</span>
          </div>
          <MoneyText cents={dre.totalExpensesCents} tone="negative" className="text-base sm:text-lg font-bold" />
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Landmark className="size-3.5" aria-hidden="true" />
            <span>Resultado Operacional</span>
          </div>
          <MoneyText
            cents={dre.operationalSavingsCents}
            tone={dre.operationalSavingsCents >= 0 ? "positive" : "negative"}
            className="text-base sm:text-lg font-bold"
          />
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <PiggyBank className="size-3.5" aria-hidden="true" />
            <span>Taxa de Poupança</span>
          </div>
          <span className="text-base sm:text-lg font-bold font-display text-primary-strong">
            {formatPercent(dre.savingsRatePct)}
          </span>
        </div>
      </section>

      {/* Seção 1: Demonstração do Resultado do Exercício (DRE Pessoal) */}
      <section aria-label="Demonstração do Resultado do Exercício" className="break-inside-avoid flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Landmark className="size-4 text-primary-strong" aria-hidden="true" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            DRE Pessoal — Demonstração do Período
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-2.5 px-3">Linha / Estrutura Contábil</th>
                <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                <th className="py-2.5 px-3 text-right">% Receita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr className="bg-positive/5">
                <td className="py-2 px-3 font-semibold text-positive-strong">
                  (+) Receita Operacional Bruta ({incomeCount} {incomeCount === 1 ? "lançamento" : "lançamentos"})
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold">
                  <MoneyText cents={dre.grossIncomeCents} tone="positive" />
                  {hasBrutoRef && dre.grossIncomeBrutoCents !== undefined && dre.grossIncomeBrutoCents !== dre.grossIncomeCents && (
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      nominal: <MoneyText cents={dre.grossIncomeBrutoCents} tone="default" className="inline text-[10px]" />
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold">100,0%</td>
              </tr>
              <tr>
                <td className="py-2 px-3 pl-6 text-foreground">
                  (-) Despesas Operacionais Realizadas ({expenseCount} {expenseCount === 1 ? "gasto" : "gastos"})
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  <MoneyText cents={dre.totalExpensesCents} tone="negative" />
                  {hasBrutoRef && dre.totalExpensesBrutoCents !== undefined && dre.totalExpensesBrutoCents !== dre.totalExpensesCents && (
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      nominal: <MoneyText cents={dre.totalExpensesBrutoCents} tone="default" className="inline text-[10px]" />
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                  {dre.grossIncomeCents > 0
                    ? `${((dre.totalExpensesCents / dre.grossIncomeCents) * 100).toFixed(1).replace(".", ",")}%`
                    : "—"}
                </td>
              </tr>
              <tr className="bg-muted/20 font-semibold">
                <td className="py-2 px-3 text-foreground">(=) Resultado Operacional do Período</td>
                <td className="py-2 px-3 text-right font-mono">
                  <MoneyText
                    cents={dre.operationalSavingsCents}
                    tone={dre.operationalSavingsCents >= 0 ? "positive" : "negative"}
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  {formatPercent(dre.savingsRatePct)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 pl-6 text-muted-foreground">
                  (-) Aportes &amp; Investimentos Direcionados
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  <MoneyText cents={dre.investedAporteCents} tone="default" />
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                  {dre.grossIncomeCents > 0
                    ? `${((dre.investedAporteCents / dre.grossIncomeCents) * 100).toFixed(1).replace(".", ",")}%`
                    : "—"}
                </td>
              </tr>
              <tr className="bg-primary/5 font-bold border-t border-border">
                <td className="py-2.5 px-3 text-primary-strong">(=) Fluxo de Caixa Líquido Final</td>
                <td className="py-2.5 px-3 text-right font-mono text-sm">
                  <MoneyText
                    cents={dre.netCashFlowCents}
                    tone={dre.netCashFlowCents >= 0 ? "positive" : "negative"}
                  />
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-primary-strong">
                  {dre.grossIncomeCents > 0
                    ? `${((dre.netCashFlowCents / dre.grossIncomeCents) * 100).toFixed(1).replace(".", ",")}%`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {hasBrutoRef && (
          <p className="text-[10px] text-muted-foreground italic">
            * Valores ponderados pelo peso de relatório configurado. A coluna "nominal" exibe o valor bruto de face.
          </p>
        )}
      </section>

      {/* Seção 2: Distribuição por Categorias & Formas de Pagamento */}
      <section aria-label="Composição de Gastos" className="grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
        {/* Tabela de Categorias */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-4">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border text-xs font-bold text-foreground">
            <PieChart className="size-4 text-primary-strong" aria-hidden="true" />
            <span>DESPESAS POR CATEGORIA</span>
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum gasto registrado no período.</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-left">
                    <th className="py-1.5 font-medium">Categoria</th>
                    <th className="py-1.5 text-right font-medium">Total</th>
                    <th className="py-1.5 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {categories.map((cat) => (
                    <tr key={cat.name}>
                      <td className="py-1.5 font-medium text-foreground">{cat.name}</td>
                      <td className="py-1.5 text-right font-mono">
                        <MoneyText cents={cat.totalCents} tone="negative" />
                      </td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">
                        {cat.pct.toFixed(1).replace(".", ",")}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tabela de Formas de Pagamento */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-4">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border text-xs font-bold text-foreground">
            <Wallet className="size-4 text-primary-strong" aria-hidden="true" />
            <span>FORMAS DE PAGAMENTO</span>
          </div>
          {paymentMethods.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhuma transação registrada no período.</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-left">
                    <th className="py-1.5 font-medium">Meio de Pagamento</th>
                    <th className="py-1.5 text-right font-medium">Total</th>
                    <th className="py-1.5 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paymentMethods.map((pm) => (
                    <tr key={pm.method}>
                      <td className="py-1.5 font-medium text-foreground">{pm.label}</td>
                      <td className="py-1.5 text-right font-mono">
                        <MoneyText cents={pm.totalCents} tone="default" />
                      </td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">
                        {pm.pct.toFixed(1).replace(".", ",")}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Seção 3: Faturas de Cartão Pagas no Período (se houver) */}
      {paidInvoices.length > 0 && (
        <section aria-label="Faturas Pagas" className="break-inside-avoid flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-4">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border text-xs font-bold text-foreground">
            <ReceiptText className="size-4 text-primary-strong" aria-hidden="true" />
            <span>FATURAS DE CARTÃO QUITADAS NO PERÍODO</span>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground text-left">
                  <th className="py-1.5 font-medium">Cartão</th>
                  <th className="py-1.5 font-medium">Competência</th>
                  <th className="py-1.5 font-medium">Data Pgto</th>
                  <th className="py-1.5 text-right font-medium">Valor Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paidInvoices.map((inv, idx) => (
                  <tr key={`${inv.cardName}-${inv.competenceMonth}-${idx}`}>
                    <td className="py-1.5 font-medium text-foreground">{inv.cardName}</td>
                    <td className="py-1.5 text-muted-foreground">{inv.competenceMonth}</td>
                    <td className="py-1.5 text-muted-foreground">{formatDateBR(inv.date)}</td>
                    <td className="py-1.5 text-right font-mono font-semibold">
                      <MoneyText cents={inv.amountCents} tone="negative" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Rodapé da Página A4 */}
      <footer className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
        <span>{appName} — Fechamento Financeiro &amp; DRE Pessoal</span>
        <span>Página 1 de 1</span>
      </footer>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Relatório Executivo de Finanças Pessoais &amp; DRE"
        description="Demonstração do resultado do período, fluxo de caixa e composição das despesas."
        size="xl"
      >
        <div className="flex flex-col gap-6">
          <div className="p-4 sm:p-6 bg-surface rounded-xl border border-border">
            {reportContent}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button type="button" variant="default" onClick={triggerPrint} className="gap-2">
              <Printer className="size-4" aria-hidden="true" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </Modal>

      <PrintSheet open={printing}>
        {reportContent}
      </PrintSheet>
    </>
  );
}
