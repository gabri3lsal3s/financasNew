import { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Sparkles, Flag } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { Switch } from "@/components/ui/switch";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsBRL, formatPercent } from "@/services/masks";
import { projectPatrimony, type ProjectionBasis } from "@/domain/portfolio";
import { cn } from "@/lib/utils";

export interface FireProjectionCurveProps {
  /** Patrimônio atual em reais. */
  initialPatrimony?: number;
  /** Aporte mensal em reais. */
  monthlyAporte: number;
  /** Custo de vida mensal desejado em reais (base do capital crítico). */
  monthlyExpenses?: number;
  /** Rentabilidade anual esperada (decimal — 0.08 = 8% a.a.). */
  annualRate?: number;
  /** Yield anual da carteira usado na renda passiva (decimal). Default: `annualRate`. */
  annualPassiveYield?: number;
  years?: number;
  basis?: ProjectionBasis;
  className?: string;
}

interface LinePoint {
  x: number;
  y: number;
}

const money = (valueInReais: number): string =>
  formatCentsAsBRL(Math.round(valueInReais * 100), { hideCents: true });

/**
 * Gera um comando SVG path com curvas suaves (Catmull-Rom / Bézier cúbicas),
 * eliminando cantos pontiagudos e produzindo uma curva fluida como no DailyFlowChart.
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

    // Fator de suavização 0.2 para evitar overshoot
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
 * Curva de projeção patrimonial — a série vem do motor puro
 * `projectPatrimony` (domínio), nunca de cálculo local no componente.
 */
