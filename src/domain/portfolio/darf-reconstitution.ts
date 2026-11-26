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

      const isUsd = currency.toUpperCase() === "USD";
      const assetTxs = sortTransactionsChronologically(
        transactions.filter((tx) => tx.asset_id === t.asset_id && tx.date <= t.date),
      );

      let runningQty = 0;
      let runningCostBrl = 0;
      for (const tx of assetTxs) {
        const txRate = isUsd ? (tx.fx_rate && tx.fx_rate > 0 ? tx.fx_rate : 1) : 1;
        if (tx.type === "buy" || tx.type === "subscription") {
          runningQty += tx.quantity;
          const outlayNative = tx.total > 0 ? tx.total : tx.quantity * tx.price;
          const outlayBrl =
            isUsd && tx.total_cost_brl != null && tx.total_cost_brl > 0
              ? tx.total_cost_brl
              : outlayNative * txRate;
          runningCostBrl += outlayBrl;
        } else if (tx.type === "sell" && tx.id !== t.id) {
          if (runningQty > 0) {
            const pmBrl = runningCostBrl / runningQty;
            const soldQty = Math.min(runningQty, tx.quantity);
            runningQty -= soldQty;
            runningCostBrl -= soldQty * pmBrl;
          }
        } else if (tx.type === "split") {
          const factor = tx.quantity > 0 ? tx.quantity : 1;
          runningQty *= factor;
        } else if (tx.type === "reverse_split") {
          const factor = tx.quantity > 0 ? tx.quantity : 1;
          runningQty /= factor;
        }
      }

      const sellRate = isUsd ? (t.fx_rate && t.fx_rate > 0 ? t.fx_rate : (asset?.fx_rate_at_purchase ?? 1)) : 1;
      const historicalPmBrl = runningQty > 0 ? runningCostBrl / runningQty : 0;
      const fallbackPmBrl =
        asset?.average_cost_brl && asset.average_cost_brl > 0
          ? asset.average_cost_brl
          : asset?.average_price && asset.average_price > 0
            ? asset.average_price * sellRate
            : t.price * sellRate;
      const averagePriceBrl = historicalPmBrl > 0 ? historicalPmBrl : fallbackPmBrl;

      const costAmountCents =
        isUsd && t.total_cost_brl != null && t.total_cost_brl > 0 && historicalPmBrl <= 0
          ? Math.round(t.total_cost_brl * 100)
          : Math.round(t.quantity * averagePriceBrl * 100);
      const saleAmountCents = Math.round((t.total > 0 ? t.total : t.quantity * t.price) * sellRate * 100);
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
