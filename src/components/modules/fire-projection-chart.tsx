import { useId } from "react";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks";
import type { FireProjectionPoint } from "@/domain/fire";

const WIDTH = 320;
const HEIGHT = 140;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 20;

export interface FireProjectionChartProps {
  /** Série anual (ano 0 = hoje). */
  series: FireProjectionPoint[];
  /** Meta FIRE (centavos) — linha de referência tracejada. */
  targetCents: number;
  className?: string;
}

/**
 * FireProjectionChart (F24) — projeção do patrimônio ao longo dos anos como
 * polilinha SVG (capital × ano) com a linha tracejada da meta FIRE. SVG puro,
 * sem libs de gráfico; acessível via `role="img"` + aria-label.
 */
export function FireProjectionChart({ series, targetCents, className }: FireProjectionChartProps) {
  const gradientId = useId();
  const maxCapital = Math.max(
    ...series.map((point) => point.capitalCents),
    targetCents,
    1,
  );
  const lastYear = series.length > 0 ? (series[series.length - 1]?.year ?? 0) : 0;

  const x = (year: number): number => PAD_X + (year / Math.max(1, lastYear)) * (WIDTH - PAD_X * 2);
  const y = (value: number): number => HEIGHT - PAD_BOTTOM - (value / maxCapital) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const points = series.map((point) => `${x(point.year)},${y(point.capitalCents)}`).join(" ");
  const targetY = y(targetCents);

  const lastPoint = series[series.length - 1];
  const finalLabel = lastPoint ? formatCentsAsBRL(lastPoint.capitalCents) : "—";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Projeção do patrimônio até ${lastYear} anos — meta FIRE de ${formatCentsAsBRL(targetCents)}. Valor final projetado: ${finalLabel}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="stop-primary/25" />
            <stop offset="100%" className="stop-primary/0" />
          </linearGradient>
        </defs>

        {/* Área sob a curva */}
        <polygon
          points={`${x(0)},${y(0)} ${points} ${x(lastYear)},${HEIGHT - PAD_BOTTOM} ${x(0)},${HEIGHT - PAD_BOTTOM}`}
          fill={`url(#${gradientId})`}
        />

        {/* Linha da meta FIRE */}
        <line
          x1={PAD_X}
          y1={targetY}
          x2={WIDTH - PAD_X}
          y2={targetY}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          className="text-positive-strong/70"
        />
        <text x={WIDTH - PAD_X} y={targetY - 4} textAnchor="end" className="fill-positive-strong text-[9px]">
          Meta: {formatCentsAsBRL(targetCents)}
        </text>

        {/* Curva do patrimônio */}
        <polyline
          points={points}
          fill="none"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-primary"
        />

        {/* Rótulos dos eixos */}
        <text x={PAD_X} y={HEIGHT - 6} className="fill-muted-foreground text-[9px]">
          Ano 0
        </text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {lastYear} anos
        </text>
      </svg>
      <p className="text-[11px] text-muted-foreground">
        Patrimônio projetado no ano {lastYear}: <span className="font-semibold text-foreground">{finalLabel}</span>
      </p>
    </div>
  );
}
