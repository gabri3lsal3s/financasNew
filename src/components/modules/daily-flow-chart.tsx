import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { DailyFlowItem } from "@/domain/overview";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface DailyFlowChartProps {
  /** Fluxo diário do mês (buildDailyFlow — domain/overview). */
  days: readonly DailyFlowItem[];
  className?: string;
}

const LINE_WIDTH = 320;
const LINE_HEIGHT = 160;
const PAD = 8;

interface LinePoint {
  x: number;
  y: number;
}

/** Converte a série em pontos na escala do gráfico (min/max do mês, com folga). */
function toLinePointList(values: readonly number[], width: number, height: number): LinePoint[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * width : width;
    const y = PAD + (1 - (value - min) / range) * (height - PAD * 2);
    return { x, y };
  });
}

function toLinePoints(values: readonly number[], width: number, height: number): string {
  return toLinePointList(values, width, height)
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

/**
 * DailyFlowChart — fluxo diário em gráfico de linhas: receitas (verde) ×
 * despesas (vermelho) por dia do mês na mesma escala, com scrubbing tátil
 * (pointer), linha guia vertical, pontos do dia e tooltip flutuante. Os
 * valores vêm de `domain/overview` (buildDailyFlow) — sem cálculo de
 * negócio aqui.
 */
export function DailyFlowChart({ days, className }: DailyFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const incomeValues = useMemo(() => days.map((day) => day.incomeCents), [days]);
  const expenseValues = useMemo(() => days.map((day) => day.expenseCents), [days]);

  const incomePoints = useMemo(() => toLinePoints(incomeValues, LINE_WIDTH, LINE_HEIGHT), [incomeValues]);
  const expensePoints = useMemo(() => toLinePoints(expenseValues, LINE_WIDTH, LINE_HEIGHT), [expenseValues]);
  const incomePointList = useMemo(() => toLinePointList(incomeValues, LINE_WIDTH, LINE_HEIGHT), [incomeValues]);
  const expensePointList = useMemo(() => toLinePointList(expenseValues, LINE_WIDTH, LINE_HEIGHT), [expenseValues]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || days.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const index = Math.max(0, Math.min(days.length - 1, Math.floor(ratio * days.length)));
    setScrubIndex(index);
  };

  const scrubDay = scrubIndex !== null ? days[scrubIndex] : undefined;
  const scrubIncome = scrubIndex !== null ? incomePointList[scrubIndex] : undefined;
  const scrubExpense = scrubIndex !== null ? expensePointList[scrubIndex] : undefined;
  const scrubLeft = scrubIndex !== null ? `${(scrubIndex / Math.max(1, days.length - 1)) * 100}%` : undefined;

  const lastIncome = incomePointList.length > 0 ? incomePointList[incomePointList.length - 1] : undefined;
  const lastExpense = expensePointList.length > 0 ? expensePointList[expensePointList.length - 1] : undefined;

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setScrubIndex(null)}
    >
      {/* Linhas de receitas × despesas na mesma escala */}
      <div className="relative h-40 w-full" aria-hidden="true">
        <svg viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <polyline
            points={incomePoints}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-positive-strong"
          />
          <polyline
            points={expensePoints}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-negative-strong"
          />
        </svg>

        {/* Ponto final das linhas (último dia com dados no mês) */}
        {lastIncome ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-positive-strong ring-2 ring-surface"
            style={{ left: `${(lastIncome.x / LINE_WIDTH) * 100}%`, top: `${(lastIncome.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {lastExpense ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-negative-strong ring-2 ring-surface"
            style={{ left: `${(lastExpense.x / LINE_WIDTH) * 100}%`, top: `${(lastExpense.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}

        {/* Pontos do dia sob scrubbing nas duas linhas */}
        {scrubIncome ? (
          <span
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-positive-strong ring-2 ring-surface"
            style={{ left: scrubLeft, top: `${(scrubIncome.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {scrubExpense ? (
          <span
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-negative-strong ring-2 ring-surface"
            style={{ left: scrubLeft, top: `${(scrubExpense.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
      </div>

      {/* Linha guia vertical do dia sob scrubbing */}
      {scrubLeft ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-foreground/15" style={{ left: scrubLeft }} />
      ) : null}

      {/* Tooltip flutuante do dia sob scrubbing */}
      {scrubDay ? (
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
            Saldo do dia {formatCentsAsBRL(scrubDay.incomeCents - scrubDay.expenseCents)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
