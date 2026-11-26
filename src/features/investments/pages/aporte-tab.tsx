import { lazy, Suspense, useMemo, useState } from "react";
import { Calculator, RotateCcw } from "lucide-react";
import {
  Alert,
  Button,
  ConfirmDialog,
  ContentLoading,
  EmptyState,
  ErrorState,
  SkeletonChart,
  SkeletonKpi,
} from "@/components/ui";
import { AporteCockpitCommandCard, AporteResult } from "@/components/modules";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL } from "@/services/masks";
import {
  useRevertPortfolioBatchAporte,
  LAST_BATCH_APORTE_STORAGE_KEY,
} from "@/state";
import { CvmDisclaimerBanner } from "../components/aporte/cvm-disclaimer-banner";
import { useAporteAllocator } from "../components/aporte/use-aporte-allocator";
import { buildCurrentAllocationSummaries } from "../components/aporte/current-allocation-mapper";
import { AssetScoreEvaluationDialog } from "../components/asset-score-evaluation-dialog";

const InvestmentWizard = lazy(() =>
  import("../wizard/investment-wizard").then((m) => ({ default: m.InvestmentWizard })),
);

/**
 * Calculadora de aporte (§F36) — simulação hierárquica unificada (Classe -> Setor -> Ativo).
 */