export function FireProjectionCurve({
  initialPatrimony = 0,
  monthlyAporte,
  monthlyExpenses = 2500,
  annualRate = 0.08,
  annualPassiveYield,
  years = 25,
  basis = "nominal",
  className,
}: FireProjectionCurveProps) {
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [isPointerActive, setIsPointerActive] = useState(false);
  const [pillLeft, setPillLeft] = useState<number | null>(null);
  const [realValues, setRealValues] = useState(basis === "real");
  const lastHapticIndexRef = useRef<number | null>(null);

  const activeBasis: ProjectionBasis = realValues ? "real" : "nominal";

  const projection = useMemo(
    () =>
      projectPatrimony({
        initialCents: Math.round(initialPatrimony * 100),
        monthlyContributionCents: Math.round(monthlyAporte * 100),
        annualRatePercent: annualRate * 100,
        annualPassiveYieldPercent: (annualPassiveYield ?? annualRate) * 100,
        monthlyLivingCostCents: Math.round(monthlyExpenses * 100),
        years,
        basis: activeBasis,
      }),
    [initialPatrimony, monthlyAporte, annualRate, annualPassiveYield, monthlyExpenses, years, activeBasis],
  );

  // Série de comparação: mesmo patrimônio e rentabilidade, sem novos aportes
  const comparison = useMemo(() => {
    if (monthlyAporte <= 0) return null;
    return projectPatrimony({
      initialCents: Math.round(initialPatrimony * 100),
      monthlyContributionCents: 0,
      annualRatePercent: annualRate * 100,
      annualPassiveYieldPercent: (annualPassiveYield ?? annualRate) * 100,
      monthlyLivingCostCents: Math.round(monthlyExpenses * 100),
      years,
      basis: activeBasis,
    });
  }, [initialPatrimony, monthlyAporte, annualRate, annualPassiveYield, monthlyExpenses, years, activeBasis]);

  const dataPoints = projection.years;
  const fireTarget = projection.independenceTargetCents;
  const fireCrossoverIndex =
    fireTarget !== null ? dataPoints.findIndex((point) => point.balanceCents >= fireTarget) : -1;
  const fireCrossover = fireCrossoverIndex !== -1 ? dataPoints[fireCrossoverIndex]! : null;

  // Dimensões do SVG
  const width = 500;
  const height = 180;
  const paddingX = 14;
  const paddingTop = 16;
  const paddingBottom = 26;

  const lastBalance = dataPoints[dataPoints.length - 1]?.balanceCents ?? 0;
  const maxBalance = Math.max((fireTarget ?? 0) * 1.15, lastBalance, 1);

  const linePoints: LinePoint[] = useMemo(() => {
    const usableHeight = height - paddingTop - paddingBottom;
    const usableWidth = width - paddingX * 2;
    const lastIndex = Math.max(1, dataPoints.length - 1);
    return dataPoints.map((point, idx) => {
      const x = paddingX + (idx / lastIndex) * usableWidth;
      const normalized = Math.min(1, Math.max(0, point.balanceCents / maxBalance));
      const y = height - paddingBottom - normalized * usableHeight;
      return { x, y };
    });
  }, [dataPoints, maxBalance]);

  const smoothCurvePath = useMemo(() => toSmoothPath(linePoints), [linePoints]);

  const comparisonPath = useMemo(() => {
    if (!comparison) return "";
    const usableHeight = height - paddingTop - paddingBottom;
    const usableWidth = width - paddingX * 2;
    const lastIndex = Math.max(1, comparison.years.length - 1);
    const points = comparison.years.map((point, idx) => ({
      x: paddingX + (idx / lastIndex) * usableWidth,
      y:
        height -
        paddingBottom -
        Math.min(1, Math.max(0, point.balanceCents / maxBalance)) * usableHeight,
    }));
    return toSmoothPath(points);
  }, [comparison, maxBalance]);

  const areaD = useMemo(() => {
    if (linePoints.length === 0) return "";
    return `${smoothCurvePath} L ${linePoints[linePoints.length - 1]!.x} ${height - paddingBottom} L ${linePoints[0]!.x} ${height - paddingBottom} Z`;
  }, [smoothCurvePath, linePoints]);

  const fireTargetY =
    fireTarget !== null
      ? height - paddingBottom - (fireTarget / maxBalance) * (height - paddingTop - paddingBottom)
      : null;

  const activeIndex =
    scrubIndex !== null ? scrubIndex : fireCrossoverIndex !== -1 ? fireCrossoverIndex : dataPoints.length - 1;

  const activePoint = dataPoints[activeIndex]!;
  const activeCoord = linePoints[activeIndex]!;

  // Mantém o pill flutuante integralmente dentro do painel (zero corte nas bordas)
  const syncPillPosition = useCallback(() => {
    const wrapper = chartWrapperRef.current;
    const pill = pillRef.current;
    if (!wrapper || !pill) return;
    const usableWidth = wrapper.clientWidth;
    if (usableWidth <= 0) return;

    const ratio = activeIndex / Math.max(1, dataPoints.length - 1);
    const halfWidth = pill.offsetWidth / 2 + 8;
    const target = ratio * usableWidth;
    setPillLeft(Math.min(Math.max(target, halfWidth), Math.max(halfWidth, usableWidth - halfWidth)));
  }, [activeIndex, dataPoints.length]);

  useLayoutEffect(() => {
    syncPillPosition();
  }, [syncPillPosition]);

  useEffect(() => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncPillPosition());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [syncPillPosition]);

  // Manipulador unificado de coordenadas relativas do ponteiro com captura nativa
  const updatePointerIndex = useCallback(
    (clientX: number) => {
      const el = chartWrapperRef.current;
      if (!el || dataPoints.length === 0) return;
      const rect = el.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, relativeX / Math.max(1, rect.width)));
      const nextIndex = Math.round(ratio * (dataPoints.length - 1));

      if (nextIndex !== lastHapticIndexRef.current) {
        lastHapticIndexRef.current = nextIndex;
        triggerSensory("selection", { skipSound: true });
      }

      setScrubIndex(nextIndex);
    },
    [dataPoints.length],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPointerActive(true);
    updatePointerIndex(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPointerActive || event.pointerType === "mouse") {
      updatePointerIndex(event.clientX);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setIsPointerActive(false);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setIsPointerActive(false);
  };

  const setYearExplicit = (year: number) => {
    const clampedYear = Math.max(0, Math.min(years, year));
    lastHapticIndexRef.current = clampedYear;
    triggerSensory("selection", { skipSound: true });
    setScrubIndex(clampedYear);
  };

  const isFireReached = fireTarget !== null && activePoint.balanceCents >= fireTarget;
  const livingCostCents = Math.round(monthlyExpenses * 100);
  const livingCostCoveragePct =
    livingCostCents > 0 ? Math.round((activePoint.monthlyPassiveIncomeCents / livingCostCents) * 100) : 0;
  const horizonProgressPct =
    fireCrossover && fireCrossover.year > 0 ? Math.min(100, (activePoint.year / fireCrossover.year) * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-3.5 sm:gap-4 w-full min-w-0 select-none", className)}>
      {/* Zona Interativa do Gráfico — sem controles focáveis dentro do widget slider */}
      <div
        ref={chartWrapperRef}
        role="slider"
        aria-label="Projeção patrimonial ao longo dos anos"
        aria-valuemin={0}
        aria-valuemax={years}
        aria-valuenow={activePoint.year}
        aria-valuetext={`${activePoint.year} anos, patrimônio estimado de ${money(activePoint.balanceCents / 100)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setYearExplicit(activePoint.year - 1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setYearExplicit(activePoint.year + 1);
          } else if (e.key === "Home") {
            e.preventDefault();
            setYearExplicit(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setYearExplicit(years);
          }
        }}
        className="relative w-full rounded-2xl bg-surface/40 p-2 sm:p-3 border border-border/80 touch-none cursor-ew-resize select-none overflow-hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        data-swipe-nav-ignore
      >
        {/* Leitura ativa ancorada ao ponto — posição clampada dentro do painel */}
        <div
          ref={pillRef}
          className={cn(
            "absolute z-20 pointer-events-none transition-[left] duration-75 ease-out",
            pillLeft === null && "opacity-0",
          )}
          style={{
            left: `${pillLeft ?? 0}px`,
            top: "10px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border/90 shadow-md text-xs font-mono whitespace-nowrap">
            <span className="font-bold text-foreground">
              {activePoint.year === 0 ? "Hoje" : `${activePoint.year}a`}
            </span>
            <span className="text-muted-foreground/60" aria-hidden="true">
              ·
            </span>
            <MoneyText
              cents={activePoint.balanceCents}
              hideCents
              tone="default"
              className="font-bold tabular-nums"
            />
            {isFireReached ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-positive-strong bg-positive/10 px-1.5 py-0.5 rounded-md">
                <Sparkles className="size-3" aria-hidden="true" />
                Meta
              </span>
            ) : null}
          </div>
        </div>

        {/* Gráfico SVG Fluido */}
        <div className="relative w-full overflow-hidden mt-4">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            <defs>
              <linearGradient id="fireAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--positive)" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Linhas guias horizontais sutis */}
            <line
              x1={paddingX}
              y1={paddingTop}
              x2={width - paddingX}
              y2={paddingTop}
              stroke="currentColor"
              strokeDasharray="2 4"
              className="text-border/25"
              strokeWidth={1}
            />
            <line
              x1={paddingX}
              y1={(height - paddingBottom + paddingTop) / 2}
              x2={width - paddingX}
              y2={(height - paddingBottom + paddingTop) / 2}
              stroke="currentColor"
              strokeDasharray="2 4"
              className="text-border/20"
              strokeWidth={1}
            />
            <line
              x1={paddingX}
              y1={height - paddingBottom}
              x2={width - paddingX}
              y2={height - paddingBottom}
              stroke="currentColor"
              strokeDasharray="2 4"
              className="text-border/30"
              strokeWidth={1}
            />

            {/* Linha Tracejada do Capital Crítico de Independência */}
            {fireTargetY !== null && fireTarget !== null ? (
              <>
                <line
                  x1={paddingX}
                  y1={fireTargetY}
                  x2={width - paddingX}
                  y2={fireTargetY}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-positive-strong/70 dark:text-positive/70"
                  strokeWidth={1.5}
                />
                <text
                  x={width - paddingX}
                  y={fireTargetY - 4}
                  textAnchor="end"
                  className="fill-positive-strong dark:fill-positive text-[11px] font-mono font-bold"
                >
                  Meta Patrimonial: {money(fireTarget / 100)}
                </text>
              </>
            ) : null}

            {/* Área com Gradiente Suave */}
            <path d={areaD} fill="url(#fireAreaGradient)" />

            {/* Cenário sem novos aportes — apenas rentabilidade composta */}
            {comparisonPath ? (
              <path
                d={comparisonPath}
                fill="none"
                stroke="currentColor"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                strokeLinecap="round"
                className="text-muted-foreground/60"
              />
            ) : null}

            {/* Linha Principal da Curva Suave Bézier */}
            <path
              d={smoothCurvePath}
              fill="none"
              stroke="var(--positive-strong)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Linha vertical de referência que acompanha o scrubbing */}
            <line
              x1={activeCoord.x}
              y1={paddingTop}
              x2={activeCoord.x}
              y2={height - paddingBottom}
              stroke="currentColor"
              strokeDasharray="2 2"
              className="text-foreground/40"
              strokeWidth={1.5}
            />

            {/* Ponto Destaque com anel de alto contraste e halo responsivo */}
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r={isPointerActive ? "7" : "5.5"}
              className="fill-positive-strong stroke-surface transition-all duration-100"
              strokeWidth={isPointerActive ? "3" : "2"}
            />

            {/* Eixo temporal em duas faixas: apenas início e fim (zero colisão) */}
            <text x={paddingX} y={height - 6} className="fill-muted-foreground text-[11px] font-mono">
              Hoje
            </text>
            <text
              x={width - paddingX}
              y={height - 6}
              textAnchor="end"
              className="fill-muted-foreground text-[11px] font-mono"
            >
              {years} anos
            </text>
          </svg>
        </div>
      </div>

      {/* Legenda + ajuste inflacionário: 2 séries e 1 controle declarado */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-positive-strong" aria-hidden="true" />
            <span>Com aportes</span>
          </span>
          {comparisonPath ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-4 border-t border-dashed border-muted-foreground/70"
                aria-hidden="true"
              />
              <span>Sem aportes</span>
            </span>
          ) : null}
        </div>
        <Switch
          checked={realValues}
          onCheckedChange={setRealValues}
          label="Valores reais"
          aria-label="Descontar a inflação de 4% ao ano"
          className="shrink-0"
        />
      </div>

      {/* Marcos de navegação — fora do widget slider (ARIA válido) */}
      <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
        <button
          type="button"
          onClick={() => setYearExplicit(0)}
          className={cn(
            "px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border text-center font-semibold",
            activePoint.year === 0
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-surface border-border/80 text-muted-foreground hover:text-foreground",
          )}
        >
          Hoje
        </button>

        {fireCrossover ? (
          <button
            type="button"
            onClick={() => setYearExplicit(fireCrossover.year)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border text-center font-semibold flex items-center gap-1.5",
              activePoint.year === fireCrossover.year
                ? "bg-positive/15 border-positive-strong text-positive-strong shadow-xs"
                : "bg-surface border-positive-strong/40 text-positive-strong hover:bg-positive/10",
            )}
          >
            <Flag className="size-3" aria-hidden="true" />
            <span>Independência ({fireCrossover.year}a)</span>
          </button>
        ) : (
          <span className="px-2 py-1.5 text-xs text-muted-foreground">
            Meta não alcançada em {years} anos
          </span>
        )}
      </div>

      {projection.interestExceedsContributionAt ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Ponto de inflexão: a partir de {projection.interestExceedsContributionAt.year}a
          {projection.interestExceedsContributionAt.month}m a rentabilidade mensal supera o aporte de{" "}
          {money(monthlyAporte)}.
        </p>
      ) : null}

      {/* Grid com os 3 Cards Métricos — mobile-first, sem truncamento de valores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
        {/* Card 1: Horizonte Patrimonial */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface/60 border border-border/80 shadow-xs text-left min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-muted-foreground">Horizonte</span>
            <span className="size-1.5 rounded-full bg-positive-strong shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 min-w-0">
            <span className="font-mono font-bold text-foreground text-sm sm:text-base tabular-nums tracking-tight block whitespace-nowrap">
              {activePoint.year === 0 ? "Hoje" : `${activePoint.year} anos`}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              {fireCrossover ? `Meta em ${fireCrossover.year} anos` : `Horizonte de ${years} anos`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-positive-strong transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, horizonProgressPct))}%` }}
            />
          </div>
        </div>

        {/* Card 2: Patrimônio Acumulado */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface/60 border border-border/80 shadow-xs text-left min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-muted-foreground">Patrimônio</span>
            <span className="size-1.5 rounded-full bg-portfolio shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 min-w-0">
            <MoneyText
              cents={activePoint.balanceCents}
              tone="default"
              hideCents
              className="font-bold text-foreground text-sm sm:text-base tabular-nums tracking-tight block"
            />
            <span className="text-xs text-muted-foreground block mt-0.5">
              {formatPercent(activePoint.targetProgressPct)}% da meta
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-portfolio transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, activePoint.targetProgressPct))}%` }}
            />
          </div>
        </div>

        {/* Card 3: Renda Passiva Estimada (yield da carteira) */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface/60 border border-border/80 shadow-xs text-left min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-muted-foreground">Renda passiva</span>
            <span className="size-1.5 rounded-full bg-positive-strong shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 min-w-0">
            <MoneyText
              cents={activePoint.monthlyPassiveIncomeCents}
              tone="positive"
              hideCents
              className="font-bold text-positive-strong dark:text-positive text-sm sm:text-base tabular-nums tracking-tight block"
            />
            <span className="text-xs text-muted-foreground block mt-0.5">
              {livingCostCoveragePct}% do custo de vida
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-positive-strong transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, livingCostCoveragePct))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
