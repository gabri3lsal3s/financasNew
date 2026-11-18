import type { ActivityItem } from "@/domain/portfolio/unified-activity-feed";
import type { PortfolioAsset, PortfolioContribution, PortfolioDividend, PortfolioTransaction } from "@/types";

export interface DeleteActivityDependencies {
  item: ActivityItem;
  rollbackCash: boolean;
  cashAsset: PortfolioAsset | undefined;
  assetMap: ReadonlyMap<string, PortfolioAsset>;
  usdRate: number;
  deleteDividend: (input: PortfolioDividend & { rollbackCash: boolean }) => Promise<unknown>;
  deleteTransaction: (
    input: PortfolioTransaction & { reverseCash?: boolean; usdRate?: number },
  ) => Promise<unknown>;
  deleteContribution: (input: PortfolioContribution) => Promise<unknown>;
  updateAsset: (input: { id: string; patch: { quantity: number; average_price: number } }) => Promise<unknown>;
}

export async function executeActivityDeletion({
  item,
  rollbackCash,
  cashAsset,
  assetMap,
  usdRate,
  deleteDividend,
  deleteTransaction,
  deleteContribution,
  updateAsset,
}: DeleteActivityDependencies): Promise<void> {
  if (item.type === "dividend") {
    if (item.rawDividend) {
      await deleteDividend({
        ...item.rawDividend,
        rollbackCash: Boolean(item.rawDividend.sync_cash && rollbackCash),
      });
    } else if (item.rawTransaction) {
      await deleteDividend({
        id: item.rawTransaction.id,
        user_id: item.rawTransaction.user_id,
        asset_id: item.rawTransaction.asset_id,
        date: item.date,
        amount: item.total,
        rollbackCash: false,
      });
      await deleteTransaction(item.rawTransaction);
    }
    return;
  }

  if (item.source === "transaction" && item.rawTransaction) {
    const asset = item.rawTransaction.asset_id ? assetMap.get(item.rawTransaction.asset_id) : undefined;
    const rate = asset?.currency === "USD" ? usdRate : 1;
    const shouldReverseCash = Boolean(
      rollbackCash &&
        cashAsset &&
        item.total > 0 &&
        (item.type === "sell" || (item.type === "buy" && !item.linkedContribution)),
    );
    await deleteTransaction({
      ...item.rawTransaction,
      reverseCash: shouldReverseCash,
      usdRate: rate,
    });
    return;
  }

  if (item.source === "contribution" && item.rawContribution) {
    await deleteContribution(item.rawContribution);
    const isCashContrib = cashAsset && item.rawContribution.asset_id === cashAsset.id;
    if (isCashContrib && rollbackCash && cashAsset && item.total > 0) {
      const newBal = Math.max(0, Math.round((Number(cashAsset.quantity ?? 0) - item.total) * 100) / 100);
      await updateAsset({ id: cashAsset.id, patch: { quantity: newBal, average_price: 1 } });
    }
    return;
  }

  if (item.source === "dividend" && item.rawDividend) {
    await deleteDividend({
      ...item.rawDividend,
      rollbackCash: Boolean(item.rawDividend.sync_cash && rollbackCash),
    });
  }
}
