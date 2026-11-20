import { useMemo, useState } from "react";
import { Calculator, CheckCheck, ChevronDown, ChevronUp, FolderTree, ListOrdered, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AporteDesktopTable } from "./aporte-result/aporte-desktop-table";
import { AporteMobileCardList } from "./aporte-result/aporte-mobile-card-list";
import { AporteSkippedAssets } from "./aporte-result/aporte-skipped-assets";
import { AporteSummarySection } from "./aporte-result/aporte-summary-section";
import { useAporteSimulationOverrides } from "./aporte-result/use-aporte-simulation-overrides";
import { AporteTreeBreakdown } from "./aporte-result/aporte-tree-breakdown";
import { AporteOverflowLedgerDrawer } from "./aporte-result/aporte-overflow-ledger-drawer";
import { AllocationCard } from "./aporte-result/allocation-card";
import type {
  AporteResultProps,
  AporteRouteRow,
  CustomAporteExecutionItem,
} from "./aporte-result/aporte-result-types";

export type { AporteResultProps, AporteRouteRow, CustomAporteExecutionItem };

/**
 * Resultado da calculadora de aporte (§3.11.3) — módulo de domínio F4.
 * Arquitetura de 2 Andares (§Fase 4.5):
 * - Andar 1: Cockpit Superior Simétrico (Comando à esquerda + Alocação/Donut à direita);
 * - Andar 2: Execução em Largura Total (Tabela desktop 100%, Cards mobile e Árvore).
 */
