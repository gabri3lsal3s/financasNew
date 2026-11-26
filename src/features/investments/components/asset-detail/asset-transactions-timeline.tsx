import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, MoneyText, Skeleton } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
import { formatAssetQuantity } from "@/services/formatting";
import type { PortfolioAsset, PortfolioTransaction, PortfolioTransactionType } from "@/types";

export interface AssetTransactionsTimelineProps {
  asset: PortfolioAsset;
  transactions: readonly PortfolioTransaction[];
  isLoading: boolean;
  isTotalValue: boolean;
  onCreateTx: () => void;
  onEditTx: (tx: PortfolioTransaction) => void;
  onDeleteTx: (tx: PortfolioTransaction) => void;
}

function formatTxType(type: PortfolioTransactionType) {
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
}

export function AssetTransactionsTimeline({
  asset,
  transactions,
  isLoading,
  isTotalValue,
  onCreateTx,
  onEditTx,
  onDeleteTx,
}: AssetTransactionsTimelineProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Histórico de Operações &amp; Proventos</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCreateTx}
            className="text-xs text-primary-strong hover:bg-primary/10 gap-1"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Nova Operação</span>
          </Button>
          <span className="text-[11px] text-muted-foreground font-mono">
            {transactions.length} operação(ões)
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="Nenhuma operação registrada"
          description="Nenhuma operação registrada individualmente no histórico."
          headingLevel="h3"
          action={
            <Button type="button" size="sm" variant="outline" onClick={onCreateTx}>
              Nova Operação
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface">
          {transactions.map((tx) => {
            const txInfo = formatTxType(tx.type);
            return (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 p-3 text-xs hover:bg-surface-hover/60 transition-colors"
              >
                <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={txInfo.variant} size="xs" className="shrink-0">
                      {txInfo.label}
                    </Badge>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {formatDateBR(tx.date)}
                    </span>
                  </div>
                  <MoneyText
                    cents={numberToCents(tx.total)}
                    currency={asset.currency}
                    tone="default"
                    className="font-semibold sm:hidden shrink-0"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  {tx.quantity > 0 && !isTotalValue ? (
                    <span className="text-muted-foreground font-mono text-[11px] sm:text-xs">
                      {formatAssetQuantity(tx.quantity, asset.asset_class ?? undefined)} un @{" "}
                      <MoneyText cents={numberToCents(tx.price)} currency={asset.currency} variant="caption" tone="default" />
                    </span>
                  ) : (
                    <span className="hidden sm:inline" />
                  )}

                  <div className="flex items-center gap-1.5 shrink-0">
                    <MoneyText
                      cents={numberToCents(tx.total)}
                      currency={asset.currency}
                      tone="default"
                      className="font-semibold hidden sm:inline mr-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditTx(tx)}
                      className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Editar lançamento"
                      aria-label="Editar lançamento"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteTx(tx)}
                      className="size-8 p-0 shrink-0 text-muted-foreground hover:text-critical-strong"
                      title="Excluir lançamento"
                      aria-label="Excluir lançamento"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
