import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatSignedPct } from "@/services/masks/percent";

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
}

const SVG_WIDTH = 560;
const SVG_HEIGHT = 150;
const PAD_X = 32;
const PAD_TOP = 20;
const PAD_BOTTOM = 26;

/**
 * Gráfico Institucional de Rentabilidade & Evolução Mensal (SVG puro).
 * Projetado especificamente para impressão A4 e visualização em alta fidelidade.
 * Exibe a taxa de rentabilidade de cada competência com barras bi-direcionais
 * (positivo/verde, negativo/vermelho) e uma tabela resumo mês a mês logo abaixo.
 */
export function ReportPerformanceChart({
  series,
  className,
  title = "Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês",
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
    return Math.max(2, Math.ceil(maxVal * 1.2)); // ao menos 2% e 20% de margem
  }, [rates]);

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
      className={cn(
        "break-inside-avoid flex flex-col gap-2.5 rounded-xl border border-border/80 bg-muted/20 p-3.5 print:bg-white print:border-slate-200/90 shadow-2xs",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-3.5 text-primary-strong" aria-hidden="true" />
          <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono num">
          Últimas {displaySeries.length} competências
        </span>
      </div>

      {/* Gráfico SVG de Barras de Rentabilidade */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label="Gráfico de barras da rentabilidade percentual mês a mês"
        >
          {/* Linha Zero de Referência */}
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

      {/* Tabela Resumo Compacta (Data Grid para Leitura Executiva e Impressão) */}
      <div className="rounded-lg border border-border/80 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[9px] uppercase tracking-wider">
              <th className="py-1 px-2.5">Competência</th>
              <th className="py-1 px-2.5 text-right">Patrimônio Bruto</th>
              <th className="py-1 px-2 text-right">Rentabilidade do Mês</th>
              <th className="py-1 px-2.5 text-right">Proventos do Mês</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono text-[10.5px] num">
            {displaySeries.map((point) => (
              <tr key={point.month} className="even:bg-muted/20 print:even:bg-slate-50/50">
                <td className="py-1 px-2.5 font-sans font-semibold text-foreground text-[11px]">
                  {point.monthLabel}
                </td>
                <td className="py-1 px-2.5 text-right font-bold text-foreground">
                  <MoneyText cents={numberToCents(point.patrimonyBRL)} />
                </td>
                <td
                  className={cn(
                    "py-1 px-2 text-right font-bold",
                    (point.ratePct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong",
                  )}
                >
                  {formatSignedPct(point.ratePct)}
                </td>
                <td className="py-1 px-2.5 text-right text-positive-strong font-medium">
                  {point.dividendsBRL && point.dividendsBRL > 0 ? (
                    <MoneyText cents={numberToCents(point.dividendsBRL)} tone="positive" />
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
