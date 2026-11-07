/**
 * Validador Pré-Flight de Fechamento Mensal de Carteira.
 *
 * Garante que todos os ativos sob custódia positiva possuam cotações válidas (> 0)
 * e aplica a Regra de Ouro da Paridade de Caixa (Cotação $1,00$ estática sem I/O).
 *
 * Módulo puro — 100% testável sem rede ou banco de dados.
 */

import type { MonthlyClosingPriceItem } from "@/types";
import { isCashAssetClass } from "./valuation";

export interface ClosingValidationAsset {
  id: string;
  ticker: string;
  asset_class?: string | null;
  quantity: number;
  average_price: number;
  currency?: "BRL" | "USD";
}

export interface ClosingValidationPrice {
  ticker: string;
  price: number;
  currency?: "BRL" | "USD";
  source?: "api" | "manual" | "fallback";
}

export interface ClosingValidationInput {
  assets: ClosingValidationAsset[];
  prices: ClosingValidationPrice[];
  usdRate?: number;
}

export interface ClosingValidationResult {
  isValid: boolean;
  missingTickers: string[];
  invalidPrices: Array<{ ticker: string; price: number }>;
  validatedPrices: MonthlyClosingPriceItem[];
  totalValue: number;
  totalCost: number;
  reason?: string;
}

/**
 * Valida a consistência patrimonial pré-fechamento e compõe o payload consolidado.
 */
export function validateMonthlyClosingPreFlight(
  input: ClosingValidationInput,
): ClosingValidationResult {
  const { assets, prices, usdRate = 1.0 } = input;

  const pricesMap = new Map<string, ClosingValidationPrice>();
  for (const p of prices) {
    pricesMap.set(p.ticker.trim().toUpperCase(), p);
  }

  const missingTickers: string[] = [];
  const invalidPrices: Array<{ ticker: string; price: number }> = [];
  const validatedPricesMap = new Map<string, MonthlyClosingPriceItem>();

  let totalValueCents = 0;
  let totalCostCents = 0;

  for (const asset of assets) {
    if (asset.quantity <= 0) continue;

    const tickerUpper = asset.ticker.trim().toUpperCase();
    const isCash = isCashAssetClass(asset.asset_class) || tickerUpper === "CAIXA";
    const isUSD = asset.currency === "USD";
    const fxRate = isUSD ? usdRate : 1.0;

    let finalPrice: number;
    let currency: "BRL" | "USD";
    let source: "api" | "manual" | "fallback";

    if (isCash) {
      // Regra de Ouro: Ativo Caixa possui paridade 1:1 sem dependência externa
      finalPrice = 1.0;
      currency = "BRL";
      source = "fallback";
    } else {
      const priceEntry = pricesMap.get(tickerUpper);
      if (!priceEntry) {
        missingTickers.push(tickerUpper);
        continue;
      }

      if (typeof priceEntry.price !== "number" || !Number.isFinite(priceEntry.price) || priceEntry.price <= 0) {
        invalidPrices.push({ ticker: tickerUpper, price: priceEntry.price });
        continue;
      }

      finalPrice = priceEntry.price;
      currency = priceEntry.currency ?? (isUSD ? "USD" : "BRL");
      source = priceEntry.source ?? "api";
    }

    validatedPricesMap.set(tickerUpper, {
      ticker: tickerUpper,
      price: finalPrice,
      currency,
      source,
    });

    const costBRL = asset.quantity * asset.average_price * fxRate;
    const valueBRL = isCash ? asset.quantity : asset.quantity * finalPrice * fxRate;

    totalCostCents += Math.round(costBRL * 100);
    totalValueCents += Math.round(valueBRL * 100);
  }

  const hasErrors = missingTickers.length > 0 || invalidPrices.length > 0;

  if (hasErrors) {
    const errorParts: string[] = [];
    if (missingTickers.length > 0) {
      errorParts.push(`Ativos sem cotação: ${missingTickers.join(", ")}`);
    }
    if (invalidPrices.length > 0) {
      errorParts.push(`Cotações não-positivas: ${invalidPrices.map((p) => `${p.ticker} (${p.price})`).join(", ")}`);
    }

    return {
      isValid: false,
      missingTickers,
      invalidPrices,
      validatedPrices: Array.from(validatedPricesMap.values()),
      totalValue: totalValueCents / 100,
      totalCost: totalCostCents / 100,
      reason: errorParts.join(". "),
    };
  }

  return {
    isValid: true,
    missingTickers: [],
    invalidPrices: [],
    validatedPrices: Array.from(validatedPricesMap.values()),
    totalValue: totalValueCents / 100,
    totalCost: totalCostCents / 100,
  };
}
