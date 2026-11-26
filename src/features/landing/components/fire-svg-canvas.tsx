import { useId } from "react";
import { formatCentsAsBRL } from "@/services/masks/money";
import type { FireChartGeometry, LinePoint } from "@/domain/simulators/fire-curve";

export interface FireSvgCanvasProps {
  years: number;
  geometry: FireChartGeometry;
  activeCoord: LinePoint;
  fireTargetCents: number | null;
  isPointerActive: boolean;
}

const formatCompactBrl = (cents: number): string =>
  formatCentsAsBRL(cents, { hideCents: true });

export function FireSvgCanvas({
  years,
  geometry,
  activeCoord,
  fireTargetCents,
  isPointerActive,
}: FireSvgCanvasProps) {
  const gradientId = useId();
  const { width, height, paddingX, paddingTop, paddingBottom } = geometry.dimensions;

  return (
    <div className="relative w-full overflow-hidden mt-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--positive))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--positive))" stopOpacity="0.01" />
          </linearGradient>
        </defs>

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

        {geometry.fireTargetY !== null && fireTargetCents !== null ? (
          <>
            <line
              x1={paddingX}
              y1={geometry.fireTargetY}
              x2={width - paddingX}
              y2={geometry.fireTargetY}
              stroke="currentColor"
              strokeDasharray="3 3"
              className="text-positive-strong/70 dark:text-positive/70"
              strokeWidth={1.5}
            />
            <text
              x={width - paddingX}
              y={geometry.fireTargetY - 4}
              textAnchor="end"
              className="fill-positive-strong dark:fill-positive text-[11px] font-mono font-bold"
            >
              Meta Patrimonial: {formatCompactBrl(fireTargetCents)}
            </text>
          </>
        ) : null}

        <path d={geometry.areaPath} fill={`url(#${gradientId})`} />

        {geometry.comparisonPath ? (
          <path
            d={geometry.comparisonPath}
            fill="none"
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="text-muted-foreground/60"
          />
        ) : null}

        <path
          d={geometry.smoothCurvePath}
          fill="none"
          stroke="hsl(var(--positive-strong))"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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

        <circle
          cx={activeCoord.x}
          cy={activeCoord.y}
          r={isPointerActive ? "7" : "5.5"}
          className="fill-positive-strong stroke-surface transition-all duration-100"
          strokeWidth={isPointerActive ? "3" : "2"}
        />

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
  );
}
