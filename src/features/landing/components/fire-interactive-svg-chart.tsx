import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Sparkles } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { formatCentsAsBRL } from "@/services/masks";
import type { PatrimonyProjectionYear } from "@/domain/portfolio";
import type { FireChartGeometry } from "@/domain/simulators/fire-curve";
import { cn } from "@/lib/utils";
import { FireSvgCanvas } from "./fire-svg-canvas";

export interface FireInteractiveSvgChartProps {
  years: number;
  dataPoints: readonly PatrimonyProjectionYear[];
  activeIndex: number;
  activePoint: PatrimonyProjectionYear;
  geometry: FireChartGeometry;
  fireTargetCents: number | null;
  isFireReached: boolean;
  onSelectIndex: (index: number, emitSensory: boolean) => void;
}

const formatCompactBrl = (cents: number): string =>
  formatCentsAsBRL(cents, { hideCents: true });

export function FireInteractiveSvgChart({
  years,
  dataPoints,
  activeIndex,
  activePoint,
  geometry,
  fireTargetCents,
  isFireReached,
  onSelectIndex,
}: FireInteractiveSvgChartProps) {
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [isPointerActive, setIsPointerActive] = useState(false);
  const [pillLeft, setPillLeft] = useState<number | null>(null);

  const { height, paddingX, paddingBottom } = geometry.dimensions;
  const activeCoord = geometry.linePoints[activeIndex] ?? {
    x: paddingX,
    y: height - paddingBottom,
  };

  const syncPillPosition = useCallback(() => {
    const wrapper = chartWrapperRef.current;
    const pill = pillRef.current;
    if (!wrapper || !pill) return;
    const usableWidth = wrapper.clientWidth;
    if (usableWidth <= 0) return;

    const ratio = activeIndex / Math.max(1, dataPoints.length - 1);
    const halfWidth = pill.offsetWidth / 2 + 8;
    const target = ratio * usableWidth;
    setPillLeft(
      Math.min(Math.max(target, halfWidth), Math.max(halfWidth, usableWidth - halfWidth)),
    );
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

  const resolveIndexFromClientX = useCallback(
    (clientX: number) => {
      const el = chartWrapperRef.current;
      if (!el || dataPoints.length === 0) return 0;
      const rect = el.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, relativeX / Math.max(1, rect.width)));
      return Math.round(ratio * (dataPoints.length - 1));
    },
    [dataPoints.length],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPointerActive(true);
    onSelectIndex(resolveIndexFromClientX(event.clientX), true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPointerActive) {
      onSelectIndex(resolveIndexFromClientX(event.clientX), true);
      return;
    }
    if (event.pointerType === "mouse") {
      onSelectIndex(resolveIndexFromClientX(event.clientX), false);
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setIsPointerActive(false);
  };

  return (
    <div
      ref={chartWrapperRef}
      role="slider"
      aria-label="Projeção patrimonial ao longo dos anos"
      aria-valuemin={0}
      aria-valuemax={years}
      aria-valuenow={activePoint.year}
      aria-valuetext={`${activePoint.year} anos, patrimônio estimado de ${formatCompactBrl(activePoint.balanceCents)}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSelectIndex(activePoint.year - 1, true);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onSelectIndex(activePoint.year + 1, true);
        } else if (e.key === "Home") {
          e.preventDefault();
          onSelectIndex(0, true);
        } else if (e.key === "End") {
          e.preventDefault();
          onSelectIndex(years, true);
        }
      }}
      className="relative w-full rounded-2xl bg-surface/40 p-2 sm:p-3 border border-border/80 touch-none cursor-ew-resize select-none overflow-hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      data-swipe-nav-ignore
    >
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
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border/80 shadow-md text-xs font-mono whitespace-nowrap">
          <span className="font-bold text-foreground">
            {activePoint.year === 0 ? "Hoje" : `${activePoint.year}a`}
          </span>
          <span className="text-muted-foreground/60" aria-hidden="true">
            ·
          </span>
          <MoneyText cents={activePoint.balanceCents} hideCents tone="default" className="font-bold" />
          {isFireReached ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-positive-strong bg-positive/10 px-1.5 py-0.5 rounded-md">
              <Sparkles className="size-3" aria-hidden="true" />
              Meta
            </span>
          ) : null}
        </div>
      </div>

      <FireSvgCanvas
        years={years}
        geometry={geometry}
        activeCoord={activeCoord}
        fireTargetCents={fireTargetCents}
        isPointerActive={isPointerActive}
      />
    </div>
  );
}
