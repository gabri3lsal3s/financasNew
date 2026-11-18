/**
 * Reconstituição de Preço Médio histórico e apuração de DARF mensal (§F40).
 * Função 100% pura — sem import de React ou Supabase (AGENTS.md §3).
 */

import type { PortfolioAsset, PortfolioTransaction } from "@/types";
import {
  calculateHistoricalLossesCarryover,
  calculateMonthlyDarf,
  sortTransactionsChronologically,
  type MonthlyDarfResult,
  type MonthlyDarfSaleItem,
} from "./tax";

export interface ComputeMonthlyDarfReportInput {
  month: string;
  assets: readonly PortfolioAsset[];
  transactions: readonly PortfolioTransaction[];
}

export interface MonthlyDarfReport {
  darf: MonthlyDarfResult;
  salesCount: number;
}

/**
 * Reconstitui o preço médio histórico até a data de cada venda no mês
 * selecionado, apura prejuízos anteriores compensáveis e calcula a DARF devida.
 */
export function computeMonthlyDarfReport({
  month,
  assets,
  transactions,
}: ComputeMonthlyDarfReportInput): MonthlyDarfReport {
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const monthSales: MonthlyDarfSaleItem[] = transactions
    .filter((t) => t.date.startsWith(month) && t.type === "sell")
    .map((t) => {
      const asset = assetMap.get(t.asset_id);
      const ticker = asset?.ticker ?? "Ativo";
      const assetClass = asset?.asset_class ?? null;
      const currency = asset?.currency ?? "BRL";

      const assetTxs = sortTransactionsChronologically(
        transactions.filter((tx) => tx.asset_id === t.asset_id && tx.date <= t.date),
      );

      let runningQty = 0;
      let runningCost = 0;
      for (const tx of assetTxs) {
        if (tx.type === "buy" || tx.type === "subscription") {
          runningQty += tx.quantity;
          runningCost += tx.quantity * tx.price;
        } else if (tx.type === "sell" && tx.id !== t.id) {
          if (runningQty > 0) {
            const pm = runningCost / runningQty;
            const soldQty = Math.min(runningQty, tx.quantity);
            runningQty -= soldQty;
            runningCost -= soldQty * pm;
          }
        } else if (tx.type === "split") {
          const factor = tx.quantity > 0 ? tx.quantity : 1;
          runningQty *= factor;
        } else if (tx.type === "reverse_split") {
          const factor = tx.quantity > 0 ? tx.quantity : 1;
          runningQty /= factor;
        }
      }

      const historicalPm = runningQty > 0 ? runningCost / runningQty : 0;
      const averagePrice =
        historicalPm > 0
          ? historicalPm
          : asset?.average_price && asset.average_price > 0
            ? asset.average_price
            : t.price;

      const costAmountCents = Math.round(t.quantity * averagePrice * 100);
      const saleAmountCents = Math.round(t.total * 100);
      const profitCents = saleAmountCents - costAmountCents;

      return {
        ticker,
        assetClass,
        currency,
        saleAmountCents,
        costAmountCents,
        profitCents,
      };
    });

  const previousLosses = calculateHistoricalLossesCarryover({
    transactions: [...transactions],
    assets: [...assets],
    targetMonth: month,
  });

  const darf = calculateMonthlyDarf({
    month,
    sales: monthSales,
    previousLosses,
  });

  return {
    darf,
    salesCount: monthSales.length,
  };
}
