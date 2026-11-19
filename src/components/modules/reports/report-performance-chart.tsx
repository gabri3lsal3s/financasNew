import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
  calculateChainedHistoricalBenchmarks,
  calculateConsolidatedBenchmarks,
  calculatePortfolioRiskSummary,
  DEFAULT_ANNUAL_CDI_RATE,
  DEFAULT_ANNUAL_IPCA_RATE,
} from "@/domain/portfolio";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { PerformanceBenchmarksPanel } from "./performance-benchmarks-panel";
import { PerformanceSvgBars } from "./performance-svg-bars";

export interface ReportPerformancePoint {
  month: string;
  monthLabel: string;
  patrimonyBRL: number;
  ratePct: number | null;
  dividendsBRL?: number;
  costBRL?: number;
  isMtd?: boolean;
}

export interface ReportPerformanceChartProps {
  /** Serie completa de meses historicos da carteira (para benchmarks e metricas de longo prazo). */
  series: readonly ReportPerformancePoint[];
  className?: string;
  title?: string;
  annualCdiRate?: number;
  annualSelicRate?: number;
  annualIpcaRate?: number;
  ibovPeriodReturnPct?: number;
}

/**
 * Gráfico Institucional de Rentabilidade & Análise de Risco (SVG puro).
 * Exibe barras de rentabilidade mês a mês (com distinção MTD), comparativo de
 * Benchmarks (CDI, Selic, IPCA, Ibovespa) e painel de risco (Sharpe, Drawdown, Volatilidade).
 */
export function ReportPerformanceChart({
  series,
  className,
  title = "Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês",
  annualCdiRate = DEFAULT_ANNUAL_CDI_RATE,
  annualSelicRate = DEFAULT_ANNUAL_CDI_RATE,
  annualIpcaRate = DEFAULT_ANNUAL_IPCA_RATE,
  ibovPeriodReturnPct,
}: ReportPerformanceChartProps) {
  const activeMonth = currentMonth();

  const displaySeries = useMemo(() => {
    if (!series || series.length < 2) return [];
    return series.slice(-12).map((p) => {
      const isMtd = p.isMtd ?? p.month === activeMonth;
      return {
        ...p,
        isMtd,
        rawMonthLabel: p.monthLabel,
        monthLabel: isMtd ? `${p.monthLabel}*` : p.monthLabel,
      };
    });
  }, [series, activeMonth]);

  const mtdPoint = useMemo(() => displaySeries.find((p) => p.isMtd), [displaySeries]);
  const rates = useMemo(() => displaySeries.map((p) => p.ratePct ?? 0), [displaySeries]);

  const maxAbsRate = useMemo(() => {
    if (rates.length === 0) return 1;
    const maxVal = Math.max(...rates.map((r) => Math.abs(r)), 1);
    return Math.max(2, Math.ceil(maxVal * 1.25));
  }, [rates]);

  const display12mAccumulatedRatePct = useMemo(() => {
    const factor = rates.reduce((acc, r) => acc * (1 + r / 100), 1);
    return Math.round((factor - 1) * 10000) / 100;
  }, [rates]);

  const fullAccumulatedRatePct = useMemo(() => {
    const allRates = series.map((s) => s.ratePct ?? 0);
    const factor = allRates.reduce((acc, r) => acc * (1 + r / 100), 1);
    return Math.round((factor - 1) * 10000) / 100;
  }, [series]);

  const periodWindowLabel = useMemo(() => {
    if (displaySeries.length === 0) return "";
    const first = displaySeries[0]?.rawMonthLabel ?? displaySeries[0]?.monthLabel.replace("*", "") ?? "";
    const last = displaySeries[displaySeries.length - 1]?.rawMonthLabel ?? displaySeries[displaySeries.length - 1]?.monthLabel.replace("*", "") ?? "";
    return `${first} a ${last}`;
  }, [displaySeries]);

  const effectiveCdiRate = useMemo(() => {
    if (annualCdiRate && Number.isFinite(annualCdiRate) && annualCdiRate > 0) {
      return annualCdiRate;
    }
    return DEFAULT_ANNUAL_CDI_RATE;
  }, [annualCdiRate]);

  // Série de Risco: 12 meses fechados homogêneos (Padrão CFA & ANBIMA)
  const riskSeries = useMemo(() => {
    if (!series || series.length < 2) return [];
    const closed = series.filter((p) => !(p.isMtd ?? p.month === activeMonth));
    if (closed.length >= 12) {
      return closed.slice(-12);
    }
    return closed.length > 0 ? closed : series;
  }, [series, activeMonth]);

  const riskPeriodWindowLabel = useMemo(() => {
    if (riskSeries.length === 0) return periodWindowLabel;
    const first = riskSeries[0]?.monthLabel?.replace("*", "") ?? "";
    const last = riskSeries[riskSeries.length - 1]?.monthLabel?.replace("*", "") ?? "";
    return `${first} a ${last}`;
  }, [riskSeries, periodWindowLabel]);

  const riskMonths = useMemo(() => riskSeries.map((s) => s.month), [riskSeries]);
  const riskChainedBenchmarks = useMemo(
    () => (riskMonths.length >= 2 ? calculateChainedHistoricalBenchmarks(riskMonths) : null),
    [riskMonths],
  );
  const riskFreeRatePct = useMemo(() => {
    if (riskChainedBenchmarks?.hasRealSeries && riskChainedBenchmarks.cdiRatePct > 0) {
      return riskChainedBenchmarks.cdiRatePct;
    }
    return effectiveCdiRate;
  }, [riskChainedBenchmarks, effectiveCdiRate]);

  const riskSummary = useMemo(() => {
    return calculatePortfolioRiskSummary(riskSeries, riskFreeRatePct, {
      hasPartialCurrentMonth: false,
      useTrailing12Months: true,
      includeMtdInDrawdown: false,
    });
  }, [riskSeries, riskFreeRatePct]);

  const benchmarkComparison = useMemo(
    () =>
      calculateConsolidatedBenchmarks({
        portfolioRatePct: fullAccumulatedRatePct,
        monthsCount: series.length,
        annualCdiRate: effectiveCdiRate,
        annualSelicRate,
        annualIpcaRate,
        ibovPeriodRatePct: ibovPeriodReturnPct,
        portfolio12mRatePct: display12mAccumulatedRatePct,
        monthsList: series.map((s) => s.month),
      }),
    [
      fullAccumulatedRatePct,
      series,
      effectiveCdiRate,
      annualSelicRate,
      annualIpcaRate,
      ibovPeriodReturnPct,
      display12mAccumulatedRatePct,
    ],
  );

  if (!series || series.length < 2 || displaySeries.length < 2) {
    return null;
  }

  return (
    <section
      aria-label={title}
      className={cn("flex flex-col gap-3 pt-2 print:pt-1 break-inside-avoid print:break-inside-avoid w-full", className)}
    >
      <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider">{title}</h3>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono num tabular-nums">
          Últimas {displaySeries.length} competências ({periodWindowLabel})
        </span>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 print:border-border shadow-xs w-full flex flex-col gap-3">
        <PerformanceSvgBars
          displaySeries={displaySeries}
          maxAbsRate={maxAbsRate}
          mtdPoint={mtdPoint}
        />

        <PerformanceBenchmarksPanel
          seriesLength={series.length}
          fullAccumulatedRatePct={fullAccumulatedRatePct}
          periodWindowLabel={periodWindowLabel}
          riskPeriodWindowLabel={riskPeriodWindowLabel}
          benchmarkComparison={benchmarkComparison}
          riskSummary={riskSummary}
        />
      </div>
    </section>
  );
}
