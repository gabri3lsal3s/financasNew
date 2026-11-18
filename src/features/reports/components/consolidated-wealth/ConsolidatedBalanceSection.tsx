import { ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports";
import { formatPercent } from "@/services/masks";

export function ConsolidatedBalanceSection({
  balanceSheet,
}: {
  balanceSheet: ConsolidatedBalanceSheetResult;
}) {
  const totalAssets = balanceSheet.totalAssetsBRL;

  return (
    <>
      <section aria-label="Balanço Patrimonial" className="grid grid-cols-1 sm:grid-cols-2 gap-3 break-inside-avoid print:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-2.5 print:bg-surface print:border-border shadow-xs">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-positive-strong">
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <span>ATIVOS TOTAIS</span>
            </div>
            <MoneyText cents={numberToCents(totalAssets)} tone="positive" className="font-bold text-xs" />
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground">Investimentos em Custódia:</span>
              <MoneyText cents={numberToCents(balanceSheet.totalInvestmentsBRL)} className="font-bold text-foreground" />
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground">Reserva de Liquidez (Caixa):</span>
              <MoneyText cents={numberToCents(balanceSheet.cashBalanceBRL)} className="font-bold text-foreground" />
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground">Contas a Receber (Empréstimos):</span>
              <MoneyText cents={numberToCents(balanceSheet.receivablesBRL)} className="font-bold text-foreground" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-2.5 print:bg-surface print:border-border shadow-xs">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-negative-strong">
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
              <span>PASSIVOS (DÍVIDAS &amp; FATURAS)</span>
            </div>
            <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="font-bold text-xs" />
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            {balanceSheet.creditCardInvoicesBRL > 0 ? (
              <>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Empréstimos &amp; Financiamentos:</span>
                  <MoneyText cents={numberToCents(balanceSheet.debtsPayableBRL)} className="font-bold text-foreground" />
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Faturas de Cartão em Aberto:</span>
                  <MoneyText cents={numberToCents(balanceSheet.creditCardInvoicesBRL)} className="font-bold text-foreground" />
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Saldo Devedor Total:</span>
                <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="font-bold" />
              </div>
            )}
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground">Comprometimento de Patrimônio:</span>
              <span className="num font-mono font-bold text-foreground">
                {formatPercent(balanceSheet.debtToAssetRatioPct)}% dos ativos
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="DRE Pessoal" className="flex flex-col gap-2.5 break-inside-avoid">
        <div className="flex items-center gap-2 border-b border-border/80 pb-1.5">
          <Landmark className="size-3.5 text-primary-strong" aria-hidden="true" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Demonstração do Resultado do Exercício (DRE Pessoal)
          </h3>
        </div>
        <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
          <div className="flex justify-between items-center gap-2 p-2.5 bg-muted/40 border-b border-border font-bold text-foreground">
            <span>(+) Receitas Brutas Totais</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.grossIncomeBRL)} tone="positive" className="font-bold" />
          </div>
          <div className="flex justify-between items-center gap-2 p-2.5 border-b border-border text-foreground">
            <span>(-) Despesas Operacionais e Custo de Vida</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.totalExpensesBRL)} tone="negative" className="font-bold" />
          </div>
          <div className="flex justify-between items-center gap-2 p-2.5 bg-muted/20 border-b border-border font-semibold text-foreground">
            <span>(=) Poupança Operacional Líquida (Margem: {formatPercent(balanceSheet.dre.savingsRatePct)}%)</span>
            <MoneyText
              cents={numberToCents(balanceSheet.dre.operationalSavingsBRL)}
              tone={balanceSheet.dre.operationalSavingsBRL >= 0 ? "positive" : "negative"}
              className="font-bold"
            />
          </div>
          <div className="flex justify-between items-center gap-2 p-2.5 border-b border-border text-foreground">
            <span>(-) Aportes Destinados a Investimentos</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.investedAporteBRL)} tone="default" className="font-bold" />
          </div>
          <div className="flex justify-between items-center gap-2 p-2.5 bg-primary/5 font-bold text-foreground">
            <span>(=) Variação Final de Caixa no Período</span>
            <MoneyText
              cents={numberToCents(balanceSheet.dre.netCashFlowBRL)}
              tone={balanceSheet.dre.netCashFlowBRL >= 0 ? "positive" : "negative"}
              className="text-xs font-bold"
            />
          </div>
        </div>
      </section>
    </>
  );
}
