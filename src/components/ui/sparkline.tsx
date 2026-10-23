import { cn } from "@/lib/utils";
import { toMonotoneCubicPath, toAreaPath } from "@/lib/chart-curve";
import type { ChartPoint } from "@/lib/chart-curve";

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
  /** Suaviza as curvas usando spline monótona (default false para polilinha linear, true para curva suave). */
  smooth?: boolean;
}

const DEFAULT_STROKE = "stroke-primary";
const DEFAULT_FILL = "fill-primary/15";

/** Converte a série em pontos SVG ancorados em zero com folga de 2px. */
function toSparklinePointList(data: readonly number[], width: number, height: number): ChartPoint[] {
  if (data.length === 0) return [];
  const pointsData = data.length === 1 ? [data[0]!, data[0]!] : data;

  const rawMin = Math.min(...pointsData);
  const rawMax = Math.max(...pointsData);
  // Ancora a escala em zero para que valores positivos não flutuem
  const min = Math.min(0, rawMin);
  const max = Math.max(0, rawMax);
  const range = max - min || 1;
  const step = pointsData.length > 1 ? width / (pointsData.length - 1) : width;
  const baselineY = height - 2;

  return pointsData.map((value, index) => {
    const x = index * step;
    const y = baselineY - ((value - min) / range) * (height - 4);
    return { x, y };
  });
}

function toPoints(pointList: readonly ChartPoint[]): string {
  return pointList.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
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
  smooth = false,
}: SparklineProps) {
  const pointList = toSparklinePointList(data, width, height);
  if (pointList.length === 0) return null;

  const baselineY = height - 2;
  const hasNonZero = data.some((v) => v !== 0);

  if (smooth) {
    const smoothPath = toMonotoneCubicPath(pointList, baselineY);
    const areaPath = filled && hasNonZero ? toAreaPath(pointList, smoothPath, baselineY) : "";

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className={cn("h-8 w-full", className)}
      >
        {filled && hasNonZero && areaPath ? (
          <path d={areaPath} className={cn("fill-current/15", fillClassName)} />
        ) : null}
        <path
          d={smoothPath}
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

  const points = toPoints(pointList);
  const areaPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-8 w-full", className)}
    >
      {filled && hasNonZero ? <polygon points={areaPoints} className={fillClassName} /> : null}
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

