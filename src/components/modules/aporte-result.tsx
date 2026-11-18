import { useState } from "react";
import { CheckCheck, FolderTree, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { AporteDesktopTable } from "./aporte-result/aporte-desktop-table";
import { AporteMobileCardList } from "./aporte-result/aporte-mobile-card-list";
import { AporteSkippedAssets } from "./aporte-result/aporte-skipped-assets";
import { AporteSummarySection } from "./aporte-result/aporte-summary-section";
import { useAporteSimulationOverrides } from "./aporte-result/use-aporte-simulation-overrides";
import { AporteTreeBreakdown } from "./aporte-result/aporte-tree-breakdown";
import type {
  AporteResultProps,
  AporteRouteRow,
  CustomAporteExecutionItem,
} from "./aporte-result/aporte-result-types";

export type { AporteResultProps, AporteRouteRow, CustomAporteExecutionItem };

const MODE_LABEL: Record<AporteResultProps["mode"], string> = {
  asset: "por meta individual",
  class: "por estabilização de classe",
  both: "hierárquico (ativo, setor e classe)",
};

/**
 * Resultado da calculadora de aporte (§3.11.3) — módulo de domínio F4.
 * Visão hierárquica em três níveis: Macro por Classe, Meso por Setor e Micro por Ativo.
 */
export function AporteResult({
  mode,
  aporte,
  totalAllocated: initialTotalAllocated,
  leftover: initialLeftover,
  routes,
  classSummaries = [],
  sectorSummaries = [],
  skippedAssets = [],
  onExecuteAporte,
  onOpenWizard,
  executing = false,
}: AporteResultProps) {
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");

  const {
    completedTickers,
    completedCount,
    quantityOverrides,
    quantityDrafts,
    effectiveRouteMap,
    effectiveTotalAllocated,
    effectiveLeftover,
    selectedExecutionItems,
    sortedRoutes,
    treeGroups,
    toggleAssetSelection,
    handleQuantityChange,
    toggleTicker,
  } = useAporteSimulationOverrides({
    aporte,
    initialTotalAllocated,
    initialLeftover,
    routes,
    classSummaries,
    sectorSummaries,
  });

  const handleViewChange = (next: "list" | "tree") => {
    if (viewMode === next) return;
    triggerSensory("selection");
    setViewMode(next);
  };

  return (
    <section
      aria-label="Resultado da simulação de aporte"
      data-tour="aporte-result-section"
      className="flex flex-col gap-4 min-w-0"
    >
      <AporteSummarySection
        aporte={aporte}
        effectiveTotalAllocated={effectiveTotalAllocated}
        effectiveLeftover={effectiveLeftover}
        completedCount={completedCount}
        totalRoutesCount={routes.length}
        classSummaries={classSummaries}
        sectorSummaries={sectorSummaries}
      />

      <p className="text-xs text-muted-foreground">
        Roteamento <span className="font-medium text-foreground">{MODE_LABEL[mode]}</span>: estabilização macro das classes,
        distribuição meso por setores e alocação nos ativos com maior gap.
      </p>

      {routes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum ativo elegível: defina metas abaixo da posição atual (gap positivo) com preço disponível.
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Detalhamento dos aportes
              </h3>
              <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleViewChange("list")}
                  className={cn(
                    "relative flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-y-1.5 max-sm:after:inset-x-0",
                    viewMode === "list" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Visualização em lista por prioridade"
                >
                  <ListOrdered className="size-3.5" aria-hidden="true" />
                  <span>Prioridade</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleViewChange("tree")}
                  className={cn(
                    "relative flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-y-1.5 max-sm:after:inset-x-0",
                    viewMode === "tree" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Visualização hierárquica (Classe, Setor e Ativos)"
                >
                  <FolderTree className="size-3.5" aria-hidden="true" />
                  <span>Árvore</span>
                </button>
              </div>
            </div>

            {onExecuteAporte && (routes.some((r) => r.quantity > 0) || selectedExecutionItems.length > 0) ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onExecuteAporte(selectedExecutionItems)}
                disabled={executing || selectedExecutionItems.length === 0}
                className="gap-1.5 shrink-0"
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                <span>
                  {executing
                    ? "Lançando…"
                    : selectedExecutionItems.length > 0
                      ? `Lançar compras no extrato (${selectedExecutionItems.length})`
                      : "Nenhum ativo selecionado"}
                </span>
              </Button>
            ) : null}
          </div>

          {viewMode === "list" ? (
            <>
              <AporteDesktopTable
                routes={sortedRoutes}
                effectiveRouteMap={effectiveRouteMap}
                quantityOverrides={quantityOverrides}
                quantityDrafts={quantityDrafts}
                completedTickers={completedTickers}
                onToggleAssetSelection={toggleAssetSelection}
                onQuantityChange={handleQuantityChange}
                onToggleTicker={toggleTicker}
                onOpenWizard={onOpenWizard}
              />
              <AporteMobileCardList
                routes={sortedRoutes}
                effectiveRouteMap={effectiveRouteMap}
                quantityOverrides={quantityOverrides}
                quantityDrafts={quantityDrafts}
                completedTickers={completedTickers}
                onToggleAssetSelection={toggleAssetSelection}
                onQuantityChange={handleQuantityChange}
                onToggleTicker={toggleTicker}
                onOpenWizard={onOpenWizard}
              />
            </>
          ) : (
            <AporteTreeBreakdown
              treeGroups={treeGroups}
              effectiveRouteMap={effectiveRouteMap}
              completedTickers={completedTickers}
              onToggleTicker={toggleTicker}
              onOpenWizard={onOpenWizard}
            />
          )}
        </>
      )}

      <AporteSkippedAssets skippedAssets={skippedAssets} />
    </section>
  );
}
