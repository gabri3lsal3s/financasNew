import { useMemo } from "react";
import { Layers, PieChart } from "lucide-react";
import {
  CustodyReconciliationCard,
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
import type {
  CustodyReconciliationSummary,
  ProvisionedDividendsSummary,
} from "@/domain/portfolio";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  computeTearSheetPagination,
  type PeriodRedemptionItem,
  type TearSheetModel,
  type TearSheetPageNumbers,
} from "@/domain/reports";
import type { PortfolioAsset } from "@/types";

export interface TearSheetCustodyAndBreakdownsProps {
  model: TearSheetModel;
  totalBRL: number;
  periodLabel: string;
  accountHolder?: string;
  periodRedemptions?: readonly PeriodRedemptionItem[];
  assetsMetadata: readonly PortfolioAsset[];
  custodyReconciliation?: CustodyReconciliationSummary | null;
  provisionedSummary?: ProvisionedDividendsSummary | null;
  annualCdiRate?: number;
  annualSelicRate?: number;
  annualIpcaRate?: number;
  ibovPeriodReturnPct?: number;
  totalPages?: number;
  pageNumbers?: TearSheetPageNumbers;
}

export function TearSheetCustodyAndBreakdowns({
  model,
  totalBRL,
  periodLabel,
  accountHolder,
  periodRedemptions,
  assetsMetadata,
  custodyReconciliation,
  provisionedSummary = null,
  annualCdiRate,
  annualSelicRate,
  annualIpcaRate,
  ibovPeriodReturnPct,
  totalPages: propTotalPages,
  pageNumbers: propPageNumbers,
}: TearSheetCustodyAndBreakdownsProps) {
  const pagination = useMemo(
    () => computeTearSheetPagination(model, assetsMetadata),
    [model, assetsMetadata],
  );

  const totalPages = propTotalPages ?? pagination.totalPages;
  const pageNumbers = propPageNumbers ?? pagination.pageNumbers;
  const { activeXrays, hasDonutPage, hasPerformancePage } = pagination;

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

          {custodyReconciliation ? (
            <CustodyReconciliationCard
              variant="report"
              summary={custodyReconciliation}
              provisionedSummary={provisionedSummary}
            />
          ) : null}

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
          currentPage={pageNumbers.custody}
          totalPages={totalPages}
          variant="running"
        />
      </section>

      {/* PÁGINA 3: Detalhamento Gráfico de Alocação e Setores */}
      {hasDonutPage && pageNumbers.donut && (
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
            currentPage={pageNumbers.donut}
            totalPages={totalPages}
            variant="running"
          />
        </section>
      )}

      {/* RAIOS-X: Subalocação por Classe de Ativos */}
      {/* Caso 1: 1 a 2 cartões de Raio-X ativos -> Agrupamento inteligente em 1 página única */}
      {activeXrays.activeXrayCount > 0 && activeXrays.activeXrayCount <= 2 && pageNumbers.xray1 && (
        <section
          aria-label="Raios-X Analíticos de Subalocação por Classe"
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
                  Raios-X de Subalocação da Carteira
                </h3>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                Decomposição Analítica de Carteira
              </span>
            </div>

            <div className="flex flex-col gap-3.5 w-full">
              {activeXrays.hasStocks && (
                <ReportStocksBreakdownCard
                  positions={model.breakdownRows}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
              {activeXrays.hasFiis && (
                <ReportFiiBreakdownCard
                  positions={model.breakdownRows}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
              {activeXrays.hasRF && (
                <ReportFixedIncomeBreakdownCard
                  positions={model.breakdownRows}
                  assetsMetadata={assetsMetadata}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
              {activeXrays.hasIntl && (
                <ReportInternationalBreakdownCard
                  positions={model.breakdownRows}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
            </div>
          </div>

          <ReportFooter
            accountHolder={accountHolder}
            reportType="dossier"
            currentPage={pageNumbers.xray1}
            totalPages={totalPages}
            variant="running"
          />
        </section>
      )}

      {/* Caso 2: 3 a 4 cartões de Raio-X ativos -> 2 páginas equilibradas */}
      {activeXrays.activeXrayCount >= 3 && pageNumbers.xray1 && (
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
              {activeXrays.hasStocks && (
                <ReportStocksBreakdownCard
                  positions={model.breakdownRows}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
              {activeXrays.hasFiis && (
                <ReportFiiBreakdownCard
                  positions={model.breakdownRows}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
            </div>
          </div>

          <ReportFooter
            accountHolder={accountHolder}
            reportType="dossier"
            currentPage={pageNumbers.xray1}
            totalPages={totalPages}
            variant="running"
          />
        </section>
      )}

      {activeXrays.activeXrayCount >= 3 && pageNumbers.xray2 && (
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
              {activeXrays.hasRF && (
                <ReportFixedIncomeBreakdownCard
                  positions={model.breakdownRows}
                  assetsMetadata={assetsMetadata}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
              {activeXrays.hasIntl && (
                <ReportInternationalBreakdownCard
                  positions={model.breakdownRows}
                  mode="print_all"
                  className="print:border-border print:bg-surface print:p-3 print:shadow-none break-inside-avoid print:break-inside-avoid"
                />
              )}
            </div>
          </div>

          <ReportFooter
            accountHolder={accountHolder}
            reportType="dossier"
            currentPage={pageNumbers.xray2}
            totalPages={totalPages}
            variant="running"
          />
        </section>
      )}

      {/* PÁGINA: Comparativo Histórico de Rentabilidade & Benchmarks (omitida se < 2 meses) */}
      {hasPerformancePage && pageNumbers.performance && (
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
            currentPage={pageNumbers.performance}
            totalPages={totalPages}
            variant="running"
          />
        </section>
      )}
    </>
  );
}
