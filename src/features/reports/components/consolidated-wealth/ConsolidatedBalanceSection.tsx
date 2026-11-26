import { ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import { ReportDonutChart, type ReportDonutSegment } from "@/components/modules/reports/report-donut-chart";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports";
import { formatPercent } from "@/services/masks";

export interface ConsolidatedBalanceSectionProps {
  balanceSheet: ConsolidatedBalanceSheetResult;
  assetSegments?: readonly ReportDonutSegment[];
  showDonut?: boolean;
  showDreStatement?: boolean;
}

export function ConsolidatedBalanceSection({
  balanceSheet,
  assetSegments = [],
  showDonut = true,
  showDreStatement = true,
}: ConsolidatedBalanceSectionProps) {
  const totalAssets = balanceSheet.totalAssetsBRL;
  const positiveSegments = assetSegments.filter((s) => s.value > 0);
  const shouldRenderDonut = showDonut && totalAssets > 0 && positiveSegments.length >= 2;

  return (
    <>
      <section aria-label="Balanço Patrimonial" className="grid grid-cols-1 md:grid-cols-12 gap-3 break-inside-avoid print:grid-cols-12">
        {/* Ativos Totais (58% / col-span-7) */}
        <div className="md:col-span-7 print:col-span-7 rounded-xl border border-border/80 bg-muted/10 p-3 flex flex-col justify-between gap-2.5 print:bg-surface print:border-border shadow-xs">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-positive-strong">
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <span>ATIVOS TOTAIS</span>
            </div>
            <MoneyText cents={numberToCents(totalAssets)} tone="positive" className="font-bold text-xs" />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {shouldRenderDonut && (
              <div className="shrink-0 flex items-center justify-center">
                <ReportDonutChart
                  segments={positiveSegments}
                  centerLabel="Ativos"
                  centerValue={
                    <MoneyText
                      cents={numberToCents(totalAssets)}
                      className="text-[8.5pt] font-mono font-bold text-foreground tracking-tight leading-none whitespace-nowrap"
                    />
                  }
                  size={114}
                  strokeWidth={9}
                  showLegend={false}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5 text-xs flex-1 w-full justify-center">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="size-2 rounded-full shrink-0 bg-primary-strong border border-border/80" />
                  <span className="text-muted-foreground truncate">Investimentos:</span>
                </div>
                <MoneyText cents={numberToCents(balanceSheet.totalInvestmentsBRL)} className="font-bold text-foreground whitespace-nowrap" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0 border border-border/80"
                    style={{ backgroundColor: assetSegments.find((s) => s.key === "cash")?.color ?? "hsl(var(--positive))" }}
                  />
                  <span className="text-muted-foreground truncate">Reserva de Caixa:</span>
                </div>
                <MoneyText cents={numberToCents(balanceSheet.cashBalanceBRL)} className="font-bold text-foreground whitespace-nowrap" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="size-2 rounded-full shrink-0 bg-portfolio border border-border/80" />
                  <span className="text-muted-foreground truncate">Contas a Receber:</span>
                </div>
                <MoneyText cents={numberToCents(balanceSheet.receivablesBRL)} className="font-bold text-foreground whitespace-nowrap" />
              </div>
            </div>
          </div>
        </div>

        {/* Passivos Exigíveis (42% / col-span-5) */}
        <div className="md:col-span-5 print:col-span-5 rounded-xl border border-border/80 bg-muted/10 p-3 flex flex-col justify-between gap-2.5 print:bg-surface print:border-border shadow-xs">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-negative-strong">
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
              <span>PASSIVOS EXIGÍVEIS</span>
            </div>
            <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="font-bold text-xs" />
          </div>
          <div className="flex flex-col gap-1.5 text-xs flex-1 justify-center">
            {balanceSheet.creditCardInvoicesBRL > 0 ? (
              <>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Empréstimos / Dívidas:</span>
                  <MoneyText cents={numberToCents(balanceSheet.debtsPayableBRL)} className="font-bold text-foreground whitespace-nowrap" />
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Faturas em Aberto:</span>
                  <MoneyText cents={numberToCents(balanceSheet.creditCardInvoicesBRL)} className="font-bold text-foreground whitespace-nowrap" />
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Saldo Devedor Total:</span>
                <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="font-bold whitespace-nowrap" />
              </div>
            )}
            <div className="flex justify-between items-center gap-2 pt-1 border-t border-border/40">
              <span className="text-muted-foreground">Alavancagem s/ Ativos:</span>
              <span className="num font-mono font-bold text-foreground whitespace-nowrap">
                {formatPercent(balanceSheet.debtToAssetRatioPct)}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* DRE Pessoal */}
      <section aria-label="DRE Pessoal" className="flex flex-col gap-2 break-inside-avoid">
        <div className="flex items-center justify-between border-b border-border/80 pb-1">
          <div className="flex items-center gap-2">
            <Landmark className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              DRE Pessoal
            </h3>
            <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 font-mono">
              Base Ponderada
            </span>
          </div>
        </div>
        {showDreStatement ? (
          <div className="rounded-lg border border-border/80 overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse table-fixed">
              <colgroup>
                <col style={{ width: "70%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th scope="col" className="py-1.5 px-3">Linha / Estrutura Contábil</th>
                  <th scope="col" className="py-1.5 px-3 text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr className="bg-muted/30 font-bold text-foreground">
                  <td className="py-1.5 px-3">(+) Receitas Brutas Totais</td>
                  <td className="py-1.5 px-3 text-right num font-mono text-positive-strong">
                    <MoneyText cents={numberToCents(balanceSheet.dre.grossIncomeBRL)} tone="positive" className="font-bold" hideCurrency />
                  </td>
                </tr>
                <tr className="text-foreground">
                  <td className="py-1.5 px-3">(-) Despesas Operacionais e Custo de Vida</td>
                  <td className="py-1.5 px-3 text-right num font-mono text-negative-strong">
                    <MoneyText cents={numberToCents(balanceSheet.dre.totalExpensesBRL)} tone="negative" className="font-bold" hideCurrency />
                  </td>
                </tr>
                <tr className="bg-muted/15 font-semibold text-foreground">
                  <td className="py-1.5 px-3">(=) Poupança Operacional Líquida (Margem: {formatPercent(balanceSheet.dre.savingsRatePct)}%)</td>
                  <td className="py-1.5 px-3 text-right num font-mono">
                    <MoneyText
                      cents={numberToCents(balanceSheet.dre.operationalSavingsBRL)}
                      tone={balanceSheet.dre.operationalSavingsBRL >= 0 ? "positive" : "negative"}
                      sign="explicit"
                      className="font-bold"
                      hideCurrency
                    />
                  </td>
                </tr>
                <tr className="text-foreground">
                  <td className="py-1.5 px-3">(-) Aportes Destinados a Investimentos</td>
                  <td className="py-1.5 px-3 text-right num font-mono">
                    <MoneyText cents={numberToCents(balanceSheet.dre.investedAporteBRL)} tone="default" className="font-bold" hideCurrency />
                  </td>
                </tr>
                <tr className="bg-primary/5 font-bold text-foreground border-t border-border/80">
                  <td className="py-1.5 px-3">(=) Variação Final de Caixa no Período</td>
                  <td className="py-1.5 px-3 text-right num font-mono">
                    <MoneyText
                      cents={numberToCents(balanceSheet.dre.netCashFlowBRL)}
                      tone={balanceSheet.dre.netCashFlowBRL >= 0 ? "positive" : "negative"}
                      sign="explicit"
                      className="font-bold"
                      hideCurrency
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border/80 bg-muted/10 p-2.5 text-xs text-muted-foreground italic print:bg-surface print:border-border">
            Nenhuma movimentação de receitas ou despesas operacionais apurada nesta competência.
          </div>
        )}
      </section>
    </>
  );
}
