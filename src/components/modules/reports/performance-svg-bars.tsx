import { useState, type KeyboardEvent } from "react";
import { Info } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks/percent";
import { triggerSensory } from "@/services/sensory";

export interface PreparedPerformancePoint {
  month: string;
  monthLabel: string;
  rawMonthLabel: string;
  patrimonyBRL: number;
  ratePct: number | null;
  isMtd: boolean;
}

export interface PerformanceSvgBarsProps {
  displaySeries: readonly PreparedPerformancePoint[];
  maxAbsRate: number;
  mtdPoint?: PreparedPerformancePoint;
}

const SVG_WIDTH = 560;
const SVG_HEIGHT = 148;
const PAD_X = 32;
const PAD_TOP = 20;
const PAD_BOTTOM = 32;

/** Gráfico SVG acessível de barras mensais com inspeção por toque/teclado e nota MTD. */
export function PerformanceSvgBars({
  displaySeries,
  maxAbsRate,
  mtdPoint,
}: PerformanceSvgBarsProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const usableHeight = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const zeroY = PAD_TOP + usableHeight / 2;
  const count = displaySeries.length;
  const stepX = (SVG_WIDTH - PAD_X * 2) / count;
  const barWidth = Math.min(26, Math.max(12, stepX * 0.5));

  const activeIdx = hoveredIdx ?? selectedIdx;
  const activePoint = activeIdx !== null ? displaySeries[activeIdx] : undefined;

  const handleSelectBar = (idx: number) => {
    triggerSensory("selection");
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  };

  const handleBarKeyDown = (idx: number) => (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectBar(idx);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      triggerSensory("selection");
      setSelectedIdx((idx + 1) % count);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      triggerSensory("selection");
      setSelectedIdx((idx - 1 + count) % count);
    }
  };

  return (
    <>
      {activePoint ? (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-raised px-3 py-1.5 text-xs print:hidden"
        >
          <span className="font-semibold text-foreground">
            {activePoint.rawMonthLabel}
            {activePoint.isMtd ? " (MTD parcial)" : ""}
          </span>
          <div className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap">
            <span
              className={cn(
                "font-bold",
                (activePoint.ratePct ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
            >
              {formatSignedPct(activePoint.ratePct ?? 0)}
            </span>
            <MoneyText cents={numberToCents(activePoint.patrimonyBRL)} tone="default" />
          </div>
        </div>
      ) : null}

      <div className="relative w-full overflow-x-auto no-scrollbar">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full min-w-[380px] sm:min-w-0 h-auto"
          role="img"
          aria-label="Gráfico de barras da rentabilidade percentual mês a mês"
        >
          <line
            x1={PAD_X}
            y1={zeroY}
            x2={SVG_WIDTH - PAD_X}
            y2={zeroY}
            stroke="hsl(var(--border))"
            strokeDasharray="2 2"
            strokeWidth={1}
          />

          <text x={PAD_X - 4} y={PAD_TOP + 4} textAnchor="end" fontSize={8.5} className="font-mono fill-muted-foreground num">
            +{maxAbsRate}%
          </text>
          <text x={PAD_X - 4} y={zeroY + 3} textAnchor="end" fontSize={8.5} className="font-mono fill-muted-foreground num">
            0%
          </text>
          <text x={PAD_X - 4} y={SVG_HEIGHT - PAD_BOTTOM} textAnchor="end" fontSize={8.5} className="font-mono fill-muted-foreground num">
            -{maxAbsRate}%
          </text>

          {displaySeries.map((point, idx) => {
            const centerX = PAD_X + idx * stepX + stepX / 2;
            const rate = point.ratePct ?? 0;
            const barHeight = Math.min(usableHeight / 2, (Math.abs(rate) / maxAbsRate) * (usableHeight / 2));
            const isPositive = rate >= 0;
            const barY = isPositive ? zeroY - barHeight : zeroY;
            const isSelected = selectedIdx === idx;
            const isDimmed = activeIdx !== null && activeIdx !== idx;

            return (
              <g
                key={point.month}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${point.rawMonthLabel}: ${formatSignedPct(rate)}${point.isMtd ? " (MTD)" : ""}`}
                onClick={() => handleSelectBar(idx)}
                onKeyDown={handleBarKeyDown(idx)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={cn(
                  "cursor-pointer focus-visible:outline-none transition-opacity duration-150",
                  isDimmed && "opacity-45",
                )}
              >
                <rect
                  x={centerX - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  rx={2}
                  className={cn(
                    isPositive ? "fill-positive-strong" : "fill-negative-strong",
                    point.isMtd && "stroke-primary stroke-1 stroke-dasharray-[2,2] opacity-85",
                    isSelected && "stroke-foreground stroke-1",
                  )}
                />
                <text
                  x={centerX}
                  y={isPositive ? barY - 4 : barY + barHeight + 8}
                  textAnchor="middle"
                  fontSize={8.5}
                  className={cn(
                    "font-mono font-bold num",
                    isPositive ? "fill-positive-strong" : "fill-negative-strong",
                  )}
                >
                  {formatSignedPct(rate)}
                </text>
                <text
                  x={centerX}
                  y={SVG_HEIGHT - 17}
                  textAnchor="middle"
                  fontSize={8}
                  className={cn(
                    "font-mono",
                    point.isMtd ? "fill-primary font-bold" : "fill-muted-foreground",
                  )}
                >
                  {point.monthLabel}
                </text>
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
                      fontSize={6.5}
                      className="font-mono font-bold fill-primary tracking-wider"
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

      {mtdPoint && (
        <div className="flex items-start gap-2 rounded-lg bg-surface-raised p-2.5 text-[10px] text-muted-foreground print:border print:border-border print:bg-surface">
          <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">
              * {mtdPoint.rawMonthLabel} (MTD — Month to Date): competência corrente parcial em andamento
            </span>
            <p className="m-0 leading-relaxed text-muted-foreground">
              Os dados desta barra refletem a posição em tempo real acumulada no mês até a data de emissão do relatório. Por rigor regulatório e metodológico (Padrão CFA &amp; CVM/ANBIMA), o mês incompleto é automaticamente segregado do cálculo da volatilidade anualizada e do Índice de Sharpe para não introduzir distorção estatística de amostragem heterogênea.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
