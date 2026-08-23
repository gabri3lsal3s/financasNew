import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";
import type { DailyFlowItem } from "@/domain/overview";

export interface DailyFlowChartProps {
  /** Fluxo diário do mês (buildDailyFlow — domain/overview). */
  days: readonly DailyFlowItem[];
  className?: string;
}

const LINE_WIDTH = 320;
const LINE_HEIGHT = 160;
const PAD = 12;

interface LinePoint {
  x: number;
  y: number;
}

/**
 * Converte a série em pontos na escala sublinear do gráfico (com base no zero e no maior valor diário).
 * Aplica uma transformação de potência suave (x^0.6) para manter a proporção confortável e evitar
 * que despesas e aportes fiquem esmagados no chão na presença de picos pontuais de receita.
 */
function toLinePointList(values: readonly number[], width: number, height: number, globalMax: number): LinePoint[] {
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
 * Gera um comando SVG path com curvas suaves (Catmull-Rom / Bézier cúbicas),
 * eliminando cantos pontiagudos e produzindo linhas orgânicas e fluidas.
 */
function toSmoothPath(points: readonly LinePoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  let path = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    // Fator de suavização 0.2 para evitar overshoot em variações bruscas
    const k = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * k;
    const cp1y = p1.y + (p2.y - p0.y) * k;
    const cp2x = p2.x - (p3.x - p1.x) * k;
    const cp2y = p2.y - (p3.y - p1.y) * k;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

/**
 * DailyFlowChart — fluxo diário com curvas suaves e arredondadas (Bézier cúbicas),
 * sem sombras ou áreas sombreadas sob as linhas, com linhas guias sutis e scrubbing interativo.
 */
export function DailyFlowChart({ days, className }: DailyFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const incomeValues = useMemo(() => days.map((day) => day.incomeCents), [days]);
  const expenseValues = useMemo(() => days.map((day) => day.expenseCents), [days]);
  const investmentValues = useMemo(() => days.map((day) => day.investmentCents), [days]);
  const hasInvestments = useMemo(() => days.some((day) => day.investmentCents > 0), [days]);

  const globalMax = useMemo(() => {
    const allValues = [
      ...incomeValues,
      ...expenseValues,
      ...(hasInvestments ? investmentValues : []),
    ];
    return Math.max(...allValues, 0);
  }, [incomeValues, expenseValues, investmentValues, hasInvestments]);

  const incomePointList = useMemo(
    () => toLinePointList(incomeValues, LINE_WIDTH, LINE_HEIGHT, globalMax),
    [incomeValues, globalMax],
  );
  const expensePointList = useMemo(
    () => toLinePointList(expenseValues, LINE_WIDTH, LINE_HEIGHT, globalMax),
    [expenseValues, globalMax],
  );
  const investmentPointList = useMemo(
    () => (hasInvestments ? toLinePointList(investmentValues, LINE_WIDTH, LINE_HEIGHT, globalMax) : []),
    [hasInvestments, investmentValues, globalMax],
  );

  const incomePath = useMemo(() => toSmoothPath(incomePointList), [incomePointList]);
  const expensePath = useMemo(() => toSmoothPath(expensePointList), [expensePointList]);
  const investmentPath = useMemo(
    () => (hasInvestments ? toSmoothPath(investmentPointList) : ""),
    [hasInvestments, investmentPointList],
  );

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
  const scrubInvestment = scrubIndex !== null && hasInvestments ? investmentPointList[scrubIndex] : undefined;
  const scrubLeft = scrubIndex !== null ? `${(scrubIndex / Math.max(1, days.length - 1)) * 100}%` : undefined;

  const lastIncome = incomePointList.length > 0 ? incomePointList[incomePointList.length - 1] : undefined;
  const lastExpense = expensePointList.length > 0 ? expensePointList[expensePointList.length - 1] : undefined;
  const lastInvestment = hasInvestments && investmentPointList.length > 0 ? investmentPointList[investmentPointList.length - 1] : undefined;

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
          {/* Linhas guias horizontais limpas e sutis */}
          <line x1="0" y1={PAD} x2={LINE_WIDTH} y2={PAD} stroke="currentColor" strokeDasharray="2 4" className="text-border/30" strokeWidth={1} />
          <line x1="0" y1={LINE_HEIGHT / 2} x2={LINE_WIDTH} y2={LINE_HEIGHT / 2} stroke="currentColor" strokeDasharray="2 4" className="text-border/25" strokeWidth={1} />
          <line x1="0" y1={LINE_HEIGHT - PAD} x2={LINE_WIDTH} y2={LINE_HEIGHT - PAD} stroke="currentColor" strokeDasharray="2 4" className="text-border/30" strokeWidth={1} />

          {/* Curvas suaves e arredondadas sem sombras */}
          <path
            d={incomePath}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-positive-strong"
          />
          <path
            d={expensePath}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-negative-strong"
          />
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

        {/* Ponto final das linhas (sem sombras) */}
        {lastIncome ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-positive-strong ring-2 ring-surface pointer-events-none"
            style={{ left: `${Math.min(99, Math.max(1, (lastIncome.x / LINE_WIDTH) * 100))}%`, top: `${(lastIncome.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {lastExpense ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-negative-strong ring-2 ring-surface pointer-events-none"
            style={{ left: `${Math.min(99, Math.max(1, (lastExpense.x / LINE_WIDTH) * 100))}%`, top: `${(lastExpense.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {lastInvestment ? (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-portfolio ring-2 ring-surface pointer-events-none"
            style={{ left: `${Math.min(99, Math.max(1, (lastInvestment.x / LINE_WIDTH) * 100))}%`, top: `${(lastInvestment.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}

        {/* Pontos do dia sob scrubbing (sem sombras) */}
        {scrubIncome ? (
          <span
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-positive-strong ring-2 ring-surface pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubIncome.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {scrubExpense ? (
          <span
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-negative-strong ring-2 ring-surface pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubExpense.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
        {scrubInvestment ? (
          <span
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-portfolio ring-2 ring-surface pointer-events-none"
            style={{ left: scrubLeft, top: `${(scrubInvestment.y / LINE_HEIGHT) * 100}%` }}
          />
        ) : null}
      </div>

      {/* Linha guia vertical do dia sob scrubbing */}
      {scrubLeft ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20" style={{ left: scrubLeft }} />
      ) : null}

      {/* Tooltip flutuante limpo (sem sombras pesadas) */}
      {scrubDay ? (
        <div
          className="pointer-events-none absolute top-0 z-tooltip -translate-x-1/2 rounded-xl border border-border/80 bg-surface/95 backdrop-blur-md p-2.5 text-xs min-w-36 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: scrubLeft }}
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
