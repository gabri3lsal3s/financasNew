import { Calculator } from "lucide-react";
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonChart,
  SkeletonKpi,
} from "@/components/ui";
import { AporteResult } from "@/components/modules";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL } from "@/services/masks";
import { AporteInputCard } from "../components/aporte/aporte-input-card";
import { CvmDisclaimerBanner } from "../components/aporte/cvm-disclaimer-banner";
import { useAporteAllocator } from "../components/aporte/use-aporte-allocator";
import { InvestmentWizard } from "../wizard";

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

  return (
    <div className="flex flex-col gap-5">
      {allocator.batchError ? <Alert variant="error">{allocator.batchError}</Alert> : null}

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
          icon={<Calculator className="size-6" />}
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
          <AporteInputCard
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
            totalPurchasingCents={allocator.totalPurchasingCents}
            cashHighlight={allocator.cashHighlight}
          />

          {simulation.result ? (
            <div className="animate-fade-in">
              <AporteResult
                mode="both"
                aporte={simulation.result.aporte}
                totalAllocated={simulation.result.totalAllocated}
                leftover={simulation.result.leftover}
                routes={simulation.routes}
                classSummaries={simulation.result.classSummaries}
                sectorSummaries={simulation.result.sectorSummaries}
                skippedAssets={simulation.result.skippedAssets}
                onExecuteAporte={allocator.handleTriggerAporte}
                onOpenWizard={allocator.handleOpenWizardForAsset}
                executing={allocator.isApplying}
              />
            </div>
          ) : null}

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

      <InvestmentWizard
        open={allocator.wizardOpen}
        onOpenChange={allocator.setWizardOpen}
        initialAsset={allocator.wizardAsset}
        initialQuantity={allocator.wizardQuantity}
        initialTotalCents={allocator.wizardTotalCents}
        onSuccess={allocator.refetchAll}
      />

      {allocator.upgradeModal}
    </div>
  );
}
