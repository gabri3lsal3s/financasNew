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
      <div className="flex flex-col gap-2 pt-1 break-inside-avoid">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-foreground uppercase tracking-wider">
            <Compass className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>
              Benchmarks de Comparação (
              {seriesLength === 12
                ? `Últimos 12 Meses Fechados${periodWindowLabel ? ` · ${periodWindowLabel}` : ""}`
                : `Histórico: ${seriesLength} meses${periodWindowLabel ? ` · ${periodWindowLabel}` : ""}`}
              )
            </span>
            <span className="text-positive-strong font-mono font-bold tabular-nums">
              Carteira: {formatSignedPct(fullAccumulatedRatePct)}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums whitespace-nowrap shrink-0 pl-1">
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

        {/* Tabela Institucional de Benchmarks */}
        <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-lg border border-border/80 print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <colgroup>
              <col style={{ width: seriesLength === 12 ? "34%" : "28%" }} />
              <col style={{ width: seriesLength === 12 ? "22%" : "18%" }} />
              <col style={{ width: seriesLength === 12 ? "22%" : "18%" }} />
              <col style={{ width: seriesLength === 12 ? "22%" : "18%" }} />
              {seriesLength !== 12 && <col style={{ width: "18%" }} />}
            </colgroup>
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[9px] uppercase tracking-wider">
                <th className="py-1 px-2.5">Benchmark</th>
                <th className="py-1 px-2 text-right">Acumulado ({seriesLength}M)</th>
                <th className="py-1 px-2 text-right">Spread (p.p.)</th>
                <th className="py-1 px-2 text-right">% do Índice</th>
                {seriesLength !== 12 && <th className="py-1 px-2 text-right">Últimos 12M</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {benchmarkComparison.items.map((bm) => (
                <tr key={bm.key} className="break-inside-avoid even:bg-muted/10">
                  <td className="py-1.5 px-2.5">
                    <span className="font-bold text-foreground text-[10.5px] block">{bm.name}</span>
                    <span className="text-[9px] text-muted-foreground block truncate">{bm.description}</span>
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono num tabular-nums text-foreground text-[10.5px]">
                    {formatPercent(bm.benchmarkRatePct)}%
                  </td>
                  <td
                    className={cn(
                      "py-1.5 px-2 text-right font-mono font-bold num tabular-nums text-[10.5px]",
                      bm.alphaPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                    )}
                  >
                    {bm.alphaPct >= 0 ? `+${formatPercent(bm.alphaPct)}` : formatPercent(bm.alphaPct)} p.p.
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    {bm.pctOfBenchmark !== null ? (
                      <Badge
                        variant={bm.status === "outperforming" ? "positive" : "muted"}
                        size="xs"
                        className="font-mono font-bold"
                      >
                        {formatPercent(bm.pctOfBenchmark)}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground font-mono text-[10px]">—</span>
                    )}
                  </td>
                  {seriesLength !== 12 && (
                    <td className="py-1.5 px-2 text-right font-mono num text-[10px] text-muted-foreground">
                      {bm.sub12m ? (
                        <span>
                          {formatPercent(bm.sub12m.benchmark12mRatePct)}%
                          {bm.sub12m.pctOf12mBenchmark !== null && (
                            <span className="ml-1 text-[9px] font-bold text-foreground">
                              ({formatPercent(bm.sub12m.pctOf12mBenchmark)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1 break-inside-avoid">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground uppercase tracking-wider">
            <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Métricas de Risco &amp; Consistência ({riskPeriodWindowLabel ?? periodWindowLabel})</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">Padrão CFA &amp; ANBIMA</span>
        </div>

        {/* KPI Strip Institucional de 4 Colunas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-border/80 bg-surface p-2.5 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1 h-4.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">SHARPE</span>
              <Gauge className="size-3.5 text-muted-foreground shrink-0 print:hidden" aria-hidden="true" />
            </div>
            <div className="h-6 flex items-baseline gap-1.5 flex-wrap">
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
            <p className="text-[9px] text-muted-foreground leading-tight m-0">
              Excedente sobre CDI / Volatilidade
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-surface p-2.5 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1 h-4.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">MAX DRAWDOWN</span>
            </div>
            <div className="h-6 flex items-baseline gap-1.5">
              <span className="text-sm font-mono font-bold text-negative-strong num tabular-nums">
                {formatSignedPct(riskSummary.maxDrawdown.maxDrawdownPct)}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-tight m-0">
              Retração histórica pico-a-fundo (TWR)
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-surface p-2.5 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1 h-4.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                VOLATILIDADE <span className="normal-case font-serif">(σ)</span>
              </span>
            </div>
            <div className="h-6 flex items-baseline gap-1.5">
              <span className="text-sm font-mono font-bold text-foreground num tabular-nums">
                {formatPercent(riskSummary.volatility.annualizedStdDevPct)}% a.a.
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-tight m-0">
              Desvio amostral ({formatPercent(riskSummary.volatility.monthlyStdDevPct)}% a.m.)
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-surface p-2.5 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-1 h-4.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">CONSISTÊNCIA</span>
              <TrendingUp className="size-3.5 text-muted-foreground shrink-0 print:hidden" aria-hidden="true" />
            </div>
            <div className="h-6 flex items-baseline justify-between gap-1">
              <span className="text-sm font-mono font-bold text-positive-strong num tabular-nums">
                {formatPercent(riskSummary.consistency.winRatePct)}%
              </span>
              <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
                {riskSummary.consistency.positiveMonths}/{riskSummary.consistency.totalMonths}m
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono pt-0.5 tabular-nums">
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
