import type { PatrimonyProjectionResult, PatrimonyProjectionYear } from "@/domain/portfolio";

export interface LinePoint {
  x: number;
  y: number;
}

export interface FireSvgDimensions {
  width: number;
  height: number;
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
}

export const FIRE_SVG_DIMENSIONS: FireSvgDimensions = {
  width: 500,
  height: 180,
  paddingX: 14,
  paddingTop: 16,
  paddingBottom: 26,
};

export interface FireChartGeometry {
  linePoints: LinePoint[];
  smoothCurvePath: string;
  comparisonPath: string;
  areaPath: string;
  fireTargetY: number | null;
  fireCrossoverIndex: number;
  fireCrossover: PatrimonyProjectionYear | null;
  maxBalance: number;
  dimensions: FireSvgDimensions;
}

/**
 * Gera um comando SVG path com curvas suaves (Catmull-Rom / Bézier cúbicas),
 * eliminando cantos pontiagudos e mantendo fidelidade aos pontos anuais.
 */
export function toSmoothPath(points: readonly LinePoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  let path = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    const k = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * k;
    const cp1y = p1.y + (p2.y - p0.y) * k;
    const cp2x = p2.x - (p3.x - p1.x) * k;
    const cp2y = p2.y - (p3.y - p1.y) * k;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function mapSeriesToPoints(
  series: readonly PatrimonyProjectionYear[],
  maxBalance: number,
  dimensions: FireSvgDimensions,
): LinePoint[] {
  const { width, height, paddingX, paddingTop, paddingBottom } = dimensions;
  const usableHeight = height - paddingTop - paddingBottom;
  const usableWidth = width - paddingX * 2;
  const lastIndex = Math.max(1, series.length - 1);

  return series.map((point, idx) => {
    const x = paddingX + (idx / lastIndex) * usableWidth;
    const normalized = Math.min(1, Math.max(0, point.balanceCents / maxBalance));
    const y = height - paddingBottom - normalized * usableHeight;
    return { x, y };
  });
}

/**
 * Calcula toda a geometria SVG da curva patrimonial FIRE de forma pura e determinística.
 */
export function buildFireChartGeometry(
  projection: PatrimonyProjectionResult,
  comparison: PatrimonyProjectionResult | null,
  dimensions: FireSvgDimensions = FIRE_SVG_DIMENSIONS,
): FireChartGeometry {
  const dataPoints = projection.years;
  const fireTarget = projection.independenceTargetCents;
  const fireCrossoverIndex =
    fireTarget !== null ? dataPoints.findIndex((point) => point.balanceCents >= fireTarget) : -1;
  const fireCrossover = fireCrossoverIndex !== -1 ? dataPoints[fireCrossoverIndex]! : null;

  const lastBalance = dataPoints[dataPoints.length - 1]?.balanceCents ?? 0;
  const maxBalance = Math.max((fireTarget ?? 0) * 1.15, lastBalance, 1);

  const linePoints = mapSeriesToPoints(dataPoints, maxBalance, dimensions);
  const smoothCurvePath = toSmoothPath(linePoints);

  const comparisonPath = comparison
    ? toSmoothPath(mapSeriesToPoints(comparison.years, maxBalance, dimensions))
    : "";

  const baselineY = dimensions.height - dimensions.paddingBottom;
  const areaPath =
    linePoints.length > 0
      ? `${smoothCurvePath} L ${linePoints[linePoints.length - 1]!.x} ${baselineY} L ${linePoints[0]!.x} ${baselineY} Z`
      : "";

  const usableHeight = dimensions.height - dimensions.paddingTop - dimensions.paddingBottom;
  const fireTargetY =
    fireTarget !== null ? baselineY - (fireTarget / maxBalance) * usableHeight : null;

  return {
    linePoints,
    smoothCurvePath,
    comparisonPath,
    areaPath,
    fireTargetY,
    fireCrossoverIndex,
    fireCrossover,
    maxBalance,
    dimensions,
  };
}
