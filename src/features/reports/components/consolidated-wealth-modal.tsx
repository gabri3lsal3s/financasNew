import { ArrowDownRight, ArrowUpRight, Landmark, Scale, ShieldCheck } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportKpiGrid,
  ReportDonutChart,
  ReportFooter,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports";

export interface ConsolidatedWealthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceSheet: ConsolidatedBalanceSheetResult;
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
}

/**
 * Balanço Patrimonial 360° & DRE Pessoal Integrada (F42/F44).
 * Visão holística de Ativos, Passivos, Patrimônio Líquido Real e Alavancagem.
 */
export function ConsolidatedWealthModal({
  open,
  onOpenChange,
  balanceSheet,
  periodLabel = "Fechamento Consolidado",
  appName = "Guia Financeiro",
  accountHolder,
}: ConsolidatedWealthModalProps) {
  // Segmentos para o gráfico Donut de Composição dos Ativos
  const assetSegments = [
    {
      key: "investments",
      label: "Investimentos em Custódia",
      value: balanceSheet.totalInvestmentsBRL,
      pct:
        balanceSheet.totalAssetsBRL > 0
          ? (balanceSheet.totalInvestmentsBRL / balanceSheet.totalAssetsBRL) * 100
          : 0,
      color: "#1b6b62",
      formattedValue: <MoneyText cents={numberToCents(balanceSheet.totalInvestmentsBRL)} />,
    },
    {
      key: "cash",
      label: "Reserva de Caixa (Liquidez)",
      value: balanceSheet.cashBalanceBRL,
      pct:
        balanceSheet.totalAssetsBRL > 0
          ? (balanceSheet.cashBalanceBRL / balanceSheet.totalAssetsBRL) * 100
          : 0,
      color: "#2dd4bf",
      formattedValue: <MoneyText cents={numberToCents(balanceSheet.cashBalanceBRL)} />,
    },
    {
      key: "receivables",
      label: "Contas a Receber",
      value: balanceSheet.receivablesBRL,
      pct:
        balanceSheet.totalAssetsBRL > 0
          ? (balanceSheet.receivablesBRL / balanceSheet.totalAssetsBRL) * 100
          : 0,
      color: "#38bdf8",
      formattedValue: <MoneyText cents={numberToCents(balanceSheet.receivablesBRL)} />,
    },
  ];

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Balanço Patrimonial 360° & Evolução Líquida"
    >
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title="Balanço Patrimonial 360° &amp; Visão Consolidada"
        subtitle="Ativos Totais, Passivos Exigíveis, Patrimônio Líquido &amp; Alavancagem"
        periodLabel={periodLabel}
        appName={appName}
        icon={Scale}
        accountHolder={accountHolder}
      />

      {/* 2. Grade de 4 KPIs Executivos */}
      <ReportKpiGrid
        columns={4}
        items={[
          {
            label: "Patrimônio Líquido",
            value: <MoneyText cents={numberToCents(balanceSheet.netWorthBRL)} tone="portfolio" />,
            subtext: "Ativos (-) Passivos",
            icon: ShieldCheck,
            tone: "primary",
          },
          {
            label: "Ativos Totais",
            value: <MoneyText cents={numberToCents(balanceSheet.totalAssetsBRL)} tone="positive" />,
            subtext: "Custódia + Caixa",
            icon: ArrowUpRight,
            tone: "positive",
          },
          {
            label: "Passivos Exigíveis",
            value: <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" />,
            subtext: "Dívidas Totais",
            icon: ArrowDownRight,
            tone: "negative",
          },
          {
            label: "Grau de Alavancagem",
            value: `${balanceSheet.debtToAssetRatioPct.toFixed(1)}%`,
            subtext: "Dívida / Ativos",
            icon: Scale,
            tone: balanceSheet.debtToAssetRatioPct > 30 ? "warning" : "default",
          },
        ]}
      />

      {/* 3. Gráfico Donut de Composição dos Ativos */}
      {balanceSheet.totalAssetsBRL > 0 && (
        <ReportDonutChart
          title="Composição dos Ativos Patrimoniais"
          segments={assetSegments}
          centerLabel="Ativos"
          centerValue={<MoneyText cents={numberToCents(balanceSheet.totalAssetsBRL)} />}
        />
      )}

      {/* 4. Seção: Balanço Detalhado (Ativos vs. Passivos) */}
      <section aria-label="Balanço Patrimonial" className="grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
        {/* Card de Ativos */}
        <div className="rounded-xl border border-border/80 bg-muted/10 p-4 flex flex-col gap-3 print:bg-white print:border-border">
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
              <MoneyText cents={numberToCents(balanceSheet.totalInvestmentsBRL)} className="num font-mono font-medium" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Reserva de Liquidez (Caixa):</span>
              <MoneyText cents={numberToCents(balanceSheet.cashBalanceBRL)} className="num font-mono font-medium" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Contas a Receber (Empréstimos):</span>
              <MoneyText cents={numberToCents(balanceSheet.receivablesBRL)} className="num font-mono font-medium" />
            </div>
          </div>
        </div>

        {/* Card de Passivos */}
        <div className="rounded-xl border border-border/80 bg-muted/10 p-4 flex flex-col gap-3 print:bg-white print:border-border">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-negative-strong">
              <ArrowDownRight className="size-4" aria-hidden="true" />
              <span>PASSIVOS (DÍVIDAS &amp; FINANCIAMENTOS)</span>
            </div>
            <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="font-bold text-sm" />
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Saldo Devedor Total:</span>
              <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="num font-mono font-medium" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Comprometimento de Patrimônio:</span>
              <span className="num font-mono font-medium text-foreground">
                {balanceSheet.debtToAssetRatioPct.toFixed(1)}% dos ativos
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Seção: Demonstração Contábil Integrada (DRE) */}
      <section aria-label="DRE Pessoal" className="flex flex-col gap-3 break-inside-avoid">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-primary-strong" aria-hidden="true" />
          <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-foreground">
            Demonstração do Resultado do Exercício (DRE Pessoal)
          </h3>
        </div>
        <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
          <div className="flex justify-between items-center p-3 bg-muted/40 border-b border-border font-semibold text-foreground">
            <span>(+) Receitas Brutas Totais</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.grossIncomeBRL)} tone="positive" className="num font-mono" />
          </div>
          <div className="flex justify-between items-center p-3 border-b border-border text-muted-foreground">
            <span>(-) Despesas Operacionais e Custo de Vida</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.totalExpensesBRL)} tone="negative" className="num font-mono" />
          </div>
          <div className="flex justify-between items-center p-3 bg-muted/20 border-b border-border font-semibold text-foreground">
            <span>(=) Poupança Operacional Líquida (Margem: {balanceSheet.dre.savingsRatePct.toFixed(1)}%)</span>
            <MoneyText
              cents={numberToCents(balanceSheet.dre.operationalSavingsBRL)}
              tone={balanceSheet.dre.operationalSavingsBRL >= 0 ? "positive" : "negative"}
              className="num font-mono"
            />
          </div>
          <div className="flex justify-between items-center p-3 border-b border-border text-muted-foreground">
            <span>(-) Aportes Destinados a Investimentos</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.investedAporteBRL)} tone="default" className="num font-mono" />
          </div>
          <div className="flex justify-between items-center p-3 bg-primary/5 font-bold text-foreground">
            <span>(=) Variação Final de Caixa no Período</span>
            <MoneyText
              cents={numberToCents(balanceSheet.dre.netCashFlowBRL)}
              tone={balanceSheet.dre.netCashFlowBRL >= 0 ? "positive" : "negative"}
              className="text-sm num font-mono text-primary-strong"
            />
          </div>
        </div>
      </section>

      {/* 6. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento estritamente confidencial emitido pelo titular da conta via Guia Financeiro. Consolidação patrimonial integrando custódia de investimentos, saldo em caixa e passivos."
      />
    </ReportDocumentLayout>
  );
}
