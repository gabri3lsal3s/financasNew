import type { KeyboardEvent, ReactNode } from "react";
import { computeDonutGeometry } from "@/domain/charts/donut-geometry";
import type { DonutComputedSlice, DonutInputSlice } from "@/domain/charts";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface DonutRingProps {
  slices: readonly DonutInputSlice[];
  /** Tamanho lógico do viewBox quadrado SVG (default 200). */
  size?: number;
  /** Espessura do traço do anel (default 24). */
  strokeWidth?: number;
  /** Espaço angular em graus entre fatias (default 2). */
  gapDegrees?: number;
  /** Id da fatia atualmente destacada/selecionada. */
  activeId?: string | null;
  /** Callback ao selecionar ou alternar uma fatia. */
  onSliceSelect?: (slice: DonutComputedSlice | null) => void;
  /** Callback ao passar o ponteiro sobre uma fatia. */
  onSliceHover?: (slice: DonutComputedSlice | null) => void;
  /** Conteúdo centralizado dentro do anel (total, título, métrica). */
  centerContent?: ReactNode;
  /** Rótulo de acessibilidade do gráfico SVG. */
  ariaLabel?: string;
  className?: string;
}

/**
 * DonutRing — primitivo SVG acessível de gráfico de anel/rosca.
 * Delega toda a geometria e paleta `--cat-1..10` para `@/domain/charts`.
 */
export function DonutRing({
  slices,
  size = 200,
  strokeWidth = 24,
  gapDegrees = 2,
  activeId = null,
  onSliceSelect,
  onSliceHover,
  centerContent,
  ariaLabel = "Gráfico de distribuição",
  className,
}: DonutRingProps) {
  const geometry = computeDonutGeometry(slices, { size, strokeWidth, gapDegrees });
  const isInteractive = Boolean(onSliceSelect);

  const handleSelect = (slice: DonutComputedSlice) => {
    if (!onSliceSelect) return;
    triggerSensory("selection");
    onSliceSelect(activeId === slice.id ? null : slice);
  };

  const handleKeyDown = (slice: DonutComputedSlice) => (event: KeyboardEvent<SVGPathElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(slice);
    }
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        viewBox={`0 0 ${geometry.size} ${geometry.size}`}
        role="img"
        aria-label={ariaLabel}
        className="size-full overflow-visible"
      >
        <circle
          cx={geometry.cx}
          cy={geometry.cy}
          r={geometry.radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={geometry.strokeWidth}
        />

        {geometry.slices.map((slice) => {
          const isActive = activeId === slice.id;
          const isDimmed = activeId !== null && !isActive;

          return (
            <path
              key={slice.id}
              d={slice.pathD}
              fill="none"
              stroke={slice.color}
              strokeWidth={isActive ? geometry.strokeWidth + 3 : geometry.strokeWidth}
              strokeLinecap="butt"
              role={isInteractive ? "button" : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              aria-label={isInteractive ? `${slice.label}: ${slice.percentage.toFixed(1)}%` : undefined}
              aria-pressed={isInteractive ? isActive : undefined}
              onClick={isInteractive ? () => handleSelect(slice) : undefined}
              onKeyDown={isInteractive ? handleKeyDown(slice) : undefined}
              onMouseEnter={onSliceHover ? () => onSliceHover(slice) : undefined}
              onMouseLeave={onSliceHover ? () => onSliceHover(null) : undefined}
              className={cn(
                "transition-[stroke-width,opacity] duration-200 motion-reduce:transition-none",
                isInteractive && "cursor-pointer focus-visible:outline-none",
                isDimmed && "opacity-45",
              )}
            />
          );
        })}
      </svg>

      {centerContent ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          {centerContent}
        </div>
      ) : null}
    </div>
  );
}
