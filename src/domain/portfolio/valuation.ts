/**
 * Valoração de ativos — ESPECIFICAÇÃO §1.6 (D5) e §3.11.2.
 *
 * Pipeline de resiliência (nunca bloqueia o rebalanceamento):
 *   1. Preço manual (override do usuário — prevalece e é marcado na UI);
 *   2. Cache em servidor (tabela asset_prices, fonte `api`);
 *   3. Fallback estático (ex.: USD 5,25) — marcado como `fallback`.
 *
 * Guardrail de spike: variação > 50% em 1 dia mantém o último preço válido
 * (proteção contra dado corrompido de API).
 *
 * Motor puro — testável isoladamente.
 */

import type { AssetCurrency } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type PriceSource = "manual" | "api" | "fallback";

export interface PriceCandidate {
  /** Preço do override manual do usuário (coluna `manual_price`). */
  manualPrice: number | null;
  /** Preço do cache em servidor (coluna `price`, fonte `api`). */
  cachePrice: number | null;
  /** Preço do fallback estático por moeda (ex.: USD 5,25). */
  fallbackPrice: number | null;
}

export interface ResolvedPrice {
  price: number;
  source: PriceSource;
}

export interface AssetValuation {
  /** Valor de mercado em BRL (já convertido quando USD). */
  valueBRL: number;
  /** Fonte do preço usado (manual / api / fallback). */
  source: PriceSource;
  /** true quando o preço veio do override manual do usuário. */
  manual: boolean;
}

/** Fallback estático de conversão USD→BRL (§1.6 / §4.2). */
export const FALLBACK_USD_RATE = 5.25;

/**
 * Normaliza o nome de uma classe para comparação (caixa, acentos):
 * "Ações" → "acoes", "FIIs" → "fiis". Usada pelas travas setoriais
 * e pelo reconhecimento de caixa (DRY).
 */
export function normalizeClassName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Taxa USD→BRL a partir do cache de cotações (ticker `USDBRL=X`).
 * Sem cotação disponível → fallback estático (5,25).
 */
export function usdRateFromPrices(
  prices: readonly { ticker: string; price: number }[],
  fallback: number = FALLBACK_USD_RATE,
): number {
  const row = prices.find((p) => p.ticker.toUpperCase() === "USDBRL=X");
  const rate = row?.price;
  return rate !== undefined && rate !== null && rate > 0 ? rate : fallback;
}

const CASH_CLASS_ALIASES = new Set(["caixa", "reserva"]);

/**
 * Ativo de caixa/reserva (§3.11.2): valor 1:1 (quantidade = valor).
 * Reconhecido pela classe (normalizada, sem acento): "caixa"/"reserva".
 */
export function isCashAssetClass(assetClass: string | null): boolean {
  if (!assetClass) return false;
  return CASH_CLASS_ALIASES.has(normalizeClassName(assetClass));
}

/** Preço de fallback por moeda (sem dado de cache nem manual). */
export function fallbackPriceFor(currency: AssetCurrency): number {
  return currency === "USD" ? FALLBACK_USD_RATE : 0;
}

/**
 * Resolve o preço de um ativo seguindo o pipeline de resiliência:
 * manual prevalece → cache (`api`) → fallback estático.
 */
export function resolvePrice(candidate: PriceCandidate): ResolvedPrice {
  if (candidate.manualPrice !== null && candidate.manualPrice !== undefined && candidate.manualPrice > 0) {
    return { price: candidate.manualPrice, source: "manual" };
  }
  if (candidate.cachePrice !== null && candidate.cachePrice !== undefined && candidate.cachePrice > 0) {
    return { price: candidate.cachePrice, source: "api" };
  }
  const fallback = candidate.fallbackPrice ?? 0;
  return { price: fallback, source: "fallback" };
}

/**
 * Guardrail de spike (§1.6): variação > 50% em 1 dia mantém o último preço
 * válido (proteção contra dado corrompido de API).
 * `previousPrice` pode ser null (primeira observação) → aceita o atual.
 */
export function applySpikeGuardrail(
  currentPrice: number,
  previousPrice: number | null,
): number {
  if (previousPrice === null || previousPrice === undefined || previousPrice <= 0) {
    return currentPrice;
  }
  if (currentPrice <= 0) {
    return previousPrice;
  }
  const variation = Math.abs(currentPrice - previousPrice) / previousPrice;
  return variation > 0.5 ? previousPrice : currentPrice;
}

/**
 * Moeda inferida pelo padrão do ticker (§3.11.2):
 * 2–5 letras sem números = USD (ex.: AAPL, MSFT, IVVB11 tem número → BRL);
 * B3/RF/cripto = BRL.
 */
export function inferCurrencyFromTicker(ticker: string): AssetCurrency {
  return /^[A-Za-z]{2,5}$/.test(ticker) ? "USD" : "BRL";
}

/**
 * Valoriza uma posição a partir do preço JÁ resolvido: valor de mercado na
 * moeda do ativo, convertido para BRL (reutiliza `convertToBRL` — DRY).
 * A fonte (`manual`/`api`/`fallback`) é a do preço resolvido.
 */
export function valueAssetPosition(
  quantity: number,
  resolved: ResolvedPrice,
  currency: AssetCurrency,
  usdRate: number = FALLBACK_USD_RATE,
): AssetValuation {
  const value = quantity * resolved.price;
  const valueBRL = currency === "USD" ? value * usdRate : value;
  return { valueBRL, source: resolved.source, manual: resolved.source === "manual" };
}
