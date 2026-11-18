import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, ConfirmDialog, Modal, ModalFooter } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { useDeletePortfolioAsset, useDeletePortfolioTransaction } from "@/state";
import type { PortfolioAsset, PortfolioTransaction, PortfolioTransactionType } from "@/types";
import { AssetAllocationCard } from "./asset-detail/asset-allocation-card";
import { AssetGovernanceCard } from "./asset-detail/asset-governance-card";
import { AssetHeroSummary } from "./asset-detail/asset-hero-summary";
import { AssetPositionMetricsGrid } from "./asset-detail/asset-position-metrics-grid";
import { AssetTransactionsTimeline } from "./asset-detail/asset-transactions-timeline";
import { AssetUsdCustodyCard } from "./asset-detail/asset-usd-custody-card";
import { useAssetDetailMetrics } from "./asset-detail/use-asset-detail-metrics";
import { AssetEditDialog } from "./asset-edit-dialog";
import { AssetScoreEvaluationDialog } from "./asset-score-evaluation-dialog";
import { CalibrateFixedIncomeDialog } from "./calibrate-fixed-income-dialog";
import { QuickTransactionSheet } from "./quick-transaction-sheet";

export interface AssetDetailSheetProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (action: "buy" | "sell" | "dividend" | "split", asset: PortfolioAsset) => void;
  onOpenWizard?: (asset: PortfolioAsset, initialQuantity?: number, initialTotalCents?: number) => void;
}

export function AssetDetailSheet({
  asset,
  open,
  onOpenChange,
  onAction,
  onOpenWizard,
}: AssetDetailSheetProps) {
  const { guardAction, upgradeModal } = useMutationGuard();
  const deleteAsset = useDeletePortfolioAsset();
  const deleteTx = useDeletePortfolioTransaction();
  const metrics = useAssetDetailMetrics(asset);

  const [editOpen, setEditOpen] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<PortfolioTransaction | null>(null);
  const [txToEdit, setTxToEdit] = useState<PortfolioTransaction | null>(null);
  const [quickTxType, setQuickTxType] = useState<PortfolioTransactionType | null>(null);
  const [evaluationOpen, setEvaluationOpen] = useState(false);

  if (!asset || !metrics) return null;

  const { currentAsset, resolvedSector, currentValue, suggestedQtyToAbsorb, suggestedTotalCents, txs, txLoading, isTotalValue } = metrics;

  const openInternalQuickTx = (txType: PortfolioTransactionType) => {
    setTxToEdit(null);
    setQuickTxType(txType);
  };

  const handleQuickAction = (action: "buy" | "sell" | "dividend", label: string) => {
    guardAction(() => (onAction ? onAction(action, currentAsset) : openInternalQuickTx(action)), label);
  };

  const handleAporteClick = () => {
    guardAction(() => {
      if (onOpenWizard) onOpenWizard(currentAsset, suggestedQtyToAbsorb, suggestedTotalCents);
      else if (onAction) onAction("buy", currentAsset);
      else openInternalQuickTx("buy");
    }, "Registrar Aporte");
  };

  const description = resolvedSector
    ? `${currentAsset.asset_class ?? "Ativo"} · ${resolvedSector}`
    : (currentAsset.asset_class ?? "Ativo em Carteira");

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={currentAsset.ticker}
        description={description}
        size="2xl"
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => guardAction(() => setDeleteConfirmOpen(true), "Excluir Ativo da Carteira")}
                className="text-critical-strong hover:bg-critical/10"
              >
                <Trash2 className="size-3.5 mr-1" aria-hidden="true" />
                Excluir Ativo da Carteira
              </Button>
            }
          >
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </ModalFooter>
        }
      >
        <div className="flex flex-col gap-5 pt-1">
          <AssetHeroSummary
            metrics={metrics}
            onQuickAction={handleQuickAction}
            onOpenSplit={() => guardAction(() => openInternalQuickTx("split"), "Desdobrar / Agrupar Cotas")}
            onOpenCalibrate={() => guardAction(() => setCalibrateOpen(true), "Calibrar Renda Fixa")}
            onOpenEdit={() => guardAction(() => setEditOpen(true), "Editar Ativo")}
          />

          <AssetPositionMetricsGrid metrics={metrics} />
          <AssetAllocationCard metrics={metrics} onAporteClick={handleAporteClick} />
          <AssetGovernanceCard metrics={metrics} onOpenEvaluation={() => setEvaluationOpen(true)} />
          <AssetUsdCustodyCard metrics={metrics} />

          <AssetTransactionsTimeline
            asset={currentAsset}
            transactions={txs}
            isLoading={txLoading}
            isTotalValue={isTotalValue}
            onCreateTx={() => guardAction(() => openInternalQuickTx("buy"), "Registrar Operação")}
            onEditTx={(tx) => guardAction(() => setTxToEdit(tx), "Editar Operação de Investimento")}
            onDeleteTx={(tx) => guardAction(() => setTxToDelete(tx), "Excluir Operação de Investimento")}
          />
        </div>
      </Modal>

      <AssetEditDialog asset={currentAsset} open={editOpen} onOpenChange={setEditOpen} />
      <CalibrateFixedIncomeDialog asset={currentAsset} open={calibrateOpen} onOpenChange={setCalibrateOpen} currentEstimatedValueCents={numberToCents(currentValue)} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        elevated
        title={`Excluir ${currentAsset.ticker}?`}
        description="Esta ação removerá o ativo da sua carteira, incluindo todas as transações vinculadas. Essa operação não pode ser desfeita."
        confirmLabel="Sim, excluir ativo"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={async () => {
          await deleteAsset.mutateAsync(currentAsset.id);
          setDeleteConfirmOpen(false);
          onOpenChange(false);
        }}
      />

      <ConfirmDialog
        open={txToDelete !== null}
        onOpenChange={(next) => !next && setTxToDelete(null)}
        elevated
        title="Excluir movimentação?"
        description="Esta operação será removida do histórico do ativo e a posição recalculada atomicamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteTx.isPending}
        onConfirm={async () => {
          if (txToDelete) {
            await deleteTx.mutateAsync(txToDelete);
            setTxToDelete(null);
          }
        }}
      />

      <QuickTransactionSheet
        open={txToEdit !== null || quickTxType !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setTxToEdit(null);
            setQuickTxType(null);
          }
        }}
        asset={currentAsset}
        initialType={quickTxType ?? "buy"}
        editTransaction={txToEdit}
      />

      <AssetScoreEvaluationDialog asset={currentAsset} open={evaluationOpen} onOpenChange={setEvaluationOpen} />
      {upgradeModal}
    </>
  );
}
