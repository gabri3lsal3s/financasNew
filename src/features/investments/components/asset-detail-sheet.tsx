import { useState } from "react";
import {
  ArrowDownLeft,
  Calendar,
  Edit2,
  Plus,
  Receipt,
  SlidersHorizontal,
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
import { formatCentsAsBRL } from "@/services/masks/money";

import { inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { calculateYieldOnCostTotal } from "@/domain/portfolio/snowball";
import { getAssetPricingMode, isCashAssetClass } from "@/domain/portfolio/valuation";
import { formatDateBR } from "@/lib/date";
import {
  useAssetPosition,
  useDeletePortfolioAsset,
  useDeletePortfolioTransaction,
  usePortfolioAssets,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioAsset, PortfolioTransactionType } from "@/types";
import { AssetEditDialog } from "./asset-edit-dialog";
import { CalibrateFixedIncomeDialog } from "./calibrate-fixed-income-dialog";

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
  const { data: txs, isLoading: txLoading } = useAssetPosition(assetId);
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const deleteAsset = useDeletePortfolioAsset();
  const deleteTx = useDeletePortfolioTransaction();

  const [editOpen, setEditOpen] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);

  if (!asset) return null;

  // Busca a versão mais recente do ativo e a linha consolidada de posição
  const currentAsset = (assetsQuery.data ?? []).find((a) => a.id === asset.id) ?? asset;
  const positionRow = position.rows.find((r) => r.assetId === currentAsset.id);

  const pricingMode = getAssetPricingMode({
    ticker: currentAsset.ticker,
    asset_class: currentAsset.asset_class,
    notes: currentAsset.notes,
  });
  const isCash = pricingMode === "cash" || isCashAssetClass(currentAsset.asset_class);
  const isTotalValue = pricingMode === "total_value";

  // Valores consolidados em tempo real
  const quantity = positionRow ? positionRow.quantity : Number(currentAsset.quantity ?? 0);
  const averageCost = positionRow ? positionRow.averageCost : Number(currentAsset.average_price ?? 0);
  const totalCost = positionRow
    ? positionRow.totalCostBRL
    : isTotalValue
      ? averageCost > 0 ? averageCost : quantity
      : quantity * averageCost;

  const currentPrice = positionRow ? positionRow.priceBRL : averageCost;
  const currentValue = positionRow ? positionRow.valueBRL : (isCash ? quantity : quantity * currentPrice);
  const unrealizedPnl = positionRow ? positionRow.unrealizedPnl : (isCash ? 0 : currentValue - totalCost);
  const unrealizedPnlPct = positionRow
    ? (positionRow.unrealizedPct ?? 0)
    : totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  // Proventos consolidados (acumulados históricos + lançamentos periódicos)
  const totalDividends = positionRow ? positionRow.dividends : (currentAsset.accumulated_dividends ?? 0);
  const accumulatedDividends = currentAsset.accumulated_dividends ?? 0;
  const periodicDividends = Math.max(0, totalDividends - accumulatedDividends);
  const yieldOnCostPct = calculateYieldOnCostTotal(accumulatedDividends, periodicDividends, totalCost);

  const totalReturnPnl = positionRow
    ? positionRow.totalReturnPnl
    : (isCash ? 0 : unrealizedPnl + totalDividends);
  const totalReturnPct = positionRow
    ? (positionRow.totalReturnPct ?? 0)
    : totalCost > 0 ? (totalReturnPnl / totalCost) * 100 : 0;

  const formatRateLabel = (metadata: NonNullable<PortfolioAsset["fixed_income_metadata"]>) => {
    switch (metadata.rate_type) {
      case "cdi":
        return `${metadata.rate_value}% CDI`;
      case "selic":
        return `${metadata.rate_value}% Selic`;
      case "pre":
        return `${metadata.rate_value}% a.a.`;
      case "ipca":
        return `IPCA + ${metadata.rate_value}% a.a.`;
      default:
        return `${metadata.rate_value}%`;
    }
  };

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

  const resolvedSector = currentAsset.sector?.trim() || (currentAsset.asset_class ? inferSectorFromTicker(currentAsset.ticker, currentAsset.asset_class) : null);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={currentAsset.ticker}
        description={resolvedSector ? `${currentAsset.asset_class ?? "Ativo"} · ${resolvedSector}` : (currentAsset.asset_class ?? "Ativo em Carteira")}
        size="xl"
      >
        <div className="flex flex-col gap-5 pt-1">
          {/* Header de Metadados & Ações Rápidas */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {currentAsset.currency !== "BRL" ? (
                <Badge variant="muted" className="text-xs">
                  {currentAsset.currency}
                </Badge>
              ) : null}
              {currentAsset.fixed_income_metadata && currentAsset.fixed_income_metadata.rate_value > 0 ? (
                <Badge variant="default" className="text-xs font-semibold">
                  {formatRateLabel(currentAsset.fixed_income_metadata)} • Projetado
                </Badge>
              ) : null}
              {positionRow?.isMatured ? (
                <Badge variant="negative" className="text-xs font-semibold">
                  Vencido em {formatDateBR(positionRow.maturityDate ?? "")}
                </Badge>
              ) : positionRow?.maturityDate ? (
                <Badge variant="warning" className="text-xs font-semibold">
                  Vence em {formatDateBR(positionRow.maturityDate)}
                </Badge>
              ) : null}
              {currentAsset.fixed_income_metadata?.is_tax_exempt ? (
                <Badge variant="positive" className="text-xs">
                  Isento de IR
                </Badge>
              ) : positionRow?.fixedIncomeResult?.taxCountdown ? (
                <Badge variant="muted" className="text-xs">
                  IR {positionRow.taxRatePct}% ➔ {positionRow.fixedIncomeResult.taxCountdown.nextRatePct}% em {positionRow.fixedIncomeResult.taxCountdown.daysRemaining}d
                </Badge>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAction?.("buy", currentAsset)}
                className="gap-1 text-xs text-primary flex-1 sm:flex-initial"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Aportar</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAction?.("sell", currentAsset)}
                className={`gap-1 text-xs flex-1 sm:flex-initial ${positionRow?.isMatured ? "border-critical-strong/60 text-critical-strong" : ""}`}
              >
                <ArrowDownLeft className="size-3.5" aria-hidden="true" />
                <span>{positionRow?.isMatured ? "Liquidar Caixa" : isTotalValue ? "Resgatar" : "Vender"}</span>
              </Button>
              {isTotalValue && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCalibrateOpen(true)}
                  className="gap-1 text-xs text-muted-foreground flex-1 sm:flex-initial"
                  title="Calibrar com saldo do extrato"
                >
                  <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                  <span>Calibrar</span>
                </Button>
              )}
              {(!isTotalValue || totalDividends > 0 || (currentAsset.accumulated_dividends ?? 0) > 0) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onAction?.("dividend", currentAsset)}
                  className="gap-1 text-xs text-positive-strong flex-1 sm:flex-initial"
                >
                  <Receipt className="size-3.5" aria-hidden="true" />
                  <span>{isTotalValue ? "Rendimento" : "Provento"}</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditOpen(true)}
                className="size-8 p-0 text-muted-foreground shrink-0"
                title="Editar Ativo"
                aria-label="Editar Ativo"
              >
                <Edit2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Grid de Métricas Principais da Posição */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
            <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface/80 p-3 sm:p-3.5 min-w-0 overflow-hidden">
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {isTotalValue ? "Saldo Atual" : "Posição Total"}
              </span>
              <span className="font-mono text-sm sm:text-base font-bold text-foreground truncate" title={formatCentsAsBRL(numberToCents(currentValue))}>
                <MoneyText cents={numberToCents(currentValue)} />
              </span>
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {isTotalValue
                  ? (currentAsset.fixed_income_metadata?.rate_value && currentAsset.fixed_income_metadata.rate_value > 0
                      ? "Na curva projetada"
                      : "Saldo cadastrado manual")
                  : `${quantity} cota(s)`}
              </span>
            </div>

            <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface/80 p-3 sm:p-3.5 min-w-0 overflow-hidden">
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {isTotalValue ? "Valor Aplicado" : "Preço Médio (PM)"}
              </span>
              <span className="font-mono text-sm sm:text-base font-bold text-foreground truncate">
                <MoneyText cents={numberToCents(isTotalValue ? totalCost : averageCost)} currency={isTotalValue ? "BRL" : currentAsset.currency} />
              </span>
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {isTotalValue ? "Aporte inicial" : <>Custo: <MoneyText cents={numberToCents(totalCost)} currency="BRL" /></>}
              </span>
            </div>

            <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface/80 p-3 sm:p-3.5 min-w-0 overflow-hidden">
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {isTotalValue ? "Rendimento Total" : "Resultado Total"}
              </span>
              <span
                className={`font-mono text-sm sm:text-base font-bold truncate ${
                  (totalReturnPnl ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong"
                }`}
                title={`Retorno Total: ${(totalReturnPnl ?? 0) >= 0 ? "+" : ""}${formatCentsAsBRL(numberToCents(totalReturnPnl ?? 0))} (${(totalReturnPct ?? 0).toFixed(2)}%)`}
              >
                {(totalReturnPnl ?? 0) >= 0 ? "+" : ""}
                <MoneyText cents={numberToCents(totalReturnPnl ?? 0)} />
              </span>
              <div className="flex items-center gap-1.5 text-[10px] font-mono truncate">
                <span
                  className={(totalReturnPct ?? 0) >= 0 ? "text-positive-strong font-semibold" : "text-negative-strong font-semibold"}
                >
                  {(totalReturnPct ?? 0) >= 0 ? "+" : ""}
                  {(totalReturnPct ?? 0).toFixed(2)}%
                </span>
                {totalDividends > 0 && !isTotalValue ? (
                  <span className="text-muted-foreground text-[9px] truncate" title={`Cotação: ${(unrealizedPnlPct ?? 0) >= 0 ? "+" : ""}${(unrealizedPnlPct ?? 0).toFixed(2)}% | Proventos: +${(yieldOnCostPct ?? 0).toFixed(2)}%`}>
                    (Cotação {(unrealizedPnlPct ?? 0) >= 0 ? "+" : ""}${(unrealizedPnlPct ?? 0).toFixed(1)}%)
                  </span>
                ) : null}
              </div>
            </div>

            {isTotalValue && totalDividends === 0 ? (
              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface/80 p-3 sm:p-3.5 min-w-0 overflow-hidden">
                <span className="text-[11px] font-medium text-muted-foreground truncate">Vencimento</span>
                <span className="font-mono text-sm sm:text-base font-bold text-foreground truncate">
                  {positionRow?.maturityDate ? formatDateBR(positionRow.maturityDate) : "Indeterminado"}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {positionRow?.isMatured
                    ? "Título vencido"
                    : positionRow?.fixedIncomeResult?.taxCountdown
                      ? `IR ${positionRow.taxRatePct}% (cai p/ ${positionRow.fixedIncomeResult.taxCountdown.nextRatePct}% em ${positionRow.fixedIncomeResult.taxCountdown.daysRemaining}d)`
                      : "Acumulativo"}
                </span>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-1 rounded-xl border border-border/80 bg-surface/80 p-3 sm:p-3.5 min-w-0 overflow-hidden">
                <span className="text-[11px] font-medium text-muted-foreground truncate">Yield on Cost (YoC)</span>
                <span className="font-mono text-sm sm:text-base font-bold text-positive-strong truncate">
                  {yieldOnCostPct.toFixed(2)}%
                </span>
                {accumulatedDividends > 0 ? (
                  <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      Extrato: <MoneyText cents={numberToCents(periodicDividends)} />
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      Acumulados: <MoneyText cents={numberToCents(accumulatedDividends)} />
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono font-semibold truncate">
                      Total: <MoneyText cents={numberToCents(totalDividends)} />
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                    Proventos: <MoneyText cents={numberToCents(totalDividends)} />
                  </span>
                )}
              </div>
            )}
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
                      className="flex items-center justify-between p-3 text-xs hover:bg-surface-hover/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Badge variant={txInfo.variant} className="text-[10px] px-1.5 py-0 shrink-0">
                          {txInfo.label}
                        </Badge>
                        <span className="font-mono text-muted-foreground shrink-0">{tx.date}</span>
                        {tx.quantity > 0 && !isTotalValue && (
                          <span className="text-muted-foreground font-mono truncate">
                            ({tx.quantity} un @ <MoneyText cents={numberToCents(tx.price)} currency={currentAsset.currency} />)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="font-mono font-semibold text-foreground">
                          <MoneyText cents={numberToCents(tx.total)} currency={currentAsset.currency} />
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTxToDelete(tx.id)}
                          className="size-7 p-0 text-muted-foreground hover:text-negative-strong"
                          title="Excluir lançamento"
                          aria-label="Excluir lançamento"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rodapé: Exclusão do Ativo da Carteira */}
          <div className="flex items-center justify-between border-t border-border/80 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-xs text-negative-strong hover:bg-negative-surface/40"
            >
              <Trash2 className="size-3.5 mr-1" aria-hidden="true" />
              Excluir Ativo da Carteira
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Diálogo de Edição Cadastral */}
      <AssetEditDialog
        asset={currentAsset}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Diálogo de Calibração de Marco Zero */}
      <CalibrateFixedIncomeDialog
        asset={currentAsset}
        open={calibrateOpen}
        onOpenChange={setCalibrateOpen}
        currentEstimatedValueCents={numberToCents(currentValue)}
      />

      {/* Confirmação de Exclusão do Ativo */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Excluir ${currentAsset.ticker}?`}
        description="Esta ação removerá o ativo da sua carteira, incluindo todas as transações vinculadas. Essa operação não pode ser desfeita."
        confirmLabel="Sim, excluir ativo"
        variant="destructive"
        onConfirm={async () => {
          await deleteAsset.mutateAsync(currentAsset.id);
          onOpenChange(false);
        }}
      />

      {/* Confirmação de Exclusão de Transação Individual */}
      <ConfirmDialog
        open={txToDelete !== null}
        onOpenChange={(next) => !next && setTxToDelete(null)}
        title="Excluir movimentação?"
        description="Esta operação será removida do histórico do ativo."
        confirmLabel="Excluir"
        variant="destructive"
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
