import { BarChart3, Calendar, Layers, PieChart } from "lucide-react";
import {
  ReportAllocationDonuts,
  ReportClassTables,
  ReportFiiBreakdownCard,
  ReportFixedIncomeBreakdownCard,
  ReportInternationalBreakdownCard,
  ReportPerformanceChart,
  ReportRedemptionsTable,
  ReportRiskGauge,
  ReportStocksBreakdownCard,
} from "@/components/modules";
import { EmptyState } from "@/components/ui/empty-state";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { sanitizeReportText, type PeriodRedemptionItem, type TearSheetModel } from "@/domain/reports";
import type { PortfolioAsset } from "@/types";

export interface TearSheetCustodyAndBreakdownsProps {
  model: TearSheetModel;
  totalBRL: number;
  periodLabel: string;
  periodRedemptions?: readonly PeriodRedemptionItem[];
  assetsMetadata: readonly PortfolioAsset[];
  annualCdiRate?: number;
  annualSelicRate?: number;
  annualIpcaRate?: number;
  ibovPeriodReturnPct?: number;
}

export function TearSheetCustodyAndBreakdowns({
  model,
  totalBRL,
  periodLabel,
  periodRedemptions,
  assetsMetadata,
  annualCdiRate,
  annualSelicRate,
  annualIpcaRate,
  ibovPeriodReturnPct,
}: TearSheetCustodyAndBreakdownsProps) {
  const hasCashReserve = model.classTableGroups.some((g) =>
    g.className.toLowerCase().includes("caixa"),
  );

  return (
    <>
      <section aria-label="Risco e Concentração" className="break-inside-avoid flex flex-col gap-2">
        <ReportRiskGauge
          topItemName={sanitizeReportText(model.topDominance.ticker)}
          topItemPct={model.topDominance.pct}
          warningThresholdPct={15}
          criticalThresholdPct={25}
        />
      </section>

      <section
        aria-label="Custódia de Ativos"
        className="flex flex-col gap-3 pt-1 print:pt-0 print-break-before-page print:break-before-page"
      >
        <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Custódia Consolidada de Ativos por Classe ({model.activeInvestmentRows.length} ativos{hasCashReserve ? " + Reserva de Caixa" : ""})
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono num">
            Total Custodiado: <MoneyText cents={numberToCents(totalBRL)} className="font-bold text-foreground inline" />
          </span>
        </div>

        <ReportClassTables groups={model.classTableGroups} />

        {periodRedemptions && periodRedemptions.length > 0 ? (
          <ReportRedemptionsTable
            items={periodRedemptions}
            periodLabel={periodLabel}
            historicalRealizedPnlBRL={model.effectiveRealizedGainBRL}
          />
        ) : null}
      </section>

      {model.donutData.classSegments.length > 0 && (
        <section
          aria-label="Detalhamento Gráfico de Alocação e Setores"
          className="flex flex-col gap-3 pt-2 print:pt-1 break-inside-avoid print:break-inside-avoid print:break-before-page break-before-page"
        >
          <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Detalhamento Gráfico da Alocação &amp; Exposição Setorial
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono num">
              Total Custodiado: <strong className="text-foreground"><MoneyText cents={numberToCents(totalBRL)} /></strong>
            </span>
          </div>

          <ReportAllocationDonuts
            classSegments={model.donutData.classSegments}
            sectorSegments={model.donutData.sectorSegments}
            totalBRL={totalBRL}
            totalUniqueSectors={model.donutData.totalUniqueSectors}
            variant="print"
          />
        </section>
      )}

      <section
        aria-label="Raios-X Analíticos de Subalocação por Classe"
        className="flex flex-col gap-3 pt-2 print:pt-1 print-break-before-page print:break-before-page break-inside-avoid print:break-inside-avoid"
      >
        <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
          <div className="flex items-center gap-1.5">
            <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Raios-X de Subalocação Setorial, Cíclica &amp; Risco de Emissão
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            Renda Variável, Renda Fixa &amp; Ativos Internacionais
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3.5 w-full">
          <ReportStocksBreakdownCard
            positions={model.breakdownRows}
            mode="print_all"
            className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
          />
          <ReportFiiBreakdownCard
            positions={model.breakdownRows}
            mode="print_all"
            className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
          />
          <ReportFixedIncomeBreakdownCard
            positions={model.breakdownRows}
            assetsMetadata={assetsMetadata}
            mode="print_all"
            className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
          />
          <ReportInternationalBreakdownCard
            positions={model.breakdownRows}
            mode="print_all"
            className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
          />
        </div>
      </section>

      {model.performanceSeries.length >= 2 ? (
        <ReportPerformanceChart
          series={model.performanceSeries}
          title="Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês"
          className="print-break-before-page print:break-before-page print-break-inside-avoid"
          annualCdiRate={annualCdiRate}
          annualSelicRate={annualSelicRate}
          annualIpcaRate={annualIpcaRate}
          ibovPeriodReturnPct={ibovPeriodReturnPct}
        />
      ) : (
        <section
          aria-label="Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês"
          className="flex flex-col gap-3 pt-2 print:pt-1 break-inside-avoid print:break-inside-avoid w-full"
        >
          <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Comparativo Histórico de Rentabilidade &amp; Patrimônio Mês a Mês
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Histórico em Formação</span>
          </div>

          <EmptyState
            icon={<Calendar className="size-6 text-muted-foreground" aria-hidden="true" />}
            title="Histórico Mensal em Formação"
            description="São necessários ao menos 2 fechamentos mensais registrados para traçar a evolução temporal da rentabilidade e calcular os indicadores de consistência da carteira."
            tone="default"
            className="py-8 bg-surface/40 print:bg-transparent print:border-border"
          />
        </section>
      )}
    </>
  );
}
