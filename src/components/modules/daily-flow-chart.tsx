import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  computeDailyFlowGeometry,
  DAILY_FLOW_BASELINE_Y,
  DAILY_FLOW_LINE_HEIGHT,
  DAILY_FLOW_LINE_WIDTH,
  DAILY_FLOW_PAD,
} from "@/domain/charts";
import type { DailyFlowItem } from "@/domain/overview";
import { cn } from "@/lib/utils";
import { DailyFlowTooltip } from "./overview/daily-flow-tooltip";

export interface DailyFlowChartProps {
  days: readonly DailyFlowItem[];
  className?: string;
}

/**
 * DailyFlowChart — fluxo diário com spline cúbica monótona, scrub por ponteiro ou teclado.
 */
export function DailyFlowChart({ days, className }: DailyFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const geometry = useMemo(() => computeDailyFlowGeometry(days), [days]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || days.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const index = Math.max(0, Math.min(days.length - 1, Math.floor(ratio * days.length)));
    setScrubIndex(index);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (days.length === 0) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setScrubIndex((prev) => (prev === null ? 0 : Math.min(days.length - 1, prev + 1)));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setScrubIndex((prev) => (prev === null ? days.length - 1 : Math.max(0, prev - 1)));
    } else if (event.key === "Home") {
      event.preventDefault();
      setScrubIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setScrubIndex(days.length - 1);
    } else if (event.key === "Escape") {
      setScrubIndex(null);
    }
  };

  if (days.length === 0 || !geometry.hasAnyData) {
    return (
      <div
        className={cn(
          "flex h-48 sm:h-52 w-full items-center justify-center text-xs text-muted-foreground",
          className,
        )}
        data-testid="daily-flow-empty"
      >
        Sem movimentações registradas neste período
      </div>
    );
  }

  const scrubDay = scrubIndex !== null ? days[scrubIndex] : undefined;
  const scrubIncome = scrubIndex !== null && geometry.hasIncomes ? geometry.incomePointList[scrubIndex] : undefined;
  const scrubExpense = scrubIndex !== null && geometry.hasExpenses ? geometry.expensePointList[scrubIndex] : undefined;
  const scrubInvestment =
    scrubIndex !== null && geometry.hasInvestments ? geometry.investmentPointList[scrubIndex] : undefined;
  const scrubLeft =
    scrubIndex !== null ? `${(scrubIndex / Math.max(1, days.length - 1)) * 100}%` : undefined;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Gráfico de fluxo diário interativo. Use as setas esquerda e direita para navegar pelos dias."
      className={cn(
        "relative select-none w-full min-w-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setScrubIndex(null)}
      onBlur={() => setScrubIndex(null)}
      onKeyDown={handleKeyDown}
      data-swipe-nav-ignore
    >
      <div className="relative h-48 sm:h-52 w-full overflow-hidden" aria-hidden="true">
        <svg
          viewBox={`0 0 ${DAILY_FLOW_LINE_WIDTH} ${DAILY_FLOW_LINE_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="flow-income-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--positive-strong))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="hsl(var(--positive-strong))" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="flow-expense-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--negative-strong))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--negative-strong))" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="flow-investment-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--portfolio))" stopOpacity="0.20" />
              <stop offset="100%" stopColor="hsl(var(--portfolio))" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1="0" y1={DAILY_FLOW_PAD} x2={DAILY_FLOW_LINE_WIDTH} y2={DAILY_FLOW_PAD} stroke="currentColor" strokeDasharray="2 4" className="text-border/40" strokeWidth={1} />
          <line x1="0" y1={DAILY_FLOW_LINE_HEIGHT / 2} x2={DAILY_FLOW_LINE_WIDTH} y2={DAILY_FLOW_LINE_HEIGHT / 2} stroke="currentColor" strokeDasharray="2 4" className="text-border/30" strokeWidth={1} />
          <line x1="0" y1={DAILY_FLOW_BASELINE_Y} x2={DAILY_FLOW_LINE_WIDTH} y2={DAILY_FLOW_BASELINE_Y} stroke="currentColor" className="text-border/60" strokeWidth={1} />

          {geometry.hasIncomes && geometry.incomeAreaPath ? (
            <path d={geometry.incomeAreaPath} fill="url(#flow-income-grad)" className="pointer-events-none" />
          ) : null}
          {geometry.hasExpenses && geometry.expenseAreaPath ? (
            <path d={geometry.expenseAreaPath} fill="url(#flow-expense-grad)" className="pointer-events-none" />
          ) : null}
          {geometry.hasInvestments && geometry.investmentAreaPath ? (
            <path d={geometry.investmentAreaPath} fill="url(#flow-investment-grad)" className="pointer-events-none" />
          ) : null}

          {geometry.hasIncomes ? (
            <path d={geometry.incomePath} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="stroke-positive-strong" />
          ) : null}
          {geometry.hasExpenses ? (
            <path d={geometry.expensePath} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="stroke-negative-strong" />
          ) : null}
          {geometry.hasInvestments ? (
            <path d={geometry.investmentPath} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="stroke-portfolio" />
          ) : null}
        </svg>

        {scrubIncome ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-positive-strong ring-2 ring-surface shadow-xs pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubIncome.y / DAILY_FLOW_LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {scrubExpense ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-negative-strong ring-2 ring-surface shadow-xs pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubExpense.y / DAILY_FLOW_LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {scrubInvestment ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-portfolio ring-2 ring-surface shadow-xs pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubInvestment.y / DAILY_FLOW_LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
      </div>

      {scrubLeft ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20" style={{ left: scrubLeft }} />
      ) : null}

      {geometry.xTicks.length > 0 ? (
        <div className="relative mt-2 h-3.5 w-full select-none" aria-hidden="true">
          {geometry.xTicks.map((tick) => (
            <span
              key={tick.label}
              className="absolute text-[10px] tabular-nums font-medium text-muted-foreground/60 transition-colors"
              style={{
                left: tick.leftPct === 0 ? "0%" : tick.leftPct === 100 ? "100%" : `${tick.leftPct}%`,
                transform:
                  tick.leftPct === 0 ? "none" : tick.leftPct === 100 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      ) : null}

      {scrubDay ? (
        <DailyFlowTooltip
          day={scrubDay}
          scrubLeft={scrubLeft}
          hasInvestments={geometry.hasInvestments}
        />
      ) : null}
    </div>
  );
}
