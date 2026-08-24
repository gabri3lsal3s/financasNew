import { usePrint } from "@/components/ui";
import { ArrowDownRight, ArrowUpRight, Landmark, Printer, Scale } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { PrintSheet } from "@/components/ui/print-sheet";
import { numberToCents } from "@/domain/money";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports";

export interface ConsolidatedWealthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceSheet: ConsolidatedBalanceSheetResult;
  periodLabel?: string;
  appName?: string;
}

export function ConsolidatedWealthModal({
  open,
  onOpenChange,
  balanceSheet,
  periodLabel = "Fechamento Consolidado",
  appName = "Finanças Pessoais",
}: ConsolidatedWealthModalProps) {
  const { printing, triggerPrint } = usePrint();
  const generatedAt = new Date().toLocaleDateString("pt-BR");


  const reportContent = (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4 print:flex-row print:items-start">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary-strong">
            <Scale className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-foreground">{appName}</span>
            <span className="text-xs text-muted-foreground">Balanço Patrimonial 360° &amp; DRE Pessoal</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground print:items-end print:text-right">
          <span className="font-medium text-foreground">{periodLabel}</span>
          <span>Emitido em {generatedAt}</span>
        </div>
      </header>

      {/* KPI Principal: Patrimônio Líquido Real */}
      <section aria-label="Patrimônio Líquido" className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patrimônio Líquido Real (Ativos - Passivos)</span>
          <MoneyText cents={numberToCents(balanceSheet.netWorthBRL)} tone="portfolio" className="text-2xl sm:text-3xl font-bold font-display" />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Taxa de Poupança</span>
            <span className="font-mono font-bold text-foreground">{balanceSheet.dre.savingsRatePct.toFixed(1)}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Grau de Alavancagem</span>
            <span className="font-mono font-bold text-foreground">{balanceSheet.debtToAssetRatioPct.toFixed(1)}%</span>
          </div>
        </div>
      </section>

      {/* Seção 1: Balanço Patrimonial (Ativos vs. Passivos) */}
      <section aria-label="Balanço Patrimonial" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Ativos Totais */}
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-positive-strong">
              <ArrowUpRight className="size-4" aria-hidden="true" />
              <span>ATIVOS TOTAIS</span>
            </div>
            <MoneyText cents={numberToCents(balanceSheet.totalAssetsBRL)} tone="positive" className="font-bold text-sm" />
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Investimentos em Custódia:</span>
              <MoneyText cents={numberToCents(balanceSheet.totalInvestmentsBRL)} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Reserva de Liquidez (Caixa):</span>
              <MoneyText cents={numberToCents(balanceSheet.cashBalanceBRL)} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Contas a Receber (Empréstimos):</span>
              <MoneyText cents={numberToCents(balanceSheet.receivablesBRL)} />
            </div>
          </div>
        </div>

        {/* Passivos Totais */}
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-negative">
              <ArrowDownRight className="size-4" aria-hidden="true" />
              <span>PASSIVOS (DÍVIDAS &amp; FINANCIAMENTOS)</span>
            </div>
            <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="font-bold text-sm" />
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Saldo Devedor Total:</span>
              <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Comprometimento de Patrimônio:</span>
              <span className="font-mono font-medium text-foreground">{balanceSheet.debtToAssetRatioPct.toFixed(1)}% dos ativos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 2: Demonstração do Resultado Pessoal (DRE) */}
      <section aria-label="DRE Pessoal" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-primary-strong" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Demonstração do Resultado do Exercício (DRE Pessoal)</h3>
        </div>
        <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
          <div className="flex justify-between items-center p-3 bg-surface-hover/50 border-b border-border font-semibold text-foreground">
            <span>(+) Receitas Brutas Totais</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.grossIncomeBRL)} tone="positive" />
          </div>
          <div className="flex justify-between items-center p-3 border-b border-border text-muted-foreground">
            <span>(-) Despesas Operacionais e Custo de Vida</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.totalExpensesBRL)} tone="negative" />
          </div>
          <div className="flex justify-between items-center p-3 bg-surface-hover/20 border-b border-border font-semibold text-foreground">
            <span>(=) Poupança Operacional Líquida (Margem: {balanceSheet.dre.savingsRatePct.toFixed(1)}%)</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.operationalSavingsBRL)} tone={balanceSheet.dre.operationalSavingsBRL >= 0 ? "positive" : "negative"} />
          </div>
          <div className="flex justify-between items-center p-3 border-b border-border text-muted-foreground">
            <span>(-) Aportes Destinados a Investimentos</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.investedAporteBRL)} tone="portfolio" />
          </div>
          <div className="flex justify-between items-center p-3 bg-surface-hover/60 font-bold text-foreground">
            <span>(=) Variação Final de Caixa no Período</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.netCashFlowBRL)} tone={balanceSheet.dre.netCashFlowBRL >= 0 ? "positive" : "negative"} className="text-sm" />
          </div>
        </div>
      </section>

      {/* Rodapé da Página A4 */}
      <footer className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
        <span>{appName} — Balanço Integrado de Gestão Patrimonial</span>
        <span>Página 1 de 1</span>
      </footer>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Balanço Patrimonial 360° &amp; DRE Pessoal"
        description="Consolidação completa de ativos, dívidas, receitas, despesas e fluxo de caixa."
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
