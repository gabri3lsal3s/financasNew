import { useAllPortfolioTransactions, usePortfolioAssets } from "./use-portfolio";
import { useAssetPrices } from "./use-asset-prices";
import {
  computeLedger,
  fallbackPriceFor,
  isCashAssetClass,
  resolvePrice,
  usdRateFromPrices,
  valueAssetPosition,
  type LedgerTransaction,
  type PriceSource,
} from "@/domain/portfolio";
import type { AssetCurrency, PortfolioTransaction } from "@/types";

/**
 * Posição consolidada da carteira (§3.11.2) — derivação local de exibição:
 *   • Ledger por ativo (custo médio, quantidade, proventos — domain puro);
 *   • Valoração em BRL com pipeline manual → cache → fallback (D5);
 *   • Caixa/reserva com valor 1:1 (quantidade = valor);
 *   • pctAtual = valor ÷ patrimônio total × 100.
 * Nenhuma posição é armazenada — tudo derivado das transações + cotações.
 */

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface PortfolioPositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  currency: AssetCurrency;
  quantity: number;
  averageCost: number;
  totalCost: number;
  dividends: number;
  /** Preço unitário em BRL (caixa = 1). */
  priceBRL: number;
  /** Fonte do preço usado (manual / api / fallback). */
  source: PriceSource;
  /** Valor de mercado em BRL (caixa = quantidade × 1). */
  valueBRL: number;
  /** % do patrimônio (0–100). */
  pct: number;
  isCash: boolean;
}

export interface PortfolioPosition {
  rows: PortfolioPositionRow[];
  /** Patrimônio total = soma das posições em BRL. */
  totalBRL: number;
  /** Caixa derivado do ledger (fluxo líquido) — pode ser negativo. */
  cashBRL: number;
  isLoading: boolean;
  error: unknown;
  /** Reexecuta as consultas de ativos, transações e preços. */
  refetch: () => void;
}

export function usePortfolioPosition(): PortfolioPosition {
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const pricesQuery = useAssetPrices();

  const prices = pricesQuery.data ?? [];
  const usdRate = usdRateFromPrices(prices);
  const priceByTicker = new Map(prices.map((p) => [p.ticker, p]));

  const transactionsByAsset = new Map<string, PortfolioTransaction[]>();
  for (const tx of transactionsQuery.data ?? []) {
    const list = transactionsByAsset.get(tx.asset_id) ?? [];
    list.push(tx);
    transactionsByAsset.set(tx.asset_id, list);
  }

  let totalBRL = 0;
  let cashBRL = 0;
  const rawRows: Array<Omit<PortfolioPositionRow, "pct">> = [];

  for (const asset of assetsQuery.data ?? []) {
    const ledger = computeLedger(
      (transactionsByAsset.get(asset.id) ?? []).map(
        (t): LedgerTransaction => ({
          id: t.id,
          type: t.type,
          date: t.date,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
        }),
      ),
    );
    cashBRL = round2(cashBRL + ledger.cash);

    const isCash = isCashAssetClass(asset.asset_class);
    let source: PriceSource = "fallback";
    let priceBRL: number;
    let valueBRL: number;

    if (isCash) {
      // Ticker de caixa: valor 1:1 (quantidade = valor) — §3.11.2.
      priceBRL = 1;
      valueBRL = ledger.quantity;
    } else {
      const priceRow = priceByTicker.get(asset.ticker);
      const resolved = resolvePrice({
        manualPrice: priceRow?.manual_price ?? null,
        cachePrice: priceRow?.price ?? null,
        fallbackPrice: fallbackPriceFor(asset.currency),
      });
      priceBRL = asset.currency === "USD" ? round2(resolved.price * usdRate) : resolved.price;
      valueBRL = valueAssetPosition(ledger.quantity, resolved, asset.currency, usdRate).valueBRL;
      source = resolved.source;
    }

    totalBRL = round2(totalBRL + valueBRL);
    rawRows.push({
      assetId: asset.id,
      ticker: asset.ticker,
      assetClass: asset.asset_class,
      currency: asset.currency,
      quantity: ledger.quantity,
      averageCost: ledger.averageCost,
      totalCost: ledger.totalCost,
      dividends: ledger.dividends,
      priceBRL,
      source,
      valueBRL: round2(valueBRL),
      isCash,
    });
  }

  const rows = rawRows.map((row) => ({
    ...row,
    pct: totalBRL > 0 ? Math.round((row.valueBRL / totalBRL) * 10000) / 100 : 0,
  }));

  return {
    rows,
    totalBRL,
    cashBRL,
    isLoading: assetsQuery.isLoading || transactionsQuery.isLoading || pricesQuery.isLoading,
    error: assetsQuery.error ?? transactionsQuery.error ?? pricesQuery.error,
    refetch: () => {
      void assetsQuery.refetch();
      void transactionsQuery.refetch();
      void pricesQuery.refetch();
    },
  };
}
