import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, LineChart, Table } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";
import { formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface PortfolioSnapshotsCarouselProps {
  /** Série mensal de snapshots para exibição no carrossel. */
  series: PortfolioMonthlySeriesPoint[];
  /** Quantidade total de meses disponíveis no histórico completo. */
  totalMonthsCount?: number;
  /** Mês corrente (ex: "2026-09") para realce da competência ativa. */
  currentMonthStr?: string;
  /** Callback para abertura do diálogo de tabela analítica completa. */
  onOpenAnalyticsDialog?: () => void;
  className?: string;
}

/**
 * Carrossel horizontal de snapshots mensais da carteira.
 *
 * Exibe uma fita deslizante com os meses recentes ordenados do mais recente ao mais antigo,
 * com botões de rolagem suave para desktop e atalho para a auditoria completa em tabela.
 */
export function PortfolioSnapshotsCarousel({
  series,
  totalMonthsCount,
  currentMonthStr,
  onOpenAnalyticsDialog,
  className,
}: PortfolioSnapshotsCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Ordenação do mais recente ao mais antigo
  const orderedSeries = useMemo(() => {
    return [...series].sort((a, b) => b.month.localeCompare(a.month));
  }, [series]);

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
    const amount = direction === "left" ? -280 : 280;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (orderedSeries.length === 0) {
    return null;
  }

  const effectiveTotal = totalMonthsCount ?? series.length;

  return (
    <section
      aria-label="Evolução Patrimonial"
      className={cn(
        "rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden",
        className,
      )}
    >
      {/* Cabeçalho da Seção Adaptativo */}
      <div className="mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <LineChart className="size-4 text-portfolio shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground truncate">Evolução Histórica</h2>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ({orderedSeries.length} {orderedSeries.length === 1 ? "mês" : "meses"})
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Botões de rolagem horizontal para desktop */}
          <div className="hidden sm:flex items-center gap-0.5 border border-border/80 rounded-lg bg-surface p-0.5 shadow-2xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleScroll("left")}
              disabled={!canScrollLeft}
              className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Rolar carrossel para a esquerda"
              title="Rolar para a esquerda"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleScroll("right")}
              disabled={!canScrollRight}
              className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
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
              className="h-8 w-full sm:w-auto px-2.5 text-xs gap-1.5 cursor-pointer shrink-0 justify-center"
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

      {/* Fita Deslizante Horizontal (Snapshots) */}
      <div className="relative -mx-1 px-1">
        <div
          ref={scrollContainerRef}
          className="flex items-stretch gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2 pt-1"
        >
          {orderedSeries.map((point) => {
            const isCurrent = point.month === currentMonthStr;
            const effectiveGain =
              point.totalReturnPnl !== undefined
                ? point.totalReturnPnl
                : point.valueBRL - point.costBRL;
            const effectivePct =
              point.totalReturnPct !== undefined
                ? point.totalReturnPct
                : point.costBRL > 0
                  ? ((point.valueBRL - point.costBRL) / point.costBRL) * 100
                  : 0;
            const twrMonth = point.twrMonthPct;
            const twrAcc = point.twrAccumulatedPct;

            return (
              <div
                key={point.month}
                className={cn(
                  "min-w-[250px] max-w-[275px] sm:min-w-[260px] shrink-0 snap-start flex flex-col justify-between rounded-2xl border p-4 shadow-2xs transition-colors",
                  isCurrent
                    ? "border-portfolio/40 bg-portfolio/5 ring-1 ring-portfolio/20"
                    : "border-border/80 bg-surface/80 hover:border-border",
                )}
              >
                {/* Linha superior: Competência + Badge Atual + Rentabilidade no Mês */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {formatMonthYear(point.month)}
                    </span>
                    {isCurrent ? (
                      <Badge variant="portfolio" size="xs" className="shrink-0">
                        atual
                      </Badge>
                    ) : null}
                  </div>

                  {twrMonth !== null && twrMonth !== undefined ? (
                    <span
                      className={cn(
                        "font-mono text-[11px] font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded-pill",
                        twrMonth >= 0
                          ? "text-positive-strong bg-positive/10"
                          : "text-negative-strong bg-negative/10",
                      )}
                      title={`Variação da cota no mês: ${twrMonth >= 0 ? "+" : ""}${twrMonth.toFixed(2)}%`}
                    >
                      {twrMonth >= 0 ? "+" : ""}
                      {twrMonth.toFixed(1)}% m/m
                    </span>
                  ) : null}
                </div>

                {/* Patrimônio em Destaque */}
                <div className="min-w-0 my-2">
                  <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                    Patrimônio
                  </span>
                  <MoneyText
                    cents={numberToCents(point.valueBRL)}
                    tone="default"
                    className="text-lg sm:text-xl font-bold text-foreground tabular-nums whitespace-nowrap block"
                  />
                </div>

                {/* Grid Interno 2x2 com métricas do mês */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-muted-foreground truncate font-medium">
                      Custo
                    </span>
                    <MoneyText
                      cents={numberToCents(point.costBRL)}
                      tone="default"
                      className="text-xs text-muted-foreground tabular-nums font-medium whitespace-nowrap"
                    />
                  </div>

                  <div className="flex flex-col min-w-0 text-right">
                    <span className="text-[10px] text-muted-foreground truncate font-medium">
                      Proventos acum.
                    </span>
                    <MoneyText
                      cents={numberToCents(point.accumulatedDividendsBRL ?? 0)}
                      tone="positive"
                      className="text-xs tabular-nums font-medium whitespace-nowrap"
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-muted-foreground truncate font-medium">
                      Retorno Total
                    </span>
                    <span
                      className={cn(
                        "num font-semibold tabular-nums text-xs whitespace-nowrap",
                        effectiveGain >= 0 ? "text-positive-strong" : "text-negative-strong",
                      )}
                    >
                      {effectivePct !== null
                        ? `${effectivePct >= 0 ? "+" : ""}${effectivePct.toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0 text-right">
                    <span className="text-[10px] text-muted-foreground truncate font-medium">
                      TWR Acum.
                    </span>
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums text-xs whitespace-nowrap",
                        (twrAcc ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong",
                      )}
                    >
                      {twrAcc !== null && twrAcc !== undefined
                        ? `${twrAcc >= 0 ? "+" : ""}${twrAcc.toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Card Final de Ação Rápida (CTA) */}
          {onOpenAnalyticsDialog ? (
            <button
              type="button"
              onClick={onOpenAnalyticsDialog}
              className="min-w-[175px] shrink-0 snap-start flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-surface/40 p-4 text-center hover:border-portfolio hover:bg-portfolio/5 hover:text-portfolio transition-all group cursor-pointer"
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
                  {effectiveTotal > 0
                    ? `${effectiveTotal} meses arquivados`
                    : "Histórico detalhado"}
                </span>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-portfolio group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
