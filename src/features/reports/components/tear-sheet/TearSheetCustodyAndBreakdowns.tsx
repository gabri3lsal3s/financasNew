import { BarChart3, Calendar, Layers, PieChart } from "lucide-react";
import {
  ReportAllocationDonuts,
  ReportClassTables,
  ReportFiiBreakdownCard,
  ReportFixedIncomeBreakdownCard,
  ReportFooter,
  ReportInternationalBreakdownCard,
  ReportPerformanceChart,
  ReportRedemptionsTable,
  ReportRunningHeader,
  ReportStocksBreakdownCard,
} from "@/components/modules";
import { EmptyState } from "@/components/ui/empty-state";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { PeriodRedemptionItem, TearSheetModel } from "@/domain/reports";
import type { PortfolioAsset } from "@/types";

export interface TearSheetCustodyAndBreakdownsProps {
  model: TearSheetModel;
  totalBRL: number;
  periodLabel: string;
  accountHolder?: string;
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
  accountHolder,
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
      {/* PÁGINA 2: Custódia Consolidada de Ativos por Classe */}
      <section
        aria-label="Custódia de Ativos"
        className="flex flex-col justify-between gap-3 pt-1 min-h-[960px] print:min-h-0 print:pt-0 print-break-before-page print:break-before-page"
      >
        <div className="flex flex-col gap-3">
          <ReportRunningHeader
            title="Dossiê Executivo da Posição Vigente"
            periodLabel={periodLabel}
          />
          <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                CUSTÓDIA CONSOLIDADA DE ATIVOS POR CLASSE ({model.activeInvestmentRows.length} ativos{hasCashReserve ? " + Reserva de Caixa" : ""})
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
        </div>

        <ReportFooter
          accountHolder={accountHolder}
          reportType="dossier"
          currentPage={2}
          totalPages={7}
          variant="running"
        />
      </section>

      {/* PÁGINA 3: Detalhamento Gráfico de Alocação e Setores */}
      {model.donutData.classSegments.length > 0 && (
        <section
          aria-label="Detalhamento Gráfico de Alocação e Setores"
          className="flex flex-col justify-between gap-3 pt-2 min-h-[960px] print:min-h-0 print:pt-1 break-inside-avoid print:break-inside-avoid print-break-before-page break-before-page"
        >
          <div className="flex flex-col gap-3">
            <ReportRunningHeader
              title="Dossiê Executivo da Posição Vigente"
              periodLabel={periodLabel}
            />
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
          </div>

          <ReportFooter
            accountHolder={accountHolder}
            reportType="dossier"
            currentPage={3}
            totalPages={7}
            variant="running"
          />
        </section>
      )}

      {/* PÁGINA 4: Raios-X Renda Variável (Ações e FIIs) */}
      <section
        aria-label="Raios-X Analíticos de Subalocação por Classe - Renda Variável"
        className="flex flex-col justify-between gap-3 pt-2 min-h-[960px] print:min-h-0 print:pt-1 print-break-before-page print:break-before-page break-inside-avoid print:break-inside-avoid"
      >
        <div className="flex flex-col gap-3">
          <ReportRunningHeader
            title="Dossiê Executivo da Posição Vigente"
            periodLabel={periodLabel}
          />
          <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Raios-X de Subalocação: Renda Variável (Ações Brasil &amp; Fundos Imobiliários)
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Ciclicidade, Porte, Segmentos &amp; Gestão
            </span>
          </div>

          <div className="flex flex-col gap-3.5 w-full">
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
          </div>
        </div>

        <ReportFooter
          accountHolder={accountHolder}
          reportType="dossier"
          currentPage={4}
          totalPages={7}
          variant="running"
        />
      </section>

      {/* PÁGINA 5: Raios-X Renda Fixa & Internacional */}
      <section
        aria-label="Raios-X Analíticos de Subalocação por Classe - Renda Fixa e Internacional"
        className="flex flex-col justify-between gap-3 pt-2 min-h-[960px] print:min-h-0 print:pt-1 print-break-before-page print:break-before-page break-inside-avoid print:break-inside-avoid"
      >
        <div className="flex flex-col gap-3">
          <ReportRunningHeader
            title="Dossiê Executivo da Posição Vigente"
            periodLabel={periodLabel}
          />
          <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <PieChart className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Raios-X de Subalocação: Renda Fixa &amp; Ativos Internacionais
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Indexadores, Emissores, Vencimentos &amp; Geografia
            </span>
          </div>

          <div className="flex flex-col gap-3.5 w-full">
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
        </div>

        <ReportFooter
          accountHolder={accountHolder}
          reportType="dossier"
          currentPage={5}
          totalPages={7}
          variant="running"
        />
      </section>

      {/* PÁGINA 6: Comparativo Histórico de Rentabilidade & Benchmarks */}
      {model.performanceSeries.length >= 2 ? (
        <section
          aria-label="Comparativo Histórico de Rentabilidade & Benchmarks"
          className="flex flex-col justify-between gap-3 pt-2 min-h-[960px] print:min-h-0 print:pt-1 print-break-before-page print:break-before-page print-break-inside-avoid"
        >
          <div className="flex flex-col gap-3">
            <ReportRunningHeader
              title="Dossiê Executivo da Posição Vigente"
              periodLabel={periodLabel}
            />
            <ReportPerformanceChart
              series={model.performanceSeries}
              title="Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês"
              className="print-break-inside-avoid"
              annualCdiRate={annualCdiRate}
              annualSelicRate={annualSelicRate}
              annualIpcaRate={annualIpcaRate}
              ibovPeriodReturnPct={ibovPeriodReturnPct}
            />
          </div>

          <ReportFooter
            accountHolder={accountHolder}
            reportType="dossier"
            currentPage={6}
            totalPages={7}
            variant="running"
          />
        </section>
      ) : (
        <section
          aria-label="Comparativo Histórico de Rentabilidade &amp; Patrimônio Mês a Mês"
          className="flex flex-col justify-between gap-3 pt-2 min-h-[960px] print:min-h-0 print:pt-1 break-inside-avoid print:break-inside-avoid w-full"
        >
          <div className="flex flex-col gap-3">
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
          </div>

          <ReportFooter
            accountHolder={accountHolder}
            reportType="dossier"
            currentPage={6}
            totalPages={7}
            variant="running"
          />
        </section>
      )}
    </>
  );
}
