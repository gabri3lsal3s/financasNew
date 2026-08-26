import {
  Landmark,
  PieChart,
  ReceiptText,
  Wallet,
} from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportExecutiveSummary,
  ReportWaterfallBar,
  ReportFooter,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks/percent";
import { sanitizeReportText } from "@/domain/reports";

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
  brutoCents?: number;
  ponderadoCents?: number;
  totalCents: number;
  pct: number;
}

export interface FinancialReportPaymentMethodItem {
  method: string;
  label: string;
  brutoCents?: number;
  ponderadoCents?: number;
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
  accountHolder?: string;
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
 * Modal Executivo de Finanças Pessoais & DRE (F42/F44).
 * Exibe a Demonstração do Resultado do Exercício (DRE Pessoal),
 * composição de despesas e impressão padronizada A4 / PDF.
 */
export function FinancialCloseReportModal({
  open,
  onOpenChange,
  periodLabel,
  appName = "Guia Financeiro",
  accountHolder,
  dre,
  categories,
  paymentMethods,
  paidInvoices = [],
  expenseCount,
  incomeCount,
  showWeightedNote = false,
}: FinancialCloseReportModalProps) {
  const effectiveGrossIncomeBruto = dre.grossIncomeBrutoCents ?? dre.grossIncomeCents;
  const effectiveTotalExpensesBruto = dre.totalExpensesBrutoCents ?? dre.totalExpensesCents;
  const effectiveGrossSavingsBruto = effectiveGrossIncomeBruto - effectiveTotalExpensesBruto;
  const effectiveGrossSavingsRatePct =
    effectiveGrossIncomeBruto > 0 ? (effectiveGrossSavingsBruto / effectiveGrossIncomeBruto) * 100 : 0;

  const hasBrutoRef =
    showWeightedNote &&
    (dre.grossIncomeBrutoCents !== undefined || dre.totalExpensesBrutoCents !== undefined);

  // Passos para o gráfico visual em cascata de DRE
  const waterfallSteps = [
    {
      key: "income",
      label: "Receitas Realizadas",
      amountCents: effectiveGrossIncomeBruto,
      pctOfTotal: 100,
      type: "income" as const,
    },
    {
      key: "expenses",
      label: "Despesas Operacionais",
      amountCents: effectiveTotalExpensesBruto,
      pctOfTotal: effectiveGrossIncomeBruto > 0 ? (effectiveTotalExpensesBruto / effectiveGrossIncomeBruto) * 100 : 0,
      type: "expense" as const,
    },
    {
      key: "savings",
      label: "Poupança Líquida Operacional",
      amountCents: effectiveGrossSavingsBruto,
      pctOfTotal: effectiveGrossIncomeBruto > 0 ? (effectiveGrossSavingsBruto / effectiveGrossIncomeBruto) * 100 : 0,
      type: "savings" as const,
    },
  ];

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório Executivo de Finanças Pessoais & DRE"
    >
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title="Relatório Executivo de Finanças Pessoais & DRE"
        subtitle="Demonstração do Resultado, Fluxo de Caixa & Composição de Gastos"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      {/* 2. Síntese Executiva & KPIs em Linha Única */}
      <ReportExecutiveSummary
        title="SÍNTESE DO FLUXO CONTÁBIL & RESULTADO"
        items={[
          {
            label: "Receitas Totais",
            value: <MoneyText cents={effectiveGrossIncomeBruto} tone="positive" />,
            subtext: hasBrutoRef && dre.grossIncomeCents !== effectiveGrossIncomeBruto ? (
              <span>Ponderada: <MoneyText cents={dre.grossIncomeCents} className="inline text-[10px]" /></span>
            ) : "Entradas no Período",
          },
          {
            label: "Despesas Totais",
            value: <MoneyText cents={effectiveTotalExpensesBruto} tone="negative" />,
            subtext: hasBrutoRef && dre.totalExpensesCents !== effectiveTotalExpensesBruto ? (
              <span>Ponderada: <MoneyText cents={dre.totalExpensesCents} className="inline text-[10px]" /></span>
            ) : "Saídas no Período",
          },
          {
            label: "Resultado Operacional",
            value: (
              <MoneyText
                cents={effectiveGrossSavingsBruto}
                tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"}
              />
            ),
            subtext: effectiveGrossSavingsBruto >= 0 ? "Superávit" : "Déficit",
          },
          {
            label: "Taxa de Poupança",
            value: formatPercent(effectiveGrossSavingsRatePct),
            subtext: "Eficiência de Renda",
          },
        ]}
        narrative={
          <span>
            No período apurado (<strong>{periodLabel}</strong>), a receita operacional bruta totalizou <strong><MoneyText cents={effectiveGrossIncomeBruto} tone="positive" className="inline font-bold" /></strong> frente a despesas realizadas de <strong><MoneyText cents={effectiveTotalExpensesBruto} tone="negative" className="inline font-bold" /></strong>, gerando resultado operacional de <strong><MoneyText cents={effectiveGrossSavingsBruto} tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"} className="inline font-bold" /></strong> (taxa de poupança de <strong>{formatPercent(effectiveGrossSavingsRatePct)}</strong>). Foram direcionados <strong><MoneyText cents={dre.investedAporteCents} className="inline font-bold" /></strong> para investimentos, resultando em variação líquida de caixa de <strong><MoneyText cents={effectiveGrossSavingsBruto - dre.investedAporteCents} tone={effectiveGrossSavingsBruto - dre.investedAporteCents >= 0 ? "positive" : "negative"} className="inline font-bold" /></strong>.
          </span>
        }
      />

      {/* 3. Cascata Visual de DRE */}
      {effectiveGrossIncomeBruto > 0 && (
        <ReportWaterfallBar
          title="Fluxo Contábil &amp; Destinação da Renda (Cascata DRE)"
          grossIncomeCents={effectiveGrossIncomeBruto}
          steps={waterfallSteps}
        />
      )}

      {/* 4. Seção: Demonstração Contábil (DRE Pessoal) */}
      <section aria-label="Demonstração do Resultado do Exercício" className="break-inside-avoid flex flex-col gap-2">
        <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1">
          <Landmark className="size-3.5 text-primary-strong" aria-hidden="true" />
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
            DRE Pessoal — Demonstração do Período
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-3">Linha / Estrutura Contábil</th>
                <th className="py-2 px-3 text-right">Valor Bruto (R$)</th>
                <th className="py-2 px-3 text-right">% Receita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr className="bg-positive/5">
                <td className="py-2 px-3 font-semibold text-positive-strong">
                  (+) Receita Operacional Bruta ({incomeCount} {incomeCount === 1 ? "lançamento" : "lançamentos"})
                </td>
                <td className="py-2 px-3 text-right num font-mono font-bold">
                  <MoneyText cents={effectiveGrossIncomeBruto} tone="positive" />
                  {hasBrutoRef && dre.grossIncomeCents !== effectiveGrossIncomeBruto && (
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      Ponderada: <MoneyText cents={dre.grossIncomeCents} tone="default" className="inline text-[10px]" />
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right num font-mono font-semibold">100,0%</td>
              </tr>
              <tr>
                <td className="py-2 px-3 pl-6 text-foreground">
                  (-) Despesas Operacionais Realizadas ({expenseCount} {expenseCount === 1 ? "gasto" : "gastos"})
                </td>
                <td className="py-2 px-3 text-right num font-mono font-semibold">
                  <MoneyText cents={effectiveTotalExpensesBruto} tone="negative" />
                  {hasBrutoRef && dre.totalExpensesCents !== effectiveTotalExpensesBruto && (
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      Ponderada: <MoneyText cents={dre.totalExpensesCents} tone="default" className="inline text-[10px]" />
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right num font-mono text-muted-foreground">
                  {effectiveGrossIncomeBruto > 0
                    ? `${((effectiveTotalExpensesBruto / effectiveGrossIncomeBruto) * 100).toFixed(1).replace(".", ",")}%`
                    : "—"}
                </td>
              </tr>
              <tr className="bg-muted/20 font-semibold">
                <td className="py-2 px-3 text-foreground">(=) Resultado Operacional do Período</td>
                <td className="py-2 px-3 text-right num font-mono font-bold">
                  <MoneyText
                    cents={effectiveGrossSavingsBruto}
                    tone={effectiveGrossSavingsBruto >= 0 ? "positive" : "negative"}
                  />
                  {hasBrutoRef && dre.operationalSavingsCents !== effectiveGrossSavingsBruto && (
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      Ponderado: <MoneyText cents={dre.operationalSavingsCents} tone="default" className="inline text-[10px]" />
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right num font-mono">
                  {formatPercent(effectiveGrossSavingsRatePct)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 pl-6 text-muted-foreground">
                  (-) Aportes &amp; Investimentos Direcionados
                </td>
                <td className="py-2 px-3 text-right num font-mono">
                  <MoneyText cents={dre.investedAporteCents} tone="default" />
                </td>
                <td className="py-2 px-3 text-right num font-mono text-muted-foreground">
                  {effectiveGrossIncomeBruto > 0
                    ? `${((dre.investedAporteCents / effectiveGrossIncomeBruto) * 100).toFixed(1).replace(".", ",")}%`
                    : "—"}
                </td>
              </tr>
              <tr className="bg-primary/5 font-bold border-t border-border">
                <td className="py-2 px-3 text-primary-strong">(=) Fluxo de Caixa Líquido Final</td>
                <td className="py-2 px-3 text-right num font-mono text-sm font-bold">
                  <MoneyText
                    cents={effectiveGrossSavingsBruto - dre.investedAporteCents}
                    tone={effectiveGrossSavingsBruto - dre.investedAporteCents >= 0 ? "positive" : "negative"}
                  />
                </td>
                <td className="py-2 px-3 text-right num font-mono text-primary-strong">
                  {effectiveGrossIncomeBruto > 0
                    ? `${(((effectiveGrossSavingsBruto - dre.investedAporteCents) / effectiveGrossIncomeBruto) * 100).toFixed(1).replace(".", ",")}%`
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

      {/* 5. Seção: Distribuição por Categorias & Formas de Pagamento */}
      <section aria-label="Composição de Gastos" className="grid grid-cols-1 sm:grid-cols-2 gap-3 break-inside-avoid print:grid-cols-2">
        {/* Tabela de Categorias */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 print:bg-white print:border-border shadow-2xs">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
            <PieChart className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>DESPESAS POR CATEGORIA</span>
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">Nenhum gasto registrado no período.</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-slate-700 font-bold text-[10px] uppercase tracking-wider text-left bg-slate-50">
                    <th className="py-1 px-1.5 font-bold">Categoria</th>
                    <th className="py-1 px-1.5 text-right font-bold">Total Bruto</th>
                    <th className="py-1 px-1.5 text-right font-bold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {categories.map((cat) => (
                    <tr key={cat.name} className="even:bg-slate-50/50 print:even:bg-slate-50/50">
                      <td className="py-1.5 px-1.5 font-medium text-foreground">{sanitizeReportText(cat.name)}</td>
                      <td className="py-1.5 px-1.5 text-right num font-mono">
                        <MoneyText cents={cat.brutoCents ?? cat.totalCents} tone="negative" className="font-bold" />
                        {hasBrutoRef && cat.brutoCents !== undefined && cat.ponderadoCents !== undefined && cat.brutoCents !== cat.ponderadoCents && (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            Ponderado: <MoneyText cents={cat.ponderadoCents} tone="default" className="inline text-[10px]" />
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground">
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
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 print:bg-white print:border-border shadow-2xs">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
            <Wallet className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>FORMAS DE PAGAMENTO</span>
          </div>
          {paymentMethods.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">Nenhuma transação registrada no período.</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-slate-700 font-bold text-[10px] uppercase tracking-wider text-left bg-slate-50">
                    <th className="py-1 px-1.5 font-bold">Meio de Pagamento</th>
                    <th className="py-1 px-1.5 text-right font-bold">Total Bruto</th>
                    <th className="py-1 px-1.5 text-right font-bold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paymentMethods.map((pm) => (
                    <tr key={pm.method} className="even:bg-slate-50/50 print:even:bg-slate-50/50">
                      <td className="py-1.5 px-1.5 font-medium text-foreground">{sanitizeReportText(pm.label)}</td>
                      <td className="py-1.5 px-1.5 text-right num font-mono">
                        <MoneyText cents={pm.brutoCents ?? pm.totalCents} tone="default" className="font-bold" />
                        {hasBrutoRef && pm.brutoCents !== undefined && pm.ponderadoCents !== undefined && pm.brutoCents !== pm.ponderadoCents && (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            Ponderado: <MoneyText cents={pm.ponderadoCents} tone="default" className="inline text-[10px]" />
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-1.5 text-right num font-mono text-muted-foreground">
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

      {/* 6. Seção: Faturas de Cartão Pagas no Período (se houver) */}
      {paidInvoices.length > 0 && (
        <section aria-label="Faturas Pagas" className="break-inside-avoid flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
            <ReceiptText className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>FATURAS DE CARTÃO QUITADAS NO PERÍODO</span>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-slate-700 font-bold text-[10px] uppercase tracking-wider text-left bg-slate-50">
                  <th className="py-1 px-2 font-bold">Cartão</th>
                  <th className="py-1 px-2 font-bold">Competência</th>
                  <th className="py-1 px-2 font-bold">Data Pgto</th>
                  <th className="py-1 px-2 text-right font-bold">Valor Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paidInvoices.map((inv, idx) => (
                  <tr key={`${inv.cardName}-${inv.competenceMonth}-${idx}`} className="even:bg-slate-50/50 print:even:bg-slate-50/50">
                    <td className="py-1.5 px-2 font-medium text-foreground">{sanitizeReportText(inv.cardName)}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{inv.competenceMonth}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{formatDateBR(inv.date)}</td>
                    <td className="py-1.5 px-2 text-right num font-mono font-bold">
                      <MoneyText cents={inv.amountCents} tone="negative" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 7. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento estritamente confidencial emitido pelo titular da conta via Guia Financeiro. Demonstração de fluxo de caixa baseada nos registros efetivamente conciliados."
      />
    </ReportDocumentLayout>
  );
}

