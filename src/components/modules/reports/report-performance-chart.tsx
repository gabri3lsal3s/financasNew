import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
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

  const riskSummary = useMemo(() => {
    const hasPartialCurrentMonth = displaySeries.some((p) => p.isMtd);
    return calculatePortfolioRiskSummary(displaySeries, effectiveCdiRate, {
      hasPartialCurrentMonth,
    });
  }, [displaySeries, effectiveCdiRate]);

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
      }),
    [
      fullAccumulatedRatePct,
      series.length,
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
          benchmarkComparison={benchmarkComparison}
          riskSummary={riskSummary}
        />
      </div>
    </section>
  );
}
