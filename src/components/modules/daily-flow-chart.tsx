import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { cumulativeBalance } from "@/domain/overview";
import type { DailyFlowItem } from "@/domain/overview";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface DailyFlowChartProps {
  /** Fluxo diário do mês (buildDailyFlow — domain/overview). */
  days: readonly DailyFlowItem[];
  /** Meta diária (centavos) para a linha guia de saldo acumulado — null desliga. */
  dailyGoalCents?: number | null;
  className?: string;
}

const LINE_WIDTH = 320;
const LINE_HEIGHT = 48;

/** Converte a série em pontos SVG (escala entre min/max com folga). */
function toLinePoints(values: readonly number[], width: number, height: number): string {
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length > 1 ? (index / (values.length - 1)) * width : width;
      const y = height - 4 - ((value - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * DailyFlowChart — fluxo diário avançado (F8): barras empilhadas (rendas ×
 * despesas), curva de saldo acumulado e linha guia da meta diária, com
 * scrubbing tátil (pointer) e tooltip flutuante. Os valores vêm de
 * `domain/overview` (buildDailyFlow + cumulativeBalance) — sem cálculo de
 * negócio aqui.
 */
export function DailyFlowChart({ days, dailyGoalCents = null, className }: DailyFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const curve = useMemo(() => cumulativeBalance(days), [days]);

  const linePoints = useMemo(
    () => toLinePoints(curve.map((point) => point.balanceCents), LINE_WIDTH, LINE_HEIGHT),
    [curve],
  );

  const goalPoints = useMemo(() => {
    if (dailyGoalCents === null || dailyGoalCents === undefined) return null;
    return toLinePoints(
      curve.map((point) => dailyGoalCents * point.dayOfMonth),
      LINE_WIDTH,
      LINE_HEIGHT,
    );
  }, [curve, dailyGoalCents]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || days.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const index = Math.max(0, Math.min(days.length - 1, Math.floor(ratio * days.length)));
    setScrubIndex(index);
  };

  const scrubDay = scrubIndex !== null ? days[scrubIndex] : undefined;
  const scrubCurve = scrubIndex !== null ? curve[scrubIndex] : undefined;

  const scrubLeft = scrubIndex !== null ? `${(scrubIndex / Math.max(1, days.length - 1)) * 100}%` : undefined;

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setScrubIndex(null)}
    >
      {/* Barras empilhadas por dia */}
      <div className="flex h-24 items-end gap-px" aria-hidden="true">
        {days.map((day, index) => {
          const scale = day.maxCents > 0 ? day.maxCents : 1;
          return (
            <div key={day.day} className="flex h-full flex-1 flex-col justify-end gap-px">
              {day.expenseCents > 0 ? (
                <div className="w-full rounded-t-sm bg-negative-strong/80" style={{ height: `${Math.max(8, (day.expenseCents / scale) * 100)}%` }} />
              ) : null}
              {day.incomeCents > 0 ? (
                <div className="w-full rounded-t-sm bg-positive-strong/80" style={{ height: `${Math.max(8, (day.incomeCents / scale) * 100)}%` }} />
              ) : null}
              {index === scrubIndex ? <div className="h-px w-full bg-foreground/40" /> : null}
            </div>
          );
        })}
      </div>

      {/* Curva de saldo acumulado + linha guia de meta diária */}
      <div className="mt-2 h-12 w-full" aria-hidden="true">
        <svg viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          {goalPoints ? (
            <polyline
              points={goalPoints}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              className="stroke-warning"
            />
          ) : null}
          <polyline
            points={linePoints}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-portfolio"
          />
        </svg>
      </div>

      {/* Tooltip flutuante do dia sob scrubbing */}
      {scrubDay && scrubCurve ? (
        <div
          className="pointer-events-none absolute top-1 z-tooltip -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: scrubLeft }}
          role="tooltip"
        >
          <p className="font-semibold text-foreground">
            {String(scrubDay.dayOfMonth).padStart(2, "0")}/{String(new Date(scrubDay.day).getMonth() + 1).padStart(2, "0")}
          </p>
          <p className="privacy-mask text-positive-strong">+ {formatCentsAsBRL(scrubDay.incomeCents)}</p>
          <p className="privacy-mask text-negative-strong">− {formatCentsAsBRL(scrubDay.expenseCents)}</p>
          <p className="num mt-0.5 border-t border-border/60 pt-0.5 text-muted-foreground">
            Saldo {formatCentsAsBRL(scrubCurve.balanceCents)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