export function AporteTab({
  onGoToPosition,
  onGoToTargets,
}: {
  onGoToPosition?: () => void;
  onGoToTargets?: () => void;
}) {
  const allocator = useAporteAllocator(onGoToPosition);
  const { simulation } = allocator;
  const activeBatchCount = (allocator.pendingCustomItems ?? simulation.eligibleRoutes).length;
  const revertMutation = useRevertPortfolioBatchAporte();

  const fallbackSummaries = useMemo(
    () =>
      buildCurrentAllocationSummaries({
        positionRows: allocator.positionRows,
        rawClassTargets: allocator.rawClassTargets,
        rawSectorTargets: allocator.rawSectorTargets,
      }),
    [allocator.positionRows, allocator.rawClassTargets, allocator.rawSectorTargets],
  );

  const effectiveClassSummaries = simulation.result?.classSummaries ?? fallbackSummaries.classSummaries;
  const effectiveSectorSummaries = simulation.result?.sectorSummaries ?? fallbackSummaries.sectorSummaries;

  const [recentBatch, setRecentBatch] = useState<{
    batchId: string;
    executedAt: number;
    itemsCount: number;
    totalAmount: number;
  } | null>(() => {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    try {
      const raw = window.sessionStorage.getItem(LAST_BATCH_APORTE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Janela de 5 minutos (300.000 ms)
      if (Date.now() - parsed.executedAt < 5 * 60 * 1000) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const handleUndoRecentBatch = () => {
    if (!recentBatch) return;
    revertMutation.mutate(recentBatch.batchId, {
      onSuccess: () => {
        setRecentBatch(null);
      },
    });
  };

  return (
    <div className="flex flex-col gap-5 pb-28 sm:pb-8">
      {allocator.batchError ? <Alert variant="error">{allocator.batchError}</Alert> : null}

      {recentBatch ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-3.5 text-xs text-foreground animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium break-words">
              Aporte recente executado ({recentBatch.itemsCount}{" "}
              {recentBatch.itemsCount === 1 ? "ativo" : "ativos"} · R${" "}
              {recentBatch.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={revertMutation.isPending}
              onClick={handleUndoRecentBatch}
              className="gap-1.5 h-7 px-2.5 text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>{revertMutation.isPending ? "Desfazendo…" : "Desfazer Aporte"}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem(LAST_BATCH_APORTE_STORAGE_KEY);
                setRecentBatch(null);
              }}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Fechar
            </Button>
          </div>
        </div>
      ) : null}

      {allocator.loading ? (
        <div data-tour="investments-rebalance" className="flex flex-col gap-4">
          <SkeletonKpi />
          <SkeletonChart />
        </div>
      ) : allocator.error ? (
        <ErrorState
          message={getErrorMessage(allocator.error)}
          onRetry={allocator.refetchAll}
        />
      ) : simulation.nonCashRows.length === 0 ? (
        <EmptyState
          icon={<Calculator className="size-6" aria-hidden="true" />}
          title="Nenhum ativo investido para simular aporte"
          description="Cadastre ativos e defina suas metas na aba de Metas para que o motor distribua seu aporte de forma ideal."
          action={
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => (onGoToTargets ? onGoToTargets() : onGoToPosition?.())}
              >
                Definir Metas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGoToPosition?.()}
              >
                Ver Carteira
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="w-full">
            <AporteResult
              mode="both"
              aporte={simulation.result?.aporte ?? allocator.totalPurchasingCents / 100}
              totalAllocated={simulation.result?.totalAllocated ?? 0}
              leftover={simulation.result?.leftover ?? 0}
              routes={simulation.routes}
              classSummaries={effectiveClassSummaries}
              sectorSummaries={effectiveSectorSummaries}
              skippedAssets={simulation.result?.skippedAssets ?? []}
              onExecuteAporte={allocator.handleTriggerAporte}
              onOpenWizard={allocator.handleOpenWizardForAsset}
              onInspectAsset={allocator.handleOpenEvaluationForAsset}
              executing={allocator.isApplying}
              showDriftBars={true}
              overflowEvents={simulation.overflowEvents}
              pausedAssets={simulation.pausedAssets}
              diversificationImpact={simulation.diversificationImpact}
              controlSlot={
                <AporteCockpitCommandCard
                  aporteCents={allocator.aporteCents}
                  onAporteCentsChange={allocator.setAporteCents}
                  availableCashCents={allocator.availableCashCents}
                  useBrokerageCash={allocator.useBrokerageCash}
                  onToggleBrokerageCash={(checked) => {
                    allocator.setUseBrokerageCash(checked);
                    if (
                      checked &&
                      (allocator.cashUsedCents <= 0 || allocator.cashUsedCents > allocator.availableCashCents)
                    ) {
                      allocator.setCashUsedCents(allocator.availableCashCents);
                    }
                  }}
                  effectiveCashSelectedCents={allocator.effectiveCashSelectedCents}
                  onCashSelectedChange={(next) =>
                    allocator.setCashUsedCents(Math.min(Math.max(0, next), allocator.availableCashCents))
                  }
                  onUseOnlyCash={() => {
                    allocator.animateToCents(0);
                    allocator.setUseBrokerageCash(true);
                    allocator.setCashUsedCents(allocator.availableCashCents);
                  }}
                  strategy={allocator.strategy}
                  onStrategyChange={allocator.setStrategy}
                  ceilingSensitivity={allocator.ceilingSensitivity}
                  onCeilingSensitivityChange={allocator.setCeilingSensitivity}
                  cashHighlight={allocator.cashHighlight}
                  effectiveTotalAllocated={simulation.result?.totalAllocated ?? 0}
                  effectiveLeftover={simulation.result?.leftover ?? 0}
                  completedCount={0}
                  totalRoutesCount={simulation.routes.length}
                  diversificationImpact={simulation.diversificationImpact}
                  overflowEventsCount={simulation.overflowEvents?.length}
                  classSummaries={effectiveClassSummaries}
                  sectorSummaries={effectiveSectorSummaries}
                  skippedAssets={simulation.result?.skippedAssets ?? []}
                  pausedAssets={simulation.pausedAssets}
                  overflowEvents={simulation.overflowEvents}
                />
              }
            />
          </div>

          <CvmDisclaimerBanner />
        </>
      )}

      <ConfirmDialog
        open={allocator.confirmBatchOpen}
        onOpenChange={(open) => {
          allocator.setConfirmBatchOpen(open);
          if (!open) allocator.setPendingCustomItems(null);
        }}
        title="Aplicar aporte à carteira?"
        description={
          allocator.effectiveCashSelectedCents > 0
            ? `Essa ação atualizará ${activeBatchCount} ativos, debitando até ${formatCentsAsBRL(allocator.effectiveCashSelectedCents)} do saldo em Caixa e registrando apenas o dinheiro novo no histórico de aportes.`
            : `Essa ação atualizará a quantidade e o preço médio ponderado de ${activeBatchCount} ativos da sua carteira e registrará a contribuição deste mês.`
        }
        confirmLabel="Aplicar aporte"
        confirmPending={allocator.isApplying}
        onConfirm={() => void allocator.handleExecuteBatch()}
      />

      {allocator.wizardOpen ? (
        <Suspense fallback={<ContentLoading />}>
          <InvestmentWizard
            open={allocator.wizardOpen}
            onOpenChange={allocator.setWizardOpen}
            initialAsset={allocator.wizardAsset}
            initialQuantity={allocator.wizardQuantity}
            initialTotalCents={allocator.wizardTotalCents}
            onSuccess={allocator.refetchAll}
          />
        </Suspense>
      ) : null}

      <AssetScoreEvaluationDialog
        open={Boolean(allocator.evaluationAsset)}
        onOpenChange={(open) => {
          if (!open) allocator.setEvaluationAsset(null);
        }}
        asset={allocator.evaluationAsset}
      />

      {allocator.upgradeModal}
    </div>
  );
}
