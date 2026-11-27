/**
 * Resolvedor canônico de valoração de carteira para os motores do carrossel e
 * métricas de diversificação (Onda 1 · Fase 2A).
 *
 * Prioriza `PortfolioPositionRow.valueBRL` (marcação a mercado / renda fixa / valor total),
 * preserva zero legítimo, separa caixa e só recorre a `quantity * average_price` como fallback
 * quando não houver linha de posição resolvida.
 *
 * 100% puro — zero dependências de UI ou Supabase.
 */

import type { AssetCurrency, PortfolioAsset } from "@/types";
import { isCashAssetClass } from "./valuation";

export interface CarouselValuationRow {
  assetId: string;
  ticker: string;
  assetClass?: string | null;
  currency?: AssetCurrency;
  valueBRL: number;
  isCash?: boolean;
  priceQuote?: number;
  priceBRL?: number;
  canonicalSource?: string;
  isEstimate?: boolean;
}

export interface ValuedPortfolioAsset {
  asset: PortfolioAsset;
  valueBRL: number;
  source: "position" | "cost_fallback";
  isEstimate: boolean;
  canonicalSource?: string;
  priceQuote?: number;
  priceBRL?: number;
}

export interface ResolvedPortfolioValuation {
  items: ValuedPortfolioAsset[];
  investedTotalBRL: number;
  cashBRL: number;
  patrimonyTotalBRL: number;
  cashIncludedInGlobal: boolean;
  fxRateUSD: number;
  fallbackTickers: string[];
}

export interface ResolvePortfolioValuationOptions {
  positionRows?: readonly CarouselValuationRow[];
  cashBRL?: number;
  fxRateUSD?: number;
}

/**
 * Resolve o valor em BRL de cada ativo econômico (não caixa) da carteira.
 */
export function resolveCarouselPortfolioValuation(
  assets: readonly PortfolioAsset[],
  options?: ResolvePortfolioValuationOptions,
): ResolvedPortfolioValuation {
  const fxRateUSD =
    options?.fxRateUSD && Number.isFinite(options.fxRateUSD) && options.fxRateUSD > 0
      ? options.fxRateUSD
      : 5.0;

  const rowByAssetId = new Map<string, CarouselValuationRow>();
  let rowsCashBRL = 0;

  if (options?.positionRows) {
    for (const row of options.positionRows) {
      if (row.isCash || isCashAssetClass(row.assetClass)) {
        if (Number.isFinite(row.valueBRL)) {
          rowsCashBRL += row.valueBRL;
        }
        continue;
      }
      rowByAssetId.set(row.assetId, row);
    }
  }

  const items: ValuedPortfolioAsset[] = [];
  const fallbackTickers: string[] = [];
  let investedTotalBRL = 0;
  let assetsCashBRL = 0;

  for (const asset of assets) {
    if (isCashAssetClass(asset.asset_class)) {
      if (!options?.positionRows) {
        const qty = asset.quantity ?? 0;
        const price = asset.average_price ?? 0;
        if (Number.isFinite(qty) && Number.isFinite(price) && qty * price > 0) {
          assetsCashBRL += asset.currency === "USD" ? qty * price * fxRateUSD : qty * price;
        }
      }
      continue;
    }

    const row = rowByAssetId.get(asset.id);
    if (row && Number.isFinite(row.valueBRL) && row.valueBRL >= 0) {
      investedTotalBRL += row.valueBRL;
      const isEstimate = Boolean(row.isEstimate || row.canonicalSource === "fallback");
      if (isEstimate) {
        fallbackTickers.push(asset.ticker);
      }
      items.push({
        asset,
        valueBRL: row.valueBRL,
        source: "position",
        isEstimate,
        canonicalSource: row.canonicalSource,
        priceQuote: row.priceQuote,
        priceBRL: row.priceBRL,
      });
      continue;
    }

    const qty = asset.quantity ?? 0;
    const avgPrice = asset.average_price ?? 0;
    if (
      !Number.isFinite(qty) ||
      !Number.isFinite(avgPrice) ||
      qty <= 0 ||
      avgPrice <= 0
    ) {
      continue;
    }

    const raw = qty * avgPrice;
    const valueBRL = asset.currency === "USD" ? raw * fxRateUSD : raw;
    if (!Number.isFinite(valueBRL) || valueBRL < 0) continue;

    investedTotalBRL += valueBRL;
    fallbackTickers.push(asset.ticker);
    items.push({
      asset,
      valueBRL,
      source: "cost_fallback",
      isEstimate: true,
    });
  }

  const cashBRL =
    typeof options?.cashBRL === "number" && Number.isFinite(options.cashBRL)
      ? options.cashBRL
      : options?.positionRows
        ? rowsCashBRL
        : assetsCashBRL;

  const cashIncludedInGlobal = cashBRL > 0;
  const patrimonyTotalBRL = investedTotalBRL + (cashIncludedInGlobal ? cashBRL : 0);

  return {
    items,
    investedTotalBRL,
    cashBRL,
    patrimonyTotalBRL,
    cashIncludedInGlobal,
    fxRateUSD,
    fallbackTickers,
  };
}
