import { useState, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

export interface FireProjectionCurveProps {
  initialPatrimony?: number;
  monthlyAporte: number;
  monthlyExpenses?: number;
  annualRate?: number;
  years?: number;
  className?: string;
}

interface LinePoint {
  x: number;
  y: number;
}

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

export function FireProjectionCurve({
  initialPatrimony = 0,
  monthlyAporte,
  monthlyExpenses = 2500,
  annualRate = 0.08,
  years = 25,
  className,
}: FireProjectionCurveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // Regra 4%: Patrimônio necessário = Despesas anuais * 25
  const fireTarget = monthlyExpenses * 12 * 25;

  const dataPoints = useMemo(() => {
    const points: Array<{ year: number; balance: number; passiveMonthly: number }> = [];
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

    let balance = initialPatrimony;
    for (let y = 0; y <= years; y++) {
      if (y === 0) {
        const passiveMonthly = (balance * 0.04) / 12;
        points.push({ year: 0, balance: Math.round(balance), passiveMonthly: Math.round(passiveMonthly) });
      } else {
        for (let m = 0; m < 12; m++) {
          balance = balance * (1 + monthlyRate) + monthlyAporte;
        }
        const passiveMonthly = (balance * 0.04) / 12;
        points.push({ year: y, balance: Math.round(balance), passiveMonthly: Math.round(passiveMonthly) });
      }
    }
    return points;
  }, [initialPatrimony, monthlyAporte, annualRate, years]);

  // Encontra o ano de crossover (onde o patrimônio atinge ou supera o alvo FIRE)
  const fireCrossoverIndex = dataPoints.findIndex((p) => p.balance >= fireTarget);
  const fireCrossover = fireCrossoverIndex !== -1 ? dataPoints[fireCrossoverIndex] : null;

  // Dimensões do SVG com proporção confortável e ampla
  const width = 500;
  const height = 170;
  const paddingX = 14;
  const paddingTop = 14;
  const paddingBottom = 24;

  const maxBalance = Math.max(fireTarget * 1.15, dataPoints[dataPoints.length - 1]?.balance ?? 1);

  const linePoints: LinePoint[] = useMemo(() => {
    const usableHeight = height - paddingTop - paddingBottom;
    const usableWidth = width - paddingX * 2;
    const lastIndex = Math.max(1, dataPoints.length - 1);
    return dataPoints.map((point, idx) => {
      const x = paddingX + (idx / lastIndex) * usableWidth;
      const normalized = Math.min(1, Math.max(0, point.balance / maxBalance));
      const y = height - paddingBottom - normalized * usableHeight;
      return { x, y };
    });
  }, [dataPoints, maxBalance]);

  const smoothCurvePath = useMemo(() => toSmoothPath(linePoints), [linePoints]);

  const areaD = useMemo(() => {
    if (linePoints.length === 0) return "";
    return `${smoothCurvePath} L ${linePoints[linePoints.length - 1]!.x} ${height - paddingBottom} L ${linePoints[0]!.x} ${height - paddingBottom} Z`;
  }, [smoothCurvePath, linePoints]);

  const fireTargetY = height - paddingBottom - (fireTarget / maxBalance) * (height - paddingTop - paddingBottom);

  const activeIndex =
    scrubIndex !== null
      ? scrubIndex
      : fireCrossoverIndex !== -1
        ? fireCrossoverIndex
        : dataPoints.length - 1;

  const activePoint = dataPoints[activeIndex]!;
  const activeCoord = linePoints[activeIndex]!;

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || dataPoints.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    const index = Math.max(0, Math.min(dataPoints.length - 1, Math.round(ratio * (dataPoints.length - 1))));
    setScrubIndex(index);
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col gap-3 sm:gap-4 w-full min-w-0 select-none", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setScrubIndex(null)}
      data-swipe-nav-ignore
    >
      {/* Gráfico de Linha Amplo e Fluido (Estilo DailyFlowChart) */}
      <div className="relative w-full overflow-hidden cursor-crosshair" aria-hidden="true">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="fireAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Linhas guias horizontais sutis (padrão DailyFlowChart) */}
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

          {/* Linha Tracejada da Meta FIRE */}
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

          {/* Rótulo da Meta FIRE */}
          <text
            x={width - paddingX}
            y={fireTargetY - 4}
            textAnchor="end"
            className="fill-positive-strong dark:fill-positive text-[10px] font-mono font-bold"
          >
            Meta FIRE: {formatBRL(fireTarget)}
          </text>

          {/* Área com Gradiente Suave */}
          <path d={areaD} fill="url(#fireAreaGradient)" />

          {/* Linha Principal da Curva Suave Bézier */}
          <path
            d={smoothCurvePath}
            fill="none"
            stroke="var(--positive-strong)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Linha vertical de referência sob scrubbing */}
          <line
            x1={activeCoord.x}
            y1={paddingTop}
            x2={activeCoord.x}
            y2={height - paddingBottom}
            stroke="currentColor"
            strokeDasharray="2 2"
            className="text-foreground/30"
            strokeWidth={1}
          />

          {/* Ponto Destaque com anel de alto contraste */}
          <circle
            cx={activeCoord.x}
            cy={activeCoord.y}
            r="5"
            className="fill-positive-strong stroke-surface"
            strokeWidth="2.5"
          />

          {/* Rótulos dos eixos temporais */}
          <text x={paddingX} y={height - 6} className="fill-muted-foreground text-[10px] font-mono">
            Ano 0 (Hoje)
          </text>
          {fireCrossover && fireCrossover.year > 0 && fireCrossover.year < years ? (
            <text
              x={linePoints[fireCrossoverIndex]!.x}
              y={height - 6}
              textAnchor="middle"
              className="fill-positive-strong text-[10px] font-mono font-bold"
            >
              {fireCrossover.year} anos (Independência FIRE)
            </text>
          ) : null}
          <text x={width - paddingX} y={height - 6} textAnchor="end" className="fill-muted-foreground text-[10px] font-mono">
            {years} anos
          </text>
        </svg>
      </div>

      {/* Grid com os 3 Cards Métricos Ricos, Espaçosos e com Barras de Progresso */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 pt-1">
        {/* Card 1: Horizonte FIRE */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface/60 border border-border/70 shadow-xs transition-all text-left">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-muted-foreground truncate">Horizonte FIRE</span>
            <span className="size-2 rounded-full bg-positive-strong shrink-0" />
          </div>
          <div className="mt-1">
            <span className="font-mono font-bold text-foreground text-base sm:text-lg tabular-nums block">
              {activePoint.year === 0 ? "Ano 0 (Início)" : `${activePoint.year} anos`}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              {fireCrossover ? `Independência em ${fireCrossover.year} anos` : "Projeção 25 anos"}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2">
            <div
              className="h-full rounded-full bg-positive-strong transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(5, (activePoint.year / (fireCrossover?.year || years)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Card 2: Patrimônio Acumulado */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface/60 border border-border/70 shadow-xs transition-all text-left">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-muted-foreground truncate">Patrimônio Acumulado</span>
            <span className="size-2 rounded-full bg-portfolio shrink-0" />
          </div>
          <div className="mt-1">
            <MoneyText
              cents={activePoint.balance * 100}
              tone="default"
              className="font-mono font-bold text-foreground text-base sm:text-lg tabular-nums block"
            />
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              {Math.round((activePoint.balance / fireTarget) * 100)}% da meta atingida
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2">
            <div
              className="h-full rounded-full bg-portfolio transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(5, (activePoint.balance / fireTarget) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Card 3: Renda Mensal Passiva */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface/60 border border-border/70 shadow-xs transition-all text-left">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-muted-foreground truncate">Renda Mensal Passiva</span>
            <span className="size-2 rounded-full bg-positive-strong shrink-0" />
          </div>
          <div className="mt-1">
            <div className="flex items-baseline gap-0.5">
              <MoneyText
                cents={activePoint.passiveMonthly * 100}
                tone="positive"
                className="font-mono font-bold text-positive-strong dark:text-positive text-base sm:text-lg tabular-nums"
              />
              <span className="text-[11px] text-muted-foreground font-normal">/mês</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              Regra dos 4% perpétua
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2">
            <div
              className="h-full rounded-full bg-positive-strong transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(5, (activePoint.passiveMonthly / monthlyExpenses) * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
