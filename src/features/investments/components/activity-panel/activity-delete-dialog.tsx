import { Checkbox, ConfirmDialog } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { ActivityItem } from "@/domain/portfolio/unified-activity-feed";
import { formatCentsAsBRL } from "@/services/masks";
import type { PortfolioAsset } from "@/types";

export interface ActivityDeleteDialogProps {
  item: ActivityItem | null;
  rollbackCash: boolean;
  onRollbackCashChange: (checked: boolean) => void;
  cashAsset: PortfolioAsset | undefined;
  cashBalance: number;
  usdRate: number;
  assetMap: ReadonlyMap<string, PortfolioAsset>;
  confirmPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ActivityDeleteDialog({
  item,
  rollbackCash,
  onRollbackCashChange,
  cashAsset,
  cashBalance,
  usdRate,
  assetMap,
  confirmPending,
  onClose,
  onConfirm,
}: ActivityDeleteDialogProps) {
  const showDividendRollback = item?.type === "dividend" && Boolean(item.rawDividend?.sync_cash);
  const showBuyRollback =
    item?.source === "transaction" && item.type === "buy" && !item.linkedContribution && Boolean(cashAsset);
  const showSellRollback =
    item?.source === "transaction" && item.type === "sell" && Boolean(cashAsset);
  const showCashContribRollback =
    item?.source === "contribution" && Boolean(cashAsset) && item.rawContribution?.asset_id === cashAsset?.id;

  const assetForTx = item?.rawTransaction?.asset_id ? assetMap.get(item.rawTransaction.asset_id) : undefined;
  const txRate = assetForTx?.currency === "USD" ? usdRate : 1;
  const txTotalBRL = item ? Math.round(item.total * txRate * 100) / 100 : 0;

  return (
    <ConfirmDialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Excluir movimentação?"
      description={`O lançamento de ${item?.ticker ?? ""} no valor de ${formatCentsAsBRL(numberToCents(item?.total ?? 0))} será excluído permanentemente com recálculo da posição.`}
      confirmLabel="Excluir movimentação"
      variant="destructive"
      confirmPending={confirmPending}
      onConfirm={onConfirm}
    >
      {showDividendRollback && item ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-raised p-3 text-xs text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Estornar valor do Caixa</span>
            <Checkbox
              checked={rollbackCash}
              onCheckedChange={(checked) => onRollbackCashChange(Boolean(checked))}
              aria-label="Estornar valor do Caixa"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {cashBalance < (item.rawDividend?.cash_amount ?? item.total)
              ? `Saldo atual em Caixa (${formatCentsAsBRL(numberToCents(cashBalance))}) é menor que o provento. Ao estornar, o saldo do Caixa será ajustado para R$ 0,00.`
              : `Abaterá ${formatCentsAsBRL(numberToCents(item.rawDividend?.cash_amount ?? item.total))} do saldo atual de Caixa (${formatCentsAsBRL(numberToCents(cashBalance))}).`}
          </p>
        </div>
      ) : null}

      {showBuyRollback ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-raised p-3 text-xs text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Devolver valor para o Caixa</span>
            <Checkbox
              checked={rollbackCash}
              onCheckedChange={(checked) => onRollbackCashChange(Boolean(checked))}
              aria-label="Devolver valor para o Caixa"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Esta compra foi liquidada com saldo da corretora. Ao estornar,{" "}
            {formatCentsAsBRL(numberToCents(txTotalBRL))} retornarão ao seu Ativo Caixa.
          </p>
        </div>
      ) : null}

      {showSellRollback ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-raised p-3 text-xs text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Estornar valor creditado no Caixa</span>
            <Checkbox
              checked={rollbackCash}
              onCheckedChange={(checked) => onRollbackCashChange(Boolean(checked))}
              aria-label="Estornar valor creditado no Caixa"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {cashBalance < txTotalBRL
              ? `Saldo atual em Caixa (${formatCentsAsBRL(numberToCents(cashBalance))}) é menor que o valor da venda. Ao estornar, o saldo do Caixa será ajustado para R$ 0,00.`
              : `Abaterá ${formatCentsAsBRL(numberToCents(txTotalBRL))} do saldo atual de Caixa (${formatCentsAsBRL(numberToCents(cashBalance))}).`}
          </p>
        </div>
      ) : null}

      {showCashContribRollback && item ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-raised p-3 text-xs text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Estornar valor do Caixa</span>
            <Checkbox
              checked={rollbackCash}
              onCheckedChange={(checked) => onRollbackCashChange(Boolean(checked))}
              aria-label="Estornar valor do Caixa"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {cashBalance < item.total
              ? `Saldo atual em Caixa (${formatCentsAsBRL(numberToCents(cashBalance))}) é menor que o aporte. Ao estornar, o saldo será zerado.`
              : `Abaterá ${formatCentsAsBRL(numberToCents(item.total))} do saldo atual de Caixa (${formatCentsAsBRL(numberToCents(cashBalance))}).`}
          </p>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
