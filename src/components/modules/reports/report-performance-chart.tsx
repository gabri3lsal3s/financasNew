import { useMemo } from "react";
import { BarChart3, ShieldCheck, TrendingUp, Gauge, Compass, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatSignedPct, formatPercent } from "@/services/masks/percent";
import {
  calculatePortfolioRiskSummary,
  calculateConsolidatedBenchmarks,
  DEFAULT_ANNUAL_CDI_RATE,
  DEFAULT_ANNUAL_IPCA_RATE,
} from "@/domain/portfolio";
import { currentMonth } from "@/lib/date";

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

const SVG_WIDTH = 560;
const SVG_HEIGHT = 148;
const PAD_X = 32;
const PAD_TOP = 20;
const PAD_BOTTOM = 32;

/**
 * Grafico Institucional de Rentabilidade & Analise de Risco (SVG puro).
 * Exibe:
 * 1. Grafico de barras de rentabilidade mes a mes limpo com distincao visual explicita para mes MTD aberto;
 * 2. Quadro comparativo oficial de Benchmarks com visao hibrida (Destaque Desde o Inicio + Subtitulo 12M);
 * 3. Painel de Metricas Avancadas de Risco & Eficiencia (Sharpe, Volatilidade segregando MTD, Drawdown, Consistencia).
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

  // Considera no maximo as ultimas 12 competencias para manter clareza no layout A4
  const displaySeries = useMemo(() => {
    if (!series || series.length < 2) return [];
    return series.slice(-12).map((p) => {
      const isMtd = p.isMtd ?? (p.month === activeMonth);
      return {
        ...p,
        isMtd,
        rawMonthLabel: p.monthLabel,
        // Mantém label limpo e conciso para não colidir no eixo X do gráfico
        monthLabel: isMtd ? `${p.monthLabel}*` : p.monthLabel,
      };
    });
  }, [series, activeMonth]);

  const mtdPoint = useMemo(
    () => displaySeries.find((p) => p.isMtd),
    [displaySeries],
  );
  const hasMtd = Boolean(mtdPoint);

  const rates = useMemo(() => displaySeries.map((p) => p.ratePct ?? 0), [displaySeries]);
  const maxAbsRate = useMemo(() => {
    if (rates.length === 0) return 1;
    const maxVal = Math.max(...rates.map((r) => Math.abs(r)), 1);
    return Math.max(2, Math.ceil(maxVal * 1.25));
  }, [rates]);

  // Rentabilidade acumulada das ultimas 12 competencias exibidas no grafico
  const display12mAccumulatedRatePct = useMemo(() => {
    const factor = rates.reduce((acc, r) => acc * (1 + r / 100), 1);
    return Math.round((factor - 1) * 10000) / 100;
  }, [rates]);

  // Rentabilidade acumulada total de toda a serie historica da carteira
  const fullAccumulatedRatePct = useMemo(() => {
    const allRates = series.map((s) => s.ratePct ?? 0);
    const factor = allRates.reduce((acc, r) => acc * (1 + r / 100), 1);
    return Math.round((factor - 1) * 10000) / 100;
  }, [series]);

  // Rotulo da janela temporal do grafico (ex: "10/25 a 09/26")
  const periodWindowLabel = useMemo(() => {
    if (displaySeries.length === 0) return "";
    const first = displaySeries[0]?.rawMonthLabel ?? displaySeries[0]?.monthLabel.replace("*", "") ?? "";
    const last = displaySeries[displaySeries.length - 1]?.rawMonthLabel ?? displaySeries[displaySeries.length - 1]?.monthLabel.replace("*", "") ?? "";
    return `${first} a ${last}`;
  }, [displaySeries]);

  const effectiveCdiRate = useMemo(() => {
    if (annualCdiRate && annualCdiRate > 0 && annualCdiRate <= 12.0) {
      return annualCdiRate;
    }
    return DEFAULT_ANNUAL_CDI_RATE;
  }, [annualCdiRate]);

  // Resumo de Risco (Sharpe, Drawdown, Volatilidade, Win Rate) com segregacao de MTD
  const riskSummary = useMemo(() => {
    const hasPartialCurrentMonth = displaySeries.some((p) => p.isMtd);
    return calculatePortfolioRiskSummary(displaySeries, effectiveCdiRate, {
      hasPartialCurrentMonth,
    });
  }, [displaySeries, effectiveCdiRate]);

  // Comparativos de Benchmarks com visao hibrida: Total Desde o Inicio + Janela 12M
  const benchmarkComparison = useMemo(() => {
    return calculateConsolidatedBenchmarks({
      portfolioRatePct: fullAccumulatedRatePct,
      monthsCount: series.length,
      annualCdiRate: effectiveCdiRate,
      annualSelicRate,
      annualIpcaRate,
      ibovPeriodRatePct: ibovPeriodReturnPct,
      portfolio12mRatePct: display12mAccumulatedRatePct,
    });
  }, [
    fullAccumulatedRatePct,
    series.length,
    effectiveCdiRate,
    annualSelicRate,
    annualIpcaRate,
    ibovPeriodReturnPct,
    display12mAccumulatedRatePct,
  ]);

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
        {/* Grafico SVG de Barras de Rentabilidade */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label="Gráfico de barras da rentabilidade percentual mês a mês"
          >
            {/* Linha Zero de Referencia Pontilhada */}
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

            {/* Barras por Mes */}
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
                      point.isMtd && "stroke-primary stroke-1 stroke-dasharray-[2,2] opacity-85",
                      "transition-all",
                    )}
                  />
                  {/* Rotulo de Taxa no Topo da Barra */}
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
                  {/* Rotulo do Mes no Eixo X (Alinhado e sem colisão) */}
                  <text
                    x={centerX}
                    y={SVG_HEIGHT - 17}
                    textAnchor="middle"
                    className={cn(
                      "text-[8px] font-mono",
                      point.isMtd ? "fill-primary font-bold" : "fill-muted-foreground",
                    )}
                  >
                    {point.monthLabel}
                  </text>
                  {/* Indicador MTD em segunda linha exclusiva sem invadir as colunas vizinhas */}
                  {point.isMtd && (
                    <g aria-label="Mês corrente parcial (Month to Date)">
                      <rect
                        x={centerX - 13}
                        y={SVG_HEIGHT - 12}
                        width={26}
                        height={9}
                        rx={2}
                        className="fill-primary/10 stroke-primary/30 stroke-[0.5]"
                      />
                      <text
                        x={centerX}
                        y={SVG_HEIGHT - 5.5}
                        textAnchor="middle"
                        className="text-[6.5px] font-mono font-bold fill-primary tracking-wider"
                      >
                        MTD
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Footer / Nota Metodológica Explicativa de Competência Parcial (MTD) */}
        {hasMtd && (
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-surface/50 p-2 text-[8.5px] text-muted-foreground print:bg-transparent">
            <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-foreground">
                * {mtdPoint?.rawMonthLabel ?? mtdPoint?.monthLabel} (MTD — Month to Date): competência corrente parcial em andamento
              </span>
              <p className="m-0 leading-relaxed text-muted-foreground/90">
                Os dados desta barra refletem a posição em tempo real acumulada no mês até a data de emissão do relatório. Por rigor regulatório e metodológico (Padrão CFA & CVM/ANBIMA), o mês incompleto é automaticamente segregado do cálculo da volatilidade anualizada e do Índice de Sharpe para não introduzir distorção estatística de amostragem heterogênea.
              </p>
            </div>
          </div>
        )}

        {/* 1. Painel Oficial de Benchmarks com Visao Hibrida */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between border-b border-border/60 pb-1">
            <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-foreground uppercase tracking-wider">
              <Compass className="size-3 text-primary-strong" aria-hidden="true" />
              <span>Benchmarks de Comparação (Desde o Início: {series.length} meses)</span>
              <span className="text-positive-strong font-mono font-bold">
                • Carteira: {formatSignedPct(fullAccumulatedRatePct)}
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
                    {bm.alphaPct >= 0 ? `+${formatPercent(bm.alphaPct)}` : formatPercent(bm.alphaPct)} p.p.
                  </span>
                </div>

                {/* Subtitulo: Recorte Movel dos Ultimos 12 Meses */}
                <p className="text-[8.5px] text-muted-foreground font-mono leading-tight truncate">
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

        {/* 2. Painel de Metricas Avancadas de Risco & Eficiencia */}
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
            {/* Indice de Sharpe */}
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

            {/* Consistencia / Win Rate */}
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
