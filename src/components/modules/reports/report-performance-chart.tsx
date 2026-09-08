import { useMemo } from "react";
import { BarChart3, ShieldCheck, TrendingUp, Gauge, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatSignedPct, formatPercent } from "@/services/masks/percent";
import {
  calculatePortfolioRiskSummary,
  calculateConsolidatedBenchmarks,
  DEFAULT_ANNUAL_CDI_RATE,
  DEFAULT_ANNUAL_IPCA_RATE,
} from "@/domain/portfolio";

export interface ReportPerformancePoint {
  month: string;
  monthLabel: string;
  patrimonyBRL: number;
  ratePct: number | null;
  dividendsBRL?: number;
  costBRL?: number;
}

export interface ReportPerformanceChartProps {
  series: readonly ReportPerformancePoint[];
  className?: string;
  title?: string;
  annualCdiRate?: number;
  annualSelicRate?: number;
  annualIpcaRate?: number;
  ibovPeriodReturnPct?: number;
}

const SVG_WIDTH = 560;
const SVG_HEIGHT = 140;
const PAD_X = 32;
const PAD_TOP = 20;
const PAD_BOTTOM = 24;

/**
 * Gráfico Institucional de Rentabilidade & Análise de Risco (SVG puro).
 * Projetado especificamente para impressão A4 e visualização em alta fidelidade.
 * Exibe:
 * 1. Gráfico de barras de rentabilidade mês a mês limpo e sem sobreposições;
 * 2. Quadro comparativo oficial de Benchmarks (CDI, Poupança, IPCA/Inflação e IBOVESPA);
 * 3. Painel de Métricas Avançadas de Risco & Eficiência (Índice Sharpe, Volatilidade, Max Drawdown e Consistência).
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
  // Considera no máximo as últimas 12 competências para manter clareza e legibilidade no A4
  const displaySeries = useMemo(() => {
    if (!series || series.length < 2) return [];
    return series.slice(-12);
  }, [series]);

  const rates = useMemo(() => displaySeries.map((p) => p.ratePct ?? 0), [displaySeries]);
  const maxAbsRate = useMemo(() => {
    if (rates.length === 0) return 1;
    const maxVal = Math.max(...rates.map((r) => Math.abs(r)), 1);
    return Math.max(2, Math.ceil(maxVal * 1.25)); // ao menos 2% e 25% de margem no topo
  }, [rates]);

  // Rentabilidade acumulada rigorosa das competências exibidas no gráfico
  const seriesAccumulatedRatePct = useMemo(() => {
    const factor = rates.reduce((acc, r) => acc * (1 + r / 100), 1);
    return Math.round((factor - 1) * 10000) / 100;
  }, [rates]);

  // Rótulo da janela temporal avaliada (ex: "10/25 a 09/26")
  const periodWindowLabel = useMemo(() => {
    if (displaySeries.length === 0) return "";
    const first = displaySeries[0]?.monthLabel ?? "";
    const last = displaySeries[displaySeries.length - 1]?.monthLabel ?? "";
    return `${first} a ${last}`;
  }, [displaySeries]);

  // Taxa livre de risco ponderada para a janela de 12 meses (CDI anualizado canônico de 10.5% a.a. como teto histórico seguro)
  const effectiveCdiRate = useMemo(() => {
    if (annualCdiRate && annualCdiRate > 0 && annualCdiRate <= 12.0) {
      return annualCdiRate;
    }
    return DEFAULT_ANNUAL_CDI_RATE;
  }, [annualCdiRate]);

  // Resumo de Risco (Sharpe, Drawdown, Volatilidade, Win Rate)
  const riskSummary = useMemo(() => {
    return calculatePortfolioRiskSummary(displaySeries, effectiveCdiRate);
  }, [displaySeries, effectiveCdiRate]);

  // Comparativos Oficiais de Benchmarks (CDI, Poupança, IPCA, IBOVESPA) para o período da série
  const benchmarkComparison = useMemo(() => {
    return calculateConsolidatedBenchmarks({
      portfolioRatePct: seriesAccumulatedRatePct,
      monthsCount: displaySeries.length,
      annualCdiRate: effectiveCdiRate,
      annualSelicRate,
      annualIpcaRate,
      ibovPeriodRatePct: ibovPeriodReturnPct,
    });
  }, [
    seriesAccumulatedRatePct,
    displaySeries.length,
    effectiveCdiRate,
    annualSelicRate,
    annualIpcaRate,
    ibovPeriodReturnPct,
  ]);

  // Salvaguarda: só renderiza se houver 2 ou mais competências
  if (!series || series.length < 2 || displaySeries.length < 2) {
    return null;
  }

  const usableHeight = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const zeroY = PAD_TOP + usableHeight / 2;

  const count = displaySeries.length;
  const stepX = (SVG_WIDTH - PAD_X * 2) / count;
  const barWidth = Math.min(26, Math.max(12, stepX * 0.5));

  return (
    <section
      aria-label={title}
      className={cn("flex flex-col gap-3 pt-2 print:pt-1 break-inside-avoid print:break-inside-avoid w-full", className)}
    >
      <div className="report-section-header flex items-center justify-between border-b border-border/70 pb-1.5">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-3.5 text-primary-strong" aria-hidden="true" />
          <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono num">
          Últimas {displaySeries.length} competências ({periodWindowLabel})
        </span>
      </div>

      <div className="rounded-xl border border-border/80 bg-transparent p-3 print:border-border shadow-2xs w-full flex flex-col gap-3">
        {/* Gráfico SVG de Barras de Rentabilidade Limpo (Sem Linhas Invasivas Cruzando) */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label="Gráfico de barras da rentabilidade percentual mês a mês"
          >
            {/* Linha Zero de Referência Pontilhada */}
            <line
              x1={PAD_X}
              y1={zeroY}
              x2={SVG_WIDTH - PAD_X}
              y2={zeroY}
              stroke="currentColor"
              strokeDasharray="2 2"
              className="text-border/80 stroke-[1]"
            />

            {/* Eixo Superior (+max) e Inferior (-max) */}
            <text
              x={PAD_X - 4}
              y={PAD_TOP + 4}
              textAnchor="end"
              className="text-[8.5px] font-mono fill-muted-foreground num"
            >
              +{maxAbsRate}%
            </text>
            <text
              x={PAD_X - 4}
              y={zeroY + 3}
              textAnchor="end"
              className="text-[8.5px] font-mono fill-muted-foreground/80 num"
            >
              0%
            </text>
            <text
              x={PAD_X - 4}
              y={SVG_HEIGHT - PAD_BOTTOM}
              textAnchor="end"
              className="text-[8.5px] font-mono fill-muted-foreground num"
            >
              -{maxAbsRate}%
            </text>

            {/* Barras por Mês */}
            {displaySeries.map((point, idx) => {
              const centerX = PAD_X + idx * stepX + stepX / 2;
              const rate = point.ratePct ?? 0;
              const barHeight = Math.min(usableHeight / 2, (Math.abs(rate) / maxAbsRate) * (usableHeight / 2));
              const isPositive = rate >= 0;
              const barY = isPositive ? zeroY - barHeight : zeroY;

              return (
                <g key={point.month}>
                  <rect
                    x={centerX - barWidth / 2}
                    y={barY}
                    width={barWidth}
                    height={Math.max(2, barHeight)}
                    rx={2}
                    className={cn(
                      isPositive ? "fill-positive-strong" : "fill-negative-strong",
                      "transition-all",
                    )}
                  />
                  {/* Rótulo de Taxa no Topo da Barra */}
                  <text
                    x={centerX}
                    y={isPositive ? barY - 4 : barY + barHeight + 8}
                    textAnchor="middle"
                    className={cn(
                      "text-[8.5px] font-mono font-bold num",
                      isPositive ? "fill-positive-strong" : "fill-negative-strong",
                    )}
                  >
                    {formatSignedPct(rate)}
                  </text>
                  {/* Rótulo do Mês no Eixo X */}
                  <text
                    x={centerX}
                    y={SVG_HEIGHT - 6}
                    textAnchor="middle"
                    className="text-[8.5px] font-mono fill-muted-foreground"
                  >
                    {point.monthLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 1. Painel Oficial de Benchmarks de Mercado (Comparativo Institucional do Período) */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between border-b border-border/60 pb-1">
            <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-foreground uppercase tracking-wider">
              <Compass className="size-3 text-primary-strong" aria-hidden="true" />
              <span>Benchmarks de Comparação ({periodWindowLabel})</span>
              <span className="text-positive-strong font-mono font-bold">
                • Carteira: {formatSignedPct(seriesAccumulatedRatePct)}
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground font-mono">
              Ganho Real s/ Inflação:{" "}
              <strong
                className={cn(
                  "font-bold",
                  benchmarkComparison.realReturnPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                )}
              >
                {formatSignedPct(benchmarkComparison.realReturnPct)}
              </strong>
              <span className="text-[8px] text-muted-foreground/70 ml-1">(Fisher)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {benchmarkComparison.items.map((bm) => (
              <div
                key={bm.key}
                className="rounded-lg border border-border/70 bg-transparent p-2 flex flex-col justify-between gap-1 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-foreground">{bm.name}</span>
                  {bm.pctOfBenchmark !== null ? (
                    <Badge
                      variant={bm.status === "outperforming" ? "default" : "muted"}
                      size="xs"
                      className={cn(
                        "font-mono font-bold",
                        bm.status === "outperforming"
                          ? "bg-positive/15 text-positive-strong border-positive/30"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatPercent(bm.pctOfBenchmark)}%
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10.5px] font-mono text-muted-foreground num">
                    {formatPercent(bm.benchmarkRatePct)}%
                  </span>
                  <span
                    className={cn(
                      "text-[10.5px] font-mono font-bold num",
                      bm.alphaPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                    )}
                  >
                    {bm.alphaPct >= 0 ? `+${bm.alphaPct.toFixed(1)}` : bm.alphaPct.toFixed(1)} p.p.
                  </span>
                </div>

                <p className="text-[8.5px] text-muted-foreground/80 truncate leading-tight">
                  {bm.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Painel de Métricas Avançadas de Risco & Eficiência */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between border-b border-border/60 pb-1">
            <div className="flex items-center gap-1 text-[9.5px] font-bold text-foreground uppercase tracking-wider">
              <ShieldCheck className="size-3 text-primary-strong" aria-hidden="true" />
              <span>Métricas de Risco & Consistência ({periodWindowLabel})</span>
            </div>
            <span className="text-[9px] text-muted-foreground font-mono">
              Padrão CFA & ANBIMA
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Índice de Sharpe */}
            <div className="rounded-lg border border-border/70 bg-transparent p-2 flex flex-col justify-between gap-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground">Índice Sharpe</span>
                <Gauge className="size-3 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "text-sm font-mono font-bold num",
                    riskSummary.sharpeRatio !== null && riskSummary.sharpeRatio < 0
                      ? "text-negative-strong"
                      : "text-foreground",
                  )}
                >
                  {riskSummary.sharpeRatio !== null ? formatPercent(riskSummary.sharpeRatio) : "—"}
                </span>
                <span
                  className={cn(
                    "text-[8.5px] font-medium",
                    riskSummary.sharpeRatio !== null && riskSummary.sharpeRatio < 0
                      ? "text-negative-strong font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {riskSummary.sharpeLabel}
                </span>
              </div>
              <p className="text-[8.5px] text-muted-foreground/80 leading-tight">
                Eficiência do retorno excedente sobre o CDI
              </p>
            </div>

            {/* Max Drawdown */}
            <div className="rounded-lg border border-border/70 bg-transparent p-2 flex flex-col justify-between gap-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground">Max Drawdown</span>
                <span className="text-[8.5px] font-mono text-muted-foreground">Pico-Fundo</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-mono font-bold text-negative-strong num">
                  {formatSignedPct(riskSummary.maxDrawdown.maxDrawdownPct)}
                </span>
              </div>
              <p className="text-[8.5px] text-muted-foreground/80 leading-tight">
                Maior retração histórica suportada no período (TWR)
              </p>
            </div>

            {/* Volatilidade Anualizada */}
            <div className="rounded-lg border border-border/70 bg-transparent p-2 flex flex-col justify-between gap-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground">Volatilidade (σ)</span>
                <span className="text-[8.5px] font-mono text-muted-foreground">Anualizada</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-mono font-bold text-foreground num">
                  {formatPercent(riskSummary.volatility.annualizedStdDevPct)}% a.a.
                </span>
              </div>
              <p className="text-[8.5px] text-muted-foreground/80 leading-tight">
                Desvio padrão amostral ({formatPercent(riskSummary.volatility.monthlyStdDevPct)}% a.m.)
              </p>
            </div>

            {/* Consistência / Win Rate */}
            <div className="rounded-lg border border-border/70 bg-transparent p-2 flex flex-col justify-between gap-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground">Consistência</span>
                <TrendingUp className="size-3 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-sm font-mono font-bold text-positive-strong num">
                  {formatPercent(riskSummary.consistency.winRatePct)}%
                </span>
                <span className="text-[8.5px] font-mono text-muted-foreground">
                  {riskSummary.consistency.positiveMonths}/{riskSummary.consistency.totalMonths} meses
                </span>
              </div>
              <div className="flex items-center justify-between text-[8px] font-mono pt-0.5">
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
      </div>
    </section>
  );
}