export function AporteResult({
  aporte,
  totalAllocated: initialTotalAllocated,
  leftover: initialLeftover,
  routes,
  classSummaries = [],
  sectorSummaries = [],
  skippedAssets = [],
  onExecuteAporte,
  onOpenWizard,
  onInspectAsset,
  executing = false,
  overflowEvents,
  pausedAssets,
  controlSlot,
  diversificationImpact,
}: AporteResultProps) {
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [showPausedAccordion, setShowPausedAccordion] = useState(false);
  const [overflowLedgerOpen, setOverflowLedgerOpen] = useState(false);

  const {
    completedTickers,
    completedCount,
    quantityOverrides,
    quantityDrafts,
    priceOverrides,
    priceDrafts,
    effectiveRouteMap,
    effectiveTotalAllocated,
    effectiveLeftover,
    selectedExecutionItems,
    sortedRoutes,
    treeGroups,
    toggleAssetSelection,
    handleQuantityChange,
    handlePriceChange,
    handleResetAsset,
    toggleTicker,
  } = useAporteSimulationOverrides({
    aporte,
    initialTotalAllocated,
    initialLeftover,
    routes,
    classSummaries,
    sectorSummaries,
  });

  const activeRoutes = useMemo(
    () =>
      sortedRoutes.filter((r) => {
        const eff = effectiveRouteMap.get(r.assetId);
        const qty = eff?.effectiveQuantity ?? r.quantity;
        return qty > 0;
      }),
    [sortedRoutes, effectiveRouteMap],
  );

  const pausedRoutes = useMemo(
    () =>
      sortedRoutes.filter((r) => {
        const eff = effectiveRouteMap.get(r.assetId);
        const qty = eff?.effectiveQuantity ?? r.quantity;
        return qty <= 0;
      }),
    [sortedRoutes, effectiveRouteMap],
  );

  const totalCurrentBRL = useMemo(
    () => classSummaries.reduce((sum, cs) => sum + cs.currentValueBRL, 0),
    [classSummaries],
  );

  // Prepara itens de classe para o Donut
  const donutClassItems = useMemo(
    () =>
      classSummaries.map((cs) => ({
        id: cs.className,
        name: cs.className,
        currentValueBRL: cs.currentValueBRL,
        allocatedBRL: cs.actualAllocatedBRL,
        targetPct: cs.targetPct,
      })),
    [classSummaries],
  );

  // Prepara itens de setor para as Drift Bars
  const driftSectorItems = useMemo(
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

  const summaryBlock = (
    <AporteSummarySection
      aporte={aporte}
      effectiveTotalAllocated={effectiveTotalAllocated}
      effectiveLeftover={effectiveLeftover}
      completedCount={completedCount}
      totalRoutesCount={routes.length}
      classSummaries={classSummaries}
      sectorSummaries={sectorSummaries}
      showDriftBars={false}
      overflowEventsCount={overflowEvents?.length}
      onOpenOverflowLedger={() => setOverflowLedgerOpen(true)}
      diversificationImpact={diversificationImpact}
    />
  );

  const hasAportePlan = aporte > 0 || routes.length > 0;

  // Andar 2: Bloco de Execução em 100% da Largura
  const executionBlock = (
    <div key="execution-block" className="flex flex-col gap-4 min-w-0 w-full animate-fade-in">
      {!hasAportePlan ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/60 p-6 sm:p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-xl bg-surface-raised border border-border/60 text-muted-foreground">
            <Calculator className="size-4.5" aria-hidden="true" />
          </div>
          <span className="font-semibold text-foreground text-sm">Pronto para simular</span>
          <span className="max-w-md">Informe um valor de aporte ou utilize o saldo em Caixa para gerar o plano de compras recomendado.</span>
        </div>
      ) : routes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface p-6 sm:p-8 text-center text-xs text-muted-foreground shadow-xs">
          Nenhum ativo elegível no momento: defina metas abaixo da posição atual (gap positivo) com cotação disponível.
        </div>
      ) : (
        <>
          {/* Cabeçalho do Andar 2: Título, Alternador de Modo e CTA de Lançamento */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Detalhamento dos aportes
              </h3>
              <SegmentedControl
                value={viewMode}
                onChange={setViewMode}
                options={[
                  {
                    value: "list",
                    label: "Prioridade",
                    icon: <ListOrdered aria-hidden="true" />,
                    title: "Visualização em lista por prioridade",
                  },
                  {
                    value: "tree",
                    label: "Árvore",
                    icon: <FolderTree aria-hidden="true" />,
                    title: "Visualização hierárquica (Classe, Setor e Ativos)",
                  },
                ]}
                ariaLabel="Modo de visualização dos aportes"
              />
            </div>

            {onExecuteAporte && (routes.some((r) => r.quantity > 0) || selectedExecutionItems.length > 0) ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => onExecuteAporte(selectedExecutionItems)}
                disabled={executing || selectedExecutionItems.length === 0}
                className="gap-1.5 shrink-0 h-8 px-3 text-xs font-semibold cursor-pointer hidden sm:inline-flex"
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
              {activeRoutes.length > 0 ? (
                <>
                  <AporteDesktopTable
                    routes={activeRoutes}
                    effectiveRouteMap={effectiveRouteMap}
                    quantityOverrides={quantityOverrides}
                    quantityDrafts={quantityDrafts}
                    priceOverrides={priceOverrides}
                    priceDrafts={priceDrafts}
                    completedTickers={completedTickers}
                    onToggleAssetSelection={toggleAssetSelection}
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    onResetAsset={handleResetAsset}
                    onToggleTicker={toggleTicker}
                    onOpenWizard={onOpenWizard}
                    onInspectAsset={onInspectAsset}
                  />
                  <AporteMobileCardList
                    routes={activeRoutes}
                    effectiveRouteMap={effectiveRouteMap}
                    quantityOverrides={quantityOverrides}
                    quantityDrafts={quantityDrafts}
                    priceOverrides={priceOverrides}
                    priceDrafts={priceDrafts}
                    completedTickers={completedTickers}
                    onToggleAssetSelection={toggleAssetSelection}
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    onResetAsset={handleResetAsset}
                    onToggleTicker={toggleTicker}
                    onOpenWizard={onOpenWizard}
                    onInspectAsset={onInspectAsset}
                  />
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 bg-surface p-6 text-center text-xs text-muted-foreground shadow-xs">
                  Todos os ativos elegíveis atingiram os tetos prudenciais da política ou estão pausados.
                </div>
              )}

              {/* Acordeão Único de Ativos Pausados / No Teto */}
              {pausedRoutes.length > 0 ? (
                <div className="flex flex-col rounded-xl border border-border/80 bg-surface shadow-xs p-3.5 transition-all">
                  <button
                    type="button"
                    onClick={() => setShowPausedAccordion((prev) => !prev)}
                    className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full text-left"
                    aria-expanded={showPausedAccordion}
                  >
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="size-3.5 text-warning-strong shrink-0" aria-hidden="true" />
                      <span>
                        {pausedRoutes.length === 1
                          ? "1 ativo pausado por qualidade ou teto atingido"
                          : `${pausedRoutes.length} ativos pausados por qualidade ou teto atingido`}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-normal">
                      <span>{showPausedAccordion ? "Ocultar" : "Ver detalhes"}</span>
                      {showPausedAccordion ? (
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  {showPausedAccordion ? (
                    <div className="mt-3.5 flex flex-col gap-3 pt-3 border-t border-border/60 animate-fade-in">
                      <AporteDesktopTable
                        routes={pausedRoutes}
                        effectiveRouteMap={effectiveRouteMap}
                        quantityOverrides={quantityOverrides}
                        quantityDrafts={quantityDrafts}
                        priceOverrides={priceOverrides}
                        priceDrafts={priceDrafts}
                        completedTickers={completedTickers}
                        onToggleAssetSelection={toggleAssetSelection}
                        onQuantityChange={handleQuantityChange}
                        onPriceChange={handlePriceChange}
                        onResetAsset={handleResetAsset}
                        onToggleTicker={toggleTicker}
                        onOpenWizard={onOpenWizard}
                        onInspectAsset={onInspectAsset}
                      />
                      <AporteMobileCardList
                        routes={pausedRoutes}
                        effectiveRouteMap={effectiveRouteMap}
                        quantityOverrides={quantityOverrides}
                        quantityDrafts={quantityDrafts}
                        priceOverrides={priceOverrides}
                        priceDrafts={priceDrafts}
                        completedTickers={completedTickers}
                        onToggleAssetSelection={toggleAssetSelection}
                        onQuantityChange={handleQuantityChange}
                        onPriceChange={handlePriceChange}
                        onResetAsset={handleResetAsset}
                        onToggleTicker={toggleTicker}
                        onOpenWizard={onOpenWizard}
                        onInspectAsset={onInspectAsset}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <AporteTreeBreakdown
              treeGroups={treeGroups}
              effectiveRouteMap={effectiveRouteMap}
              completedTickers={completedTickers}
              onToggleTicker={toggleTicker}
              onOpenWizard={onOpenWizard}
              onInspectAsset={onInspectAsset}
            />
          )}

          <AporteSkippedAssets skippedAssets={skippedAssets} />
        </>
      )}
    </div>
  );

  return (
    <section
      aria-label="Resultado da simulação de aporte"
      data-tour="aporte-result-section"
      className="flex flex-col gap-5 min-w-0 w-full"
    >
      {/* ANDAR 1 — Cockpit Superior Simétrico (grid 12 colunas, items-stretch) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch w-full">
        {/* Coluna Esquerda: Comando & Síntese */}
        <div className="lg:col-span-5 flex flex-col justify-between h-full min-w-0">
          {controlSlot ?? summaryBlock}
        </div>

        {/* Coluna Direita: Alocação com Donut Concêntrico & Drift Bars */}
        <div className="lg:col-span-7 flex flex-col justify-between h-full min-w-0">
          <AllocationCard
            classItems={donutClassItems}
            sectorItems={driftSectorItems}
            totalCurrentBRL={totalCurrentBRL}
            totalAllocatedBRL={effectiveTotalAllocated}
            diversificationImpact={diversificationImpact}
          />
        </div>
      </div>

      {/* ANDAR 2 — Execução em Largura Total (100% da tela) */}
      <div className="w-full mt-1">{executionBlock}</div>

      <AporteOverflowLedgerDrawer
        open={overflowLedgerOpen}
        onOpenChange={setOverflowLedgerOpen}
        overflowEvents={overflowEvents}
        pausedAssets={pausedAssets}
        totalAllocatedBRL={effectiveTotalAllocated}
        leftoverBRL={effectiveLeftover}
      />

      {/* Barra Fixa Inferior de Execução no Mobile (§Fase 4) */}
      {onExecuteAporte && (routes.some((r) => r.quantity > 0) || selectedExecutionItems.length > 0) ? (
        <div className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-md border-t border-border/80 px-4 py-3 sm:hidden z-30 pb-[max(0.75rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] shadow-lg flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground truncate">
              {selectedExecutionItems.length} {selectedExecutionItems.length === 1 ? "ativo" : "ativos"} selecionados
            </span>
            <span className="font-mono text-sm font-bold text-portfolio tabular-nums">
              R${" "}
              {selectedExecutionItems
                .reduce((sum, item) => sum + item.allocatedBRL, 0)
                .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => onExecuteAporte(selectedExecutionItems)}
            disabled={executing || selectedExecutionItems.length === 0}
            className="gap-1.5 shrink-0 h-9 px-3.5 text-xs font-semibold cursor-pointer"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            <span>{executing ? "Lançando…" : "Lançar Compras"}</span>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
