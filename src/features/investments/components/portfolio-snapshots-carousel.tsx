import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, LineChart, Table } from "lucide-react";
import { Button } from "@/components/ui";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";
import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { SnapshotMonthCard } from "./snapshots-carousel/snapshot-month-card";

export interface PortfolioSnapshotsCarouselProps {
  /** Série mensal de snapshots para exibição no carrossel. */
  series: PortfolioMonthlySeriesPoint[];
  /** Quantidade total de meses disponíveis no histórico completo. */
  totalMonthsCount?: number;
  /** Mês corrente (ex: "2026-09") para realce da competência ativa. */
  currentMonthStr?: string;
  /** Callback para abertura do diálogo de tabela analítica completa. */
  onOpenAnalyticsDialog?: () => void;
  /** Callback para emissão direta do relatório executivo referente à competência do card. */
  onGenerateReport?: (month: string) => void;
  className?: string;
}

/**
 * Carrossel horizontal de snapshots mensais da carteira.
 */
export function PortfolioSnapshotsCarousel({
  series,
  totalMonthsCount,
  currentMonthStr,
  onOpenAnalyticsDialog,
  onGenerateReport,
  className,
}: PortfolioSnapshotsCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const orderedSeries = useMemo(
    () => [...series].sort((a, b) => b.month.localeCompare(a.month)),
    [series],
  );

  const updateScrollBounds = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollBounds();
    el.addEventListener("scroll", updateScrollBounds, { passive: true });
    window.addEventListener("resize", updateScrollBounds);
    return () => {
      el.removeEventListener("scroll", updateScrollBounds);
      window.removeEventListener("resize", updateScrollBounds);
    };
  }, [updateScrollBounds, orderedSeries]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const visualReduced = getVisualCustomization().motionLevel === "reduced";
    const amount = direction === "left" ? -280 : 280;
    el.scrollBy({
      left: amount,
      behavior: prefersReducedMotion || visualReduced ? "auto" : "smooth",
    });
  };

  if (orderedSeries.length === 0) {
    return null;
  }

  const effectiveTotal = totalMonthsCount ?? series.length;

  return (
    <section
      aria-label="Evolução Patrimonial"
      className={cn(
        "rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden",
        className,
      )}
    >
      <div className="mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <LineChart className="size-4 text-portfolio shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground line-clamp-2 break-words">
            Evolução Histórica
          </h2>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            ({orderedSeries.length} {orderedSeries.length === 1 ? "mês" : "meses"})
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <div className="hidden sm:flex items-center gap-0.5 border border-border/80 rounded-lg bg-surface p-0.5 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={() => handleScroll("left")}
              disabled={!canScrollLeft}
              className="size-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Rolar carrossel para a esquerda"
              title="Rolar para a esquerda"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={() => handleScroll("right")}
              disabled={!canScrollRight}
              className="size-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Rolar carrossel para a direita"
              title="Rolar para a direita"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>

          {onOpenAnalyticsDialog ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenAnalyticsDialog}
              className="w-full sm:w-auto px-2.5 text-xs gap-1.5 shrink-0 justify-center"
              aria-label="Ver extrato analítico completo"
            >
              <Table className="size-3.5" aria-hidden="true" />
              <span>Tabela Analítica</span>
              {effectiveTotal > 0 ? (
                <span className="text-[11px] text-muted-foreground font-mono">
                  ({effectiveTotal}m)
                </span>
              ) : null}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative -mx-1 px-1">
        <div
          ref={scrollContainerRef}
          className="flex items-stretch gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2 pt-1"
        >
          {orderedSeries.map((point) => (
            <SnapshotMonthCard
              key={point.month}
              point={point}
              isCurrent={point.month === currentMonthStr}
              onGenerateReport={onGenerateReport}
            />
          ))}

          {onOpenAnalyticsDialog ? (
            <button
              type="button"
              onClick={() => {
                triggerSensory("action");
                onOpenAnalyticsDialog();
              }}
              className="min-w-[175px] min-h-11 shrink-0 snap-start flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-surface p-4 text-center hover:border-portfolio hover:bg-portfolio/5 hover:text-portfolio focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors group cursor-pointer"
              aria-label="Abrir tabela analítica completa de snapshots"
            >
              <div className="size-8 rounded-full bg-surface-hover flex items-center justify-center group-hover:bg-portfolio/15 transition-colors">
                <Table className="size-4 text-muted-foreground group-hover:text-portfolio" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-portfolio">
                  Ver Tabela Completa
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {effectiveTotal > 0 ? `${effectiveTotal} meses arquivados` : "Histórico detalhado"}
                </span>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-portfolio group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
