import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";
import { toMonotoneCubicPath, toAreaPath } from "@/lib/chart-curve";
import type { ChartPoint } from "@/lib/chart-curve";
import type { DailyFlowItem } from "@/domain/overview";

export interface DailyFlowChartProps {
  /** Fluxo diário do mês (buildDailyFlow — domain/overview). */
  days: readonly DailyFlowItem[];
  className?: string;
}

const LINE_WIDTH = 320;
const LINE_HEIGHT = 160;
const PAD = 12;
const BASELINE_Y = LINE_HEIGHT - PAD; // 148.0

/**
 * Converte a série em pontos na escala sublinear do gráfico (com base no zero e no maior valor diário).
 * Aplica uma transformação de potência suave (x^0.6) para manter a proporção confortável e evitar
 * que despesas e aportes fiquem esmagados no chão na presença de picos pontuais de receita.
 */
function toLinePointList(values: readonly number[], width: number, height: number, globalMax: number): ChartPoint[] {
  const range = globalMax > 0 ? globalMax : 1;
  const usableHeight = height - PAD * 2;
  return values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * width : width;
    const clampedValue = Math.max(0, value);
    // Escala sublinear suave (power scale 0.6)
    const normalized = Math.pow(clampedValue / range, 0.6);
    const y = PAD + (1 - normalized) * usableHeight;
    return { x, y };
  });
}

/**
 * DailyFlowChart — fluxo diário com curvas suaves e arredondadas (Spline Cúbica Monótona),
 * eliminando overshoot no eixo zero, com preenchimentos gradientes translúcidos,
 * régua temporal discreta no eixo X e scrubbing interativo.
 */
