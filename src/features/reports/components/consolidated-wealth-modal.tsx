import { ArrowDownRight, ArrowUpRight, Landmark, Scale } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportExecutiveSummary,
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
        title="Balanço Patrimonial 360° & Visão Consolidada"
        subtitle="Ativos Totais, Passivos Exigíveis, Patrimônio Líquido & Alavancagem"
        periodLabel={periodLabel}
        appName={appName}
        icon={Scale}
        accountHolder={accountHolder}
      />

      {/* 2. Síntese Executiva & KPIs em Linha Única */}
      <ReportExecutiveSummary
        title="SÍNTESE PATRIMONIAL & GRAU DE ALAVANCAGEM"
        items={[
          {
            label: "Patrimônio Líquido",
            value: <MoneyText cents={numberToCents(balanceSheet.netWorthBRL)} tone="portfolio" />,
            subtext: "Ativos (-) Passivos",
          },
          {
            label: "Ativos Totais",
            value: <MoneyText cents={numberToCents(balanceSheet.totalAssetsBRL)} tone="positive" />,
            subtext: "Custódia + Caixa",
          },
          {
            label: "Passivos Exigíveis",
            value: <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" />,
            subtext: "Dívidas Totais",
          },
          {
            label: "Grau de Alavancagem",
            value: `${balanceSheet.debtToAssetRatioPct.toFixed(1)}%`,
            subtext: "Dívida / Ativos",
          },
        ]}
        narrative={
          <span>
            O patrimônio líquido consolidado totaliza <strong><MoneyText cents={numberToCents(balanceSheet.netWorthBRL)} tone="portfolio" className="inline font-bold" /></strong>, composto por <strong><MoneyText cents={numberToCents(balanceSheet.totalAssetsBRL)} tone="positive" className="inline font-bold" /></strong> em ativos totais (investimentos em custódia, reserva de liquidez e direitos a receber) e <strong><MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="inline font-bold" /></strong> em passivos exigíveis, resultando em um grau de alavancagem de <strong>{balanceSheet.debtToAssetRatioPct.toFixed(1)}%</strong> dos ativos.
          </span>
        }
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
      <section aria-label="Balanço Patrimonial" className="grid grid-cols-1 sm:grid-cols-2 gap-3 break-inside-avoid print:grid-cols-2">
        {/* Card de Ativos */}
        <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-2.5 print:bg-white print:border-border shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-positive-strong">
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <span>ATIVOS TOTAIS</span>
            </div>
            <MoneyText cents={numberToCents(balanceSheet.totalAssetsBRL)} tone="positive" className="font-bold text-xs" />
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Investimentos em Custódia:</span>
              <MoneyText cents={numberToCents(balanceSheet.totalInvestmentsBRL)} className="num font-mono font-bold text-foreground" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Reserva de Liquidez (Caixa):</span>
              <MoneyText cents={numberToCents(balanceSheet.cashBalanceBRL)} className="num font-mono font-bold text-foreground" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Contas a Receber (Empréstimos):</span>
              <MoneyText cents={numberToCents(balanceSheet.receivablesBRL)} className="num font-mono font-bold text-foreground" />
            </div>
          </div>
        </div>

        {/* Card de Passivos */}
        <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 flex flex-col gap-2.5 print:bg-white print:border-border shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-negative-strong">
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
              <span>PASSIVOS (DÍVIDAS &amp; FINANCIAMENTOS)</span>
            </div>
            <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="font-bold text-xs" />
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Saldo Devedor Total:</span>
              <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" className="num font-mono font-bold" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Comprometimento de Patrimônio:</span>
              <span className="num font-mono font-bold text-foreground">
                {balanceSheet.debtToAssetRatioPct.toFixed(1)}% dos ativos
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Seção: Demonstração Contábil Integrada (DRE) */}
      <section aria-label="DRE Pessoal" className="flex flex-col gap-2.5 break-inside-avoid">
        <div className="flex items-center gap-2 border-b border-border/80 pb-1.5">
          <Landmark className="size-3.5 text-primary-strong" aria-hidden="true" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Demonstração do Resultado do Exercício (DRE Pessoal)
          </h3>
        </div>
        <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
          <div className="flex justify-between items-center p-2.5 bg-slate-100/90 border-b border-border font-bold text-foreground">
            <span>(+) Receitas Brutas Totais</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.grossIncomeBRL)} tone="positive" className="num font-mono font-bold" />
          </div>
          <div className="flex justify-between items-center p-2.5 border-b border-border text-foreground">
            <span>(-) Despesas Operacionais e Custo de Vida</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.totalExpensesBRL)} tone="negative" className="num font-mono font-bold" />
          </div>
          <div className="flex justify-between items-center p-2.5 bg-muted/20 border-b border-border font-semibold text-foreground">
            <span>(=) Poupança Operacional Líquida (Margem: {balanceSheet.dre.savingsRatePct.toFixed(1)}%)</span>
            <MoneyText
              cents={numberToCents(balanceSheet.dre.operationalSavingsBRL)}
              tone={balanceSheet.dre.operationalSavingsBRL >= 0 ? "positive" : "negative"}
              className="num font-mono font-bold"
            />
          </div>
          <div className="flex justify-between items-center p-2.5 border-b border-border text-foreground">
            <span>(-) Aportes Destinados a Investimentos</span>
            <MoneyText cents={numberToCents(balanceSheet.dre.investedAporteBRL)} tone="default" className="num font-mono font-bold" />
          </div>
          <div className="flex justify-between items-center p-2.5 bg-primary/5 font-bold text-foreground">
            <span>(=) Variação Final de Caixa no Período</span>
            <MoneyText
              cents={numberToCents(balanceSheet.dre.netCashFlowBRL)}
              tone={balanceSheet.dre.netCashFlowBRL >= 0 ? "positive" : "negative"}
              className="text-xs num font-mono font-bold text-primary-strong"
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

