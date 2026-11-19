import { Compass, Gauge, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConsolidatedBenchmarksResult, PortfolioRiskSummary } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";

export interface PerformanceBenchmarksPanelProps {
  seriesLength: number;
  fullAccumulatedRatePct: number;
  periodWindowLabel: string;
  riskPeriodWindowLabel?: string;
  benchmarkComparison: ConsolidatedBenchmarksResult;
  riskSummary: PortfolioRiskSummary;
}

/**
 * Quadro oficial de comparativo contra Benchmarks (CDI, Selic, IPCA, Ibov)
 * e painel de métricas estatísticas de risco & consistência (Sharpe, Drawdown, Volatilidade).
 */
export function PerformanceBenchmarksPanel({
  seriesLength,
  fullAccumulatedRatePct,
  periodWindowLabel,
  riskPeriodWindowLabel,
  benchmarkComparison,
  riskSummary,
}: PerformanceBenchmarksPanelProps) {
  return (
    <>
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-foreground uppercase tracking-wider">
            <Compass className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Benchmarks de Comparação (Desde o Início: {seriesLength} meses)</span>
            <span className="text-positive-strong font-mono font-bold tabular-nums">
              Carteira: {formatSignedPct(fullAccumulatedRatePct)}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            Ganho Real s/ Inflação:{" "}
            <strong
              className={cn(
                "font-bold",
                benchmarkComparison.realReturnPct >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
            >
              {formatSignedPct(benchmarkComparison.realReturnPct)}
            </strong>
            <span className="text-[10px] text-muted-foreground ml-1">(Fisher)</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5">
          {benchmarkComparison.items.map((bm) => (
            <div
              key={bm.key}
              className="rounded-lg border border-border/80 bg-surface p-3 flex flex-col justify-between gap-1.5 shadow-xs"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-foreground line-clamp-2 break-words">{bm.name}</span>
                {bm.pctOfBenchmark !== null ? (
                  <Badge
                    variant={bm.status === "outperforming" ? "positive" : "muted"}
                    size="xs"
                    className="font-mono font-bold shrink-0"
                  >
                    {formatPercent(bm.pctOfBenchmark)}%
                  </Badge>
                ) : null}
              </div>

              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[11px] font-mono text-muted-foreground num tabular-nums whitespace-nowrap">
                  {formatPercent(bm.benchmarkRatePct)}%
                </span>
                <span
                  className={cn(
                    "text-[11px] font-mono font-bold num tabular-nums whitespace-nowrap",
                    bm.alphaPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                  )}
                >
                  {bm.alphaPct >= 0 ? `+${formatPercent(bm.alphaPct)}` : formatPercent(bm.alphaPct)} p.p.
                </span>
              </div>

              <p className="text-[10px] text-muted-foreground font-mono leading-tight line-clamp-2 break-words m-0">
                {bm.sub12m ? (
                  <span>
                    12M: {formatSignedPct(bm.sub12m.portfolio12mRatePct)} vs {formatPercent(bm.sub12m.benchmark12mRatePct)}%
                    {bm.sub12m.pctOf12mBenchmark !== null ? ` (${formatPercent(bm.sub12m.pctOf12mBenchmark)}%)` : ""}
                  </span>
                ) : (
                  bm.description
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground uppercase tracking-wider">
            <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Métricas de Risco &amp; Consistência ({riskPeriodWindowLabel ?? periodWindowLabel})</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">Padrão CFA &amp; ANBIMA</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-border/80 bg-surface p-3 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-foreground">Índice Sharpe</span>
              <Gauge className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className={cn(
                  "text-sm font-mono font-bold num tabular-nums",
                  riskSummary.sharpeRatio !== null && riskSummary.sharpeRatio < 0
                    ? "text-negative-strong"
                    : "text-foreground",
                )}
              >
                {riskSummary.sharpeRatio !== null ? formatPercent(riskSummary.sharpeRatio) : "—"}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  riskSummary.sharpeRatio !== null && riskSummary.sharpeRatio < 0
                    ? "text-negative-strong font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {riskSummary.sharpeLabel}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight m-0">
              Eficiência do retorno excedente sobre o CDI
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-surface p-3 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-foreground">Max Drawdown</span>
              <span className="text-[10px] font-mono text-muted-foreground">Pico-Fundo</span>
            </div>
            <span className="text-sm font-mono font-bold text-negative-strong num tabular-nums">
              {formatSignedPct(riskSummary.maxDrawdown.maxDrawdownPct)}
            </span>
            <p className="text-[10px] text-muted-foreground leading-tight m-0">
              Maior retração histórica suportada no período (TWR)
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-surface p-3 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-foreground">Volatilidade (σ)</span>
              <span className="text-[10px] font-mono text-muted-foreground">Anualizada</span>
            </div>
            <span className="text-sm font-mono font-bold text-foreground num tabular-nums">
              {formatPercent(riskSummary.volatility.annualizedStdDevPct)}% a.a.
            </span>
            <p className="text-[10px] text-muted-foreground leading-tight m-0">
              Desvio padrão amostral ({formatPercent(riskSummary.volatility.monthlyStdDevPct)}% a.m.)
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-surface p-3 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-foreground">Consistência</span>
              <TrendingUp className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-sm font-mono font-bold text-positive-strong num tabular-nums">
                {formatPercent(riskSummary.consistency.winRatePct)}%
              </span>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {riskSummary.consistency.positiveMonths}/{riskSummary.consistency.totalMonths} meses
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono pt-0.5 tabular-nums">
              <span className="text-positive-strong font-bold">
                Max: {formatSignedPct(riskSummary.consistency.bestMonthPct)}
              </span>
              <span className="text-negative-strong font-bold">
                Min: {formatSignedPct(riskSummary.consistency.worstMonthPct)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