export function DailyFlowChart({ days, className }: DailyFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const incomeValues = useMemo(() => days.map((day) => day.incomeCents), [days]);
  const expenseValues = useMemo(() => days.map((day) => day.expenseCents), [days]);
  const investmentValues = useMemo(() => days.map((day) => day.investmentCents), [days]);
  const hasIncomes = useMemo(() => days.some((day) => day.incomeCents > 0), [days]);
  const hasExpenses = useMemo(() => days.some((day) => day.expenseCents > 0), [days]);
  const hasInvestments = useMemo(() => days.some((day) => day.investmentCents > 0), [days]);
  const hasAnyData = hasIncomes || hasExpenses || hasInvestments;

  const globalMax = useMemo(() => {
    const activeValues = [
      ...(hasIncomes ? incomeValues : []),
      ...(hasExpenses ? expenseValues : []),
      ...(hasInvestments ? investmentValues : []),
    ];
    return Math.max(...activeValues, 0);
  }, [incomeValues, expenseValues, investmentValues, hasIncomes, hasExpenses, hasInvestments]);

  const incomePointList = useMemo(
    () => (hasIncomes ? toLinePointList(incomeValues, LINE_WIDTH, LINE_HEIGHT, globalMax) : []),
    [incomeValues, globalMax, hasIncomes],
  );
  const expensePointList = useMemo(
    () => (hasExpenses ? toLinePointList(expenseValues, LINE_WIDTH, LINE_HEIGHT, globalMax) : []),
    [expenseValues, globalMax, hasExpenses],
  );
  const investmentPointList = useMemo(
    () => (hasInvestments ? toLinePointList(investmentValues, LINE_WIDTH, LINE_HEIGHT, globalMax) : []),
    [hasInvestments, investmentValues, globalMax],
  );

  // Curvas com garantia matemática de monotonicidade e clamp na linha base (sem overshoot abaixo do zero)
  const incomePath = useMemo(
    () => (hasIncomes ? toMonotoneCubicPath(incomePointList, BASELINE_Y) : ""),
    [incomePointList, hasIncomes],
  );
  const expensePath = useMemo(
    () => (hasExpenses ? toMonotoneCubicPath(expensePointList, BASELINE_Y) : ""),
    [expensePointList, hasExpenses],
  );
  const investmentPath = useMemo(
    () => (hasInvestments ? toMonotoneCubicPath(investmentPointList, BASELINE_Y) : ""),
    [hasInvestments, investmentPointList],
  );

  // Áreas sob as curvas preenchidas com gradientes translúcidos suaves
  const incomeAreaPath = useMemo(
    () => (hasIncomes && incomePath ? toAreaPath(incomePointList, incomePath, BASELINE_Y) : ""),
    [incomePointList, incomePath, hasIncomes],
  );
  const expenseAreaPath = useMemo(
    () => (hasExpenses && expensePath ? toAreaPath(expensePointList, expensePath, BASELINE_Y) : ""),
    [expensePointList, expensePath, hasExpenses],
  );
  const investmentAreaPath = useMemo(
    () => (hasInvestments && investmentPath ? toAreaPath(investmentPointList, investmentPath, BASELINE_Y) : ""),
    [hasInvestments, investmentPointList, investmentPath],
  );

  // Marcações discretas dos dias do mês para a régua temporal do eixo X
  const xTicks = useMemo(() => {
    if (days.length <= 1) return [];
    const total = days.length;
    const candidates = total >= 20 ? [1, 5, 10, 15, 20, 25, total] : [1, Math.ceil(total / 2), total];
    const unique = Array.from(new Set(candidates.filter((d) => d <= total)));
    return unique.map((d) => ({
      label: String(d).padStart(2, "0"),
      leftPct: ((d - 1) / Math.max(1, total - 1)) * 100,
    }));
  }, [days.length]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || days.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const index = Math.max(0, Math.min(days.length - 1, Math.floor(ratio * days.length)));
    setScrubIndex(index);
  };

  const scrubDay = scrubIndex !== null ? days[scrubIndex] : undefined;
  const scrubIncome = scrubIndex !== null && hasIncomes ? incomePointList[scrubIndex] : undefined;
  const scrubExpense = scrubIndex !== null && hasExpenses ? expensePointList[scrubIndex] : undefined;
  const scrubInvestment = scrubIndex !== null && hasInvestments ? investmentPointList[scrubIndex] : undefined;
  const scrubLeft = scrubIndex !== null ? `${(scrubIndex / Math.max(1, days.length - 1)) * 100}%` : undefined;

  if (days.length === 0 || !hasAnyData) {
    return (
      <div
        className={cn("flex h-44 w-full items-center justify-center text-xs text-muted-foreground", className)}
        data-testid="daily-flow-empty"
      >
        Sem movimentações registradas neste período
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none w-full min-w-0 overflow-hidden", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setScrubIndex(null)}
      // F20 — isolamento: scrub do gráfico nunca dispara a navegação por swipe.
      data-swipe-nav-ignore
    >
      <div className="relative h-44 w-full overflow-hidden" aria-hidden="true">
        <svg viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`} preserveAspectRatio="none" className="h-full w-full">
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

          {/* Linhas guias horizontais limpas e linha base */}
          <line x1="0" y1={PAD} x2={LINE_WIDTH} y2={PAD} stroke="currentColor" strokeDasharray="2 4" className="text-border/30" strokeWidth={1} />
          <line x1="0" y1={LINE_HEIGHT / 2} x2={LINE_WIDTH} y2={LINE_HEIGHT / 2} stroke="currentColor" strokeDasharray="2 4" className="text-border/25" strokeWidth={1} />
          <line x1="0" y1={BASELINE_Y} x2={LINE_WIDTH} y2={BASELINE_Y} stroke="currentColor" className="text-border/50" strokeWidth={1} />

          {/* Áreas preenchidas com gradientes suaves translúcidos */}
          {hasIncomes && incomeAreaPath ? (
            <path d={incomeAreaPath} fill="url(#flow-income-grad)" className="pointer-events-none" />
          ) : null}
          {hasExpenses && expenseAreaPath ? (
            <path d={expenseAreaPath} fill="url(#flow-expense-grad)" className="pointer-events-none" />
          ) : null}
          {hasInvestments && investmentAreaPath ? (
            <path d={investmentAreaPath} fill="url(#flow-investment-grad)" className="pointer-events-none" />
          ) : null}

          {/* Curvas suaves e arredondadas (Spline Monótona sem overshoot) */}
          {hasIncomes ? (
            <path
              d={incomePath}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-positive-strong"
            />
          ) : null}
          {hasExpenses ? (
            <path
              d={expensePath}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-negative-strong"
            />
          ) : null}
          {hasInvestments ? (
            <path
              d={investmentPath}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-portfolio"
            />
          ) : null}
        </svg>

        {/* Pontos do dia sob scrubbing */}
        {scrubIncome ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-positive-strong ring-2 ring-surface shadow-xs pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubIncome.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {scrubExpense ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-negative-strong ring-2 ring-surface shadow-xs pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubExpense.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {scrubInvestment ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-portfolio ring-2 ring-surface shadow-xs pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubInvestment.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
      </div>

      {/* Linha guia vertical do dia sob scrubbing */}
      {scrubLeft ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20" style={{ left: scrubLeft }} />
      ) : null}

      {/* Régua temporal discreta no rodapé (dias do mês) */}
      {xTicks.length > 0 ? (
        <div className="relative mt-2 h-3.5 w-full select-none" aria-hidden="true">
          {xTicks.map((tick) => (
            <span
              key={tick.label}
              className="absolute text-[10px] tabular-nums font-medium text-muted-foreground/60 transition-colors"
              style={{
                left: tick.leftPct === 0 ? "0%" : tick.leftPct === 100 ? "100%" : `${tick.leftPct}%`,
                transform: tick.leftPct === 0 ? "none" : tick.leftPct === 100 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* Tooltip flutuante limpo */}
      {scrubDay ? (
        <div
          className="pointer-events-none absolute top-0 z-tooltip -translate-x-1/2 rounded-xl border border-border/80 bg-surface/95 backdrop-blur-md p-2.5 text-xs min-w-36 animate-in fade-in zoom-in-95 duration-100 shadow-sm"
          style={{ left: `clamp(76px, ${scrubLeft}, calc(100% - 76px))` }}
          role="tooltip"
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-1 mb-1.5">
            <span className="font-semibold text-foreground">
              {String(scrubDay.dayOfMonth).padStart(2, "0")}/{String(new Date(scrubDay.day).getMonth() + 1).padStart(2, "0")}
            </span>
            <MoneyText
              cents={scrubDay.incomeCents - scrubDay.expenseCents}
              tone={scrubDay.incomeCents - scrubDay.expenseCents >= 0 ? "positive" : "negative"}
              className="text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-positive-strong" /> Entradas
              </span>
              <MoneyText cents={scrubDay.incomeCents} tone="positive" sign="explicit" className="privacy-mask text-[11px]" />
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-negative-strong" /> Saídas
              </span>
              <MoneyText cents={scrubDay.expenseCents} tone="negative" sign="explicit" className="privacy-mask text-[11px]" />
            </div>
            {hasInvestments ? (
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-portfolio" /> Investimentos
                </span>
                <MoneyText cents={scrubDay.investmentCents} tone="portfolio" sign="explicit" className="privacy-mask text-[11px]" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

