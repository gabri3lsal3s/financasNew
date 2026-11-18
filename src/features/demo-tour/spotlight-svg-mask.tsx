import { cn } from "@/lib/utils";
import type { MotionLevel } from "@/hooks/use-visual-customization";
import type { SpotlightRect } from "./hooks/use-spotlight-target-rect";

export interface SpotlightSvgMaskProps {
  rect: SpotlightRect | null;
  isTargetLoading: boolean;
  isPulsing: boolean;
  motionLevel: MotionLevel;
}

/**
 * Máscara SVG com recorte iluminado ao redor do elemento alvo usando token semântico de overlay.
 */
export function SpotlightSvgMask({
  rect,
  isTargetLoading,
  isPulsing,
  motionLevel,
}: SpotlightSvgMaskProps) {
  const isReduced = motionLevel === "reduced";
  const allowPulse = motionLevel === "fluid" && isPulsing;

  return (
    <svg
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 size-full pointer-events-auto"
      width="100%"
      height="100%"
    >
      <defs>
        <mask id="demo-tour-spotlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {rect && !isTargetLoading ? (
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={rect.borderRadius}
              ry={rect.borderRadius}
              fill="black"
              className={isReduced ? undefined : "transition-all duration-300 ease-out"}
            />
          ) : null}
        </mask>
      </defs>

      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="hsl(var(--overlay))"
        mask="url(#demo-tour-spotlight-mask)"
        data-testid="spotlight-backdrop"
        className="fill-overlay"
      />

      {rect && !isTargetLoading ? (
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={rect.borderRadius}
          ry={rect.borderRadius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray="4 2"
          data-testid="spotlight-border"
          className={cn(
            !isReduced && "transition-all duration-300 ease-out",
            allowPulse ? "animate-pulse opacity-90" : "opacity-75",
          )}
        />
      ) : null}
    </svg>
  );
}
