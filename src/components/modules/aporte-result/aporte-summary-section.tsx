import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ClassAporteSummary, DiversificationImpactSummary, SectorAporteSummary } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedPct } from "@/services/masks";
import { HorizontalAllocationDriftBars, type DriftBarItem } from "./allocation-drift-bars";

const nefFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export interface AporteSummarySectionProps {
  aporte: number;
  effectiveTotalAllocated: number;
  effectiveLeftover: number;
  completedCount: number;
  totalRoutesCount: number;
  classSummaries: ClassAporteSummary[];
  sectorSummaries: SectorAporteSummary[];
  showDriftBars?: boolean;
  overflowEventsCount?: number;
  onOpenOverflowLedger?: () => void;
  diversificationImpact?: DiversificationImpactSummary | null;
}

/**
 * Faixa Métrica Densa & Resumo de Rebalanceamento (§Fase 2).
 * Exibe Total · Alocado · Sobra em 1 linha compacta com chips de impacto (Nef e Diluição)
 * e barras horizontais de drift antes vs pós-aporte.
 */
export function AporteSummarySection({
  aporte,
  effectiveTotalAllocated,
  effectiveLeftover,
  completedCount,
  totalRoutesCount,
  classSummaries,
  sectorSummaries,
  showDriftBars = false,
  overflowEventsCount,
  onOpenOverflowLedger,
  diversificationImpact,
}: AporteSummarySectionProps) {
  const totalCurrentBRL = useMemo(
    () => classSummaries.reduce((sum, cs) => sum + cs.currentValueBRL, 0),
    [classSummaries],
  );

  const classDriftItems = useMemo<DriftBarItem[]>(
    () =>
      classSummaries.map((cs) => ({
        id: cs.className,
        name: cs.className,
        currentValueBRL: cs.currentValueBRL,
        allocatedBRL: cs.actualAllocatedBRL,
        targetPct: cs.targetPct,
        ceilingPct: cs.targetPct > 0 ? Math.min(100, cs.targetPct * 1.5) : undefined,
      })),
    [classSummaries],
  );

  const sectorDriftItems = useMemo<DriftBarItem[]>(
    () =>
      sectorSummaries.map((ss) => ({
        id: `${ss.className}::${ss.sectorName}`,
        name: ss.sectorName,
        className: ss.className,
        currentValueBRL: ss.currentValueBRL,
        allocatedBRL: ss.actualAllocatedBRL,
        targetPct: ss.targetPctInClass,
      })),
    [sectorSummaries],
  );

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Faixa Métrica Densa de 1 Linha */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60 text-center">
          <div className="flex flex-col px-2 py-1.5 sm:py-0 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground truncate" title="Aporte informado">
              Aporte informado
            </span>
            <MoneyText
              cents={numberToCents(aporte)}
              variant="value"
              className="font-bold text-foreground text-xs sm:text-sm tabular-nums"
            />
          </div>
          <div className="flex flex-col px-2 py-1.5 sm:py-0 min-w-0">
            <span
              className="text-[11px] font-medium text-muted-foreground truncate"
              title={completedCount > 0 ? `Alocado (${completedCount}/${totalRoutesCount} feitos)` : "Alocado em ativos"}
            >
              {completedCount > 0 ? `Alocado (${completedCount}/${totalRoutesCount} feitos)` : "Alocado em ativos"}
            </span>
            <MoneyText
              cents={numberToCents(effectiveTotalAllocated)}
              tone="portfolio"
              variant="value"
              className="font-bold text-xs sm:text-sm tabular-nums"
            />
          </div>
          <div className="flex flex-col px-2 py-1.5 sm:py-0 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground truncate" title="Sobra para caixa">
              Sobra para caixa
            </span>
            <MoneyText
              cents={numberToCents(effectiveLeftover)}
              variant="value"
              className="font-bold text-foreground text-xs sm:text-sm tabular-nums"
            />
          </div>
        </div>

        {/* Chips de Impacto na Descentralização e Diluição */}
        {diversificationImpact ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-border/50 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              {diversificationImpact.currentNef !== null && diversificationImpact.projectedNef !== null ? (
                <div className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-muted-foreground">
                  <span>Nef:</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {nefFormatter.format(diversificationImpact.currentNef)} → {nefFormatter.format(diversificationImpact.projectedNef)}
                  </span>
                  {diversificationImpact.deltaNefPct !== null && diversificationImpact.deltaNefPct !== 0 ? (
                    <span
                      className={cn(
                        "font-medium",
                        diversificationImpact.deltaNefPct > 0 ? "text-positive-strong" : "text-muted-foreground",
                      )}
                    >
                      ({formatSignedPct(diversificationImpact.deltaNefPct)})
                    </span>
                  ) : null}
                </div>
              ) : null}

              {diversificationImpact.projectedTopAssetSharePct !== null ? (
                <div className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-muted-foreground">
                  <span>Maior Ativo:</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatPercent(diversificationImpact.projectedTopAssetSharePct)}%
                  </span>
                  {diversificationImpact.currentTopAssetSharePct !== null &&
                  diversificationImpact.currentTopAssetSharePct > diversificationImpact.projectedTopAssetSharePct ? (
                    <span className="text-positive-strong font-medium">
                      ({formatSignedPct(
                        diversificationImpact.projectedTopAssetSharePct -
                        diversificationImpact.currentTopAssetSharePct,
                      )})
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {onOpenOverflowLedger ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenOverflowLedger}
                className="text-muted-foreground hover:text-foreground text-[11px] gap-1 h-6 px-1.5 cursor-pointer ml-auto"
              >
                <Sparkles className="size-3 text-primary" aria-hidden="true" />
                <span>Overflow Ledger</span>
                {overflowEventsCount !== undefined && overflowEventsCount > 0 ? (
                  <Badge variant="warning" size="xs">
                    {overflowEventsCount}
                  </Badge>
                ) : null}
              </Button>
            ) : null}
          </div>
        ) : onOpenOverflowLedger ? (
          <div className="flex items-center justify-end pt-1 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenOverflowLedger}
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5 h-6 px-2 cursor-pointer"
            >
              <Sparkles className="size-3 text-primary" aria-hidden="true" />
              <span>Trilha de Decisão (Overflow Ledger)</span>
              {overflowEventsCount !== undefined && overflowEventsCount > 0 ? (
                <Badge variant="warning" size="xs">
                  {overflowEventsCount}
                </Badge>
              ) : null}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Gráfico de Drift Antes vs Pós-Aporte */}
      {showDriftBars && classDriftItems.length > 0 ? (
        <HorizontalAllocationDriftBars
          classItems={classDriftItems}
          sectorItems={sectorDriftItems}
          totalCurrentBRL={totalCurrentBRL}
          totalAllocatedBRL={effectiveTotalAllocated}
        />
      ) : null}
    </div>
  );
}
