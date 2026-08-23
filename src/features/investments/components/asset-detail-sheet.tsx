import { useState } from "react";
import {
  ArrowDownLeft,
  Calendar,
  Edit2,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  Modal,
  Skeleton,
} from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { calculateYieldOnCost } from "@/domain/portfolio/snowball";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import {
  useAssetPosition,
  useAssetPrices,
  useDeletePortfolioAsset,
  useDeletePortfolioTransaction,
} from "@/state";
import type { PortfolioAsset, PortfolioTransactionType } from "@/types";
import { AssetEditDialog } from "./asset-edit-dialog";

export interface AssetDetailSheetProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (action: "buy" | "sell" | "dividend" | "split", asset: PortfolioAsset) => void;
}

export function AssetDetailSheet({
  asset,
  open,
  onOpenChange,
  onAction,
}: AssetDetailSheetProps) {
  const assetId = asset?.id ?? null;
  const { data: txs, isLoading: txLoading, ledger } = useAssetPosition(assetId);
  const pricesQuery = useAssetPrices();
  const deleteAsset = useDeletePortfolioAsset();
  const deleteTx = useDeletePortfolioTransaction();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);

  if (!asset) return null;

  const isCash = isCashAssetClass(asset.asset_class);
  const prices = pricesQuery.data ?? [];
  const priceQuote = prices.find((p) => p.ticker.toUpperCase() === asset.ticker.toUpperCase());
  const currentPrice = priceQuote ? priceQuote.price : asset.average_price;

  const quantity = ledger ? ledger.quantity : asset.quantity;
  const averageCost = ledger ? ledger.averageCost : asset.average_price;
  const totalCost = ledger ? ledger.totalCost : quantity * averageCost;
  const currentValue = isCash ? quantity : quantity * currentPrice;
  const totalDividends = ledger ? ledger.dividends : 0;
  const unrealizedPnl = isCash ? 0 : currentValue - totalCost;
  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  // Yield on Cost (%)
  const yieldOnCostPct = calculateYieldOnCost(totalDividends, totalCost);

  const formatTxType = (type: PortfolioTransactionType) => {
    switch (type) {
      case "buy":
      case "subscription":
        return { label: "Compra", variant: "positive" as const };
      case "sell":
        return { label: "Venda", variant: "negative" as const };
      case "dividend":
      case "jcp":
      case "fii_yield":
        return { label: "Provento", variant: "default" as const };
      case "split":
        return { label: "Desdobramento", variant: "muted" as const };
      case "reverse_split":
        return { label: "Grupamento", variant: "muted" as const };
      default:
        return { label: type, variant: "muted" as const };
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={asset.ticker}
        description={asset.notes || `${asset.asset_class ?? "Ativo"} · ${asset.currency}`}
        size="lg"
      >
        <div className="flex flex-col gap-6 pt-2">
          {/* Header de Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs font-mono">
                {asset.asset_class ?? "Outros"}
              </Badge>
              <Badge variant="muted" className="text-xs">
                {asset.currency}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAction?.("buy", asset)}
                className="gap-1 text-xs text-primary"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Aportar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAction?.("sell", asset)}
                className="gap-1 text-xs"
              >
                <ArrowDownLeft className="size-3.5" aria-hidden="true" />
                Vender
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAction?.("dividend", asset)}
                className="gap-1 text-xs text-positive-strong"
              >
                <Receipt className="size-3.5" aria-hidden="true" />
                Provento
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditOpen(true)}
                className="size-8 p-0 text-muted-foreground"
                title="Editar Ativo"
              >
                <Edit2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Grid de Métricas Principais da Posição */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/80 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">Posição Total</span>
              <span className="font-mono text-base font-bold text-foreground">
                <MoneyText cents={numberToCents(currentValue)} />
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {quantity} cota(s)
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/80 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">Preço Médio (PM)</span>
              <span className="font-mono text-base font-bold text-foreground">
                <MoneyText cents={numberToCents(averageCost)} />
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Custo: <MoneyText cents={numberToCents(totalCost)} />
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/80 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">Lucro Não Realizado</span>
              <span
                className={`font-mono text-base font-bold ${
                  unrealizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong"
                }`}
              >
                {unrealizedPnl >= 0 ? "+" : ""}
                <MoneyText cents={numberToCents(unrealizedPnl)} />
              </span>
              <span
                className={`text-[10px] font-mono ${
                  unrealizedPnlPct >= 0 ? "text-positive-strong" : "text-negative-strong"
                }`}
              >
                {unrealizedPnlPct >= 0 ? "+" : ""}
                {unrealizedPnlPct.toFixed(2)}%
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/80 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">Yield on Cost (YoC)</span>
              <span className="font-mono text-base font-bold text-positive-strong">
                {yieldOnCostPct.toFixed(2)}%
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Proventos: <MoneyText cents={numberToCents(totalDividends)} />
              </span>
            </div>
          </div>

          {/* Histórico de Transações do Ledger */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Histórico de Operações & Proventos</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {(txs ?? []).length} operação(ões)
              </span>
            </div>

            {txLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : (txs ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Nenhuma operação registrada individualmente no histórico.
              </div>
            ) : (
              <div className="flex max-h-64 flex-col divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/80 bg-surface/60">
                {(txs ?? []).map((tx) => {
                  const txInfo = formatTxType(tx.type);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 text-xs transition-colors hover:bg-surface-hover/50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={txInfo.variant} className="text-[10px] shrink-0">
                          {txInfo.label}
                        </Badge>
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {tx.date}
                          </span>
                          <span className="font-mono text-xs font-medium text-foreground">
                            {tx.quantity > 0 ? `${tx.quantity} cota(s) · ` : ""}
                            <MoneyText cents={numberToCents(tx.price > 0 ? tx.price : tx.total / (tx.quantity || 1))} />
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-foreground">
                          <MoneyText cents={numberToCents(tx.total)} />
                        </span>

                        <button
                          type="button"
                          onClick={() => setTxToDelete(tx.id)}
                          className="size-6 text-muted-foreground hover:text-negative-strong transition-colors"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Zona de Perigo / Exclusão */}
          <div className="flex items-center justify-between border-t border-border/80 pt-4">
            <span className="text-xs text-muted-foreground">Remover ativo e histórico</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="gap-1 text-xs"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Excluir Ativo
            </Button>
          </div>
        </div>
      </Modal>

      {/* Diálogo de Edição Cadastral */}
      <AssetEditDialog
        asset={asset}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Confirmação de Exclusão do Ativo */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Excluir ${asset.ticker}?`}
        description="Esta ação removerá o ativo da carteira e todas as transações vinculadas a ele."
        confirmLabel="Excluir Permanentemente"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={async () => {
          await deleteAsset.mutateAsync(asset.id);
          setDeleteConfirmOpen(false);
          onOpenChange(false);
        }}
      />

      {/* Confirmação de Exclusão de Transação Individual */}
      <ConfirmDialog
        open={txToDelete !== null}
        onOpenChange={(next) => !next && setTxToDelete(null)}
        title="Excluir lançamento?"
        description="O registro será removido do histórico da posição."
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
    </>
  );
}
