import { cn } from "@/lib/utils";

export interface SparklineProps {
  /** Série de valores (ex.: totais mensais) — ordenada cronologicamente. */
  data: readonly number[];
  /** Largura do viewBox (default 120). */
  width?: number;
  /** Altura do viewBox (default 40). */
  height?: number;
  /** Classe de cor do traço (default primary). */
  strokeClassName?: string;
  /** Preenche a área sob a linha (classe de fill, default primary translúcido). */
  filled?: boolean;
  fillClassName?: string;
  className?: string;
}

const DEFAULT_STROKE = "stroke-primary";
const DEFAULT_FILL = "fill-primary/15";

/** Converte a série em pontos SVG (escala automática com folga de 2px). */
function toPoints(data: readonly number[], width: number, height: number): string {
  if (data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  return data
    .map((value, index) => {
      const x = index * step;
      const y = height - 2 - ((value - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Sparkline — micro-gráfico de tendência para KPIs (F8). SVG com viewBox
 * (`preserveAspectRatio="none"` para se ajustar à largura do card) e
 * `aria-hidden` (informação complementar ao valor do KPI).
 */
export function Sparkline({
  data,
  width = 120,
  height = 40,
  strokeClassName = DEFAULT_STROKE,
  filled = false,
  fillClassName = DEFAULT_FILL,
  className,
}: SparklineProps) {
  const points = toPoints(data, width, height);

  if (points === "") return null;

  const areaPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-8 w-full", className)}
    >
      {filled ? <polygon points={areaPoints} className={fillClassName} /> : null}
      <polyline
        points={points}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("text-current", strokeClassName)}
      />
    </svg>
  );
}
