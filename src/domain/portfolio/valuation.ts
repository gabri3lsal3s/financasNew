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

import type { AssetCurrency, FixedIncomeMetadata } from "@/types";
import { calculateFixedIncomeBalance, type FixedIncomeBalanceResult } from "./fixed-income";

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

export interface ConsolidatedPositionSummary {
  quantity: number;
  averagePrice: number;
  totalCost: number;
  totalCostBRL: number;
  averagePriceBRL: number;
  /** Preço de mercado na moeda nativa do ativo (USD ou BRL). */
  priceQuote: number;
  priceBRL: number;
  valueBRL: number;
  source: PriceSource;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  /** Total de proventos na moeda nativa do ativo (USD ou BRL). */
  totalDividends: number;
  /** Total de proventos convertidos para BRL. */
  totalDividendsBRL: number;
  totalReturnPnl: number;
  totalReturnPct: number | null;
  isCash: boolean;
  pricingMode: AssetPricingMode;
  /** Valor Líquido estimado após deduções de IR/IOF (Fase 63). */
  netValueBRL?: number;
  /** Imposto de Renda retido na fonte estimado (Fase 63). */
  taxAmountBRL?: number;
  /** Alíquota de IR aplicada (22.5%, 20%, 17.5%, 15% ou 0%). */
  taxRatePct?: number;
  /** Trava de Vencimento e diagnóstico de maturidade (Fase 63). */
  isMatured?: boolean;
  maturityDate?: string | null;
  fixedIncomeResult?: FixedIncomeBalanceResult | null;
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
const FIXED_INCOME_CLASS_ALIASES = new Set([
  "renda fixa",
  "rendafixa",
  "rf",
  "cdb",
  "lci",
  "lca",
  "cri",
  "cra",
  "debenture",
  "debentures",
  "lc",
  "rdb",
  "tesouro",
  "titulos",
]);

/**
 * Ativo de caixa/reserva (§3.11.2): valor 1:1 (quantidade = valor).
 * Reconhecido pela classe (normalizada, sem acento): "caixa"/"reserva".
 */
export function isCashAssetClass(assetClass: string | null | undefined): boolean {
  if (!assetClass) return false;
  return CASH_CLASS_ALIASES.has(normalizeClassName(assetClass));
}

/**
 * Ativo de Renda Fixa: CDB, LCI, LCA, CRI, CRA, Debêntures, Tesouro, etc.
 */
export function isFixedIncomeClass(assetClass: string | null | undefined): boolean {
  if (!assetClass) return false;
  const norm = normalizeClassName(assetClass);
  return FIXED_INCOME_CLASS_ALIASES.has(norm) || norm.includes("renda fixa") || norm.includes("tesouro");
}

/**
 * Identifica se o ativo é Tesouro Direto (pelo ticker ou pela classe).
 */
export function isTesouroAsset(ticker: string | null | undefined, assetClass?: string | null): boolean {
  const normTicker = (ticker ?? "").trim().toUpperCase();
  if (
    normTicker.startsWith("TESOURO") ||
    normTicker.includes("TESOURO") ||
    normTicker === "LFT" ||
    normTicker === "NTNB" ||
    normTicker === "LTN"
  ) {
    return true;
  }
  if (assetClass) {
    const normClass = normalizeClassName(assetClass);
    if (normClass.includes("tesouro")) return true;
  }
  return false;
}

export type AssetPricingMode = "cash" | "total_value" | "unit_price";

/**
 * Determina o modo de precificação do ativo:
 * - "cash": Caixa/Reserva 1:1
 * - "total_value": Renda Fixa e Tesouro Direto (Preço Inicial e Preço Atual / Saldo)
 * - "unit_price": Renda Variável (Ações, FIIs, etc. - Quantidade de Cotas e Preço Médio)
 */
export function getAssetPricingMode(asset: {
  ticker?: string | null;
  asset_class?: string | null;
  notes?: string | null;
}): AssetPricingMode {
  if (isCashAssetClass(asset.asset_class)) {
    return "cash";
  }
  if (isFixedIncomeClass(asset.asset_class) || isTesouroAsset(asset.ticker, asset.asset_class)) {
    return "total_value";
  }
  return "unit_price";
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
 * 1–5 letras sem números = USD (ex.: AAPL, MSFT, O, T; IVVB11 tem número → BRL);
 * B3/RF/cripto = BRL.
 */
export function inferCurrencyFromTicker(ticker: string): AssetCurrency {
  return /^[A-Za-z]{1,5}$/.test(ticker) ? "USD" : "BRL";
}

export interface PositionPnl {
  /** Lucro/prejuízo de capital não realizado em BRL: valor de mercado − custo total. */
  unrealizedPnl: number;
  /**
   * Variação % da cotação sobre o custo (÷ custo total). `null` quando não há
   * custo (ex.: caixa/reserva 1:1 — o conceito de rentabilidade não se aplica).
   */
  unrealizedPct: number | null;
  /** Total de proventos recebidos em BRL (dividendos, JCP, rendimentos). */
  totalDividends: number;
  /** Resultado total acumulado em BRL: (valor de mercado − custo total) + proventos. */
  totalReturnPnl: number;
  /**
   * Retorno Total % sobre o custo: ((valor − custo) + proventos) ÷ custo.
   * `null` quando não há custo (ex.: caixa).
   */
  totalReturnPct: number | null;
}

/**
 * Rentabilidade de uma posição (§F14): valor de mercado − custo total,
 * variação de cotação e Retorno Total considerando proventos recebidos.
 * Função pura — a UI só exibe os valores.
 */
export function positionPnl(
  valueBRL: number,
  totalCost: number,
  totalDividends: number = 0,
): PositionPnl {
  const unrealizedPnl = Math.round((valueBRL - totalCost) * 100) / 100;
  const unrealizedPct = totalCost > 0 ? Math.round((unrealizedPnl / totalCost) * 10000) / 100 : null;
  const safeDividends = Math.max(0, Math.round(totalDividends * 100) / 100);
  const totalReturnPnl = Math.round((unrealizedPnl + safeDividends) * 100) / 100;
  const totalReturnPct = totalCost > 0 ? Math.round((totalReturnPnl / totalCost) * 10000) / 100 : null;
  return {
    unrealizedPnl,
    unrealizedPct,
    totalDividends: safeDividends,
    totalReturnPnl,
    totalReturnPct,
  };
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

/**
 * Valoração direta da posição consolidada (Fase 36 & Fase 63 — O(1) sem ledger transacional).
 */
export function calculatePositionSummary(params: {
  quantity: number;
  averagePrice: number;
  assetClass: string | null;
  currency: AssetCurrency;
  resolvedPrice: ResolvedPrice;
  usdRate?: number;
  ticker?: string;
  notes?: string | null;
  pricingMode?: AssetPricingMode;
  totalDividends?: number;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  today?: string;
  annualCdiRate?: number;
}): ConsolidatedPositionSummary {
  const {
    quantity,
    averagePrice,
    assetClass,
    currency,
    resolvedPrice,
    usdRate = FALLBACK_USD_RATE,
    ticker,
    notes,
    pricingMode: explicitPricingMode,
    totalDividends = 0,
    fixedIncomeMetadata,
    today,
    annualCdiRate,
  } = params;

  const effectivePricingMode =
    explicitPricingMode ??
    getAssetPricingMode({
      ticker,
      asset_class: assetClass,
      notes,
    });

  const rate = currency === "USD" ? usdRate : 1;
  const safeDividendsNative = Math.max(0, Math.round(totalDividends * 100) / 100);
  const totalDividendsBRL = Math.round(safeDividendsNative * rate * 100) / 100;

  if (effectivePricingMode === "cash") {
    const valueBRL = Math.round(quantity * 100) / 100;
    return {
      quantity,
      averagePrice: 1,
      totalCost: valueBRL,
      totalCostBRL: valueBRL,
      averagePriceBRL: 1,
      priceQuote: 1,
      priceBRL: 1,
      valueBRL,
      source: "fallback",
      unrealizedPnl: 0,
      unrealizedPct: null,
      totalDividends: 0,
      totalDividendsBRL: 0,
      totalReturnPnl: 0,
      totalReturnPct: null,
      isCash: true,
      pricingMode: "cash",
    };
  }

  if (effectivePricingMode === "total_value") {
    // Modo Valor Completo (Renda Fixa / Tesouro Direto):
    const initialCost =
      quantity > 0 && quantity !== 1 && averagePrice > 0
        ? Math.round(quantity * averagePrice * 100) / 100
        : averagePrice > 0 && averagePrice !== 1
          ? averagePrice
          : quantity > 0
            ? quantity
            : averagePrice;

    // Se a posição foi resgatada/zerada integralmente, o saldo e custo em custódia são 0:
    if (initialCost <= 0 || (quantity === 0 && averagePrice === 0)) {
      return {
        quantity: 0,
        averagePrice: 0,
        totalCost: 0,
        totalCostBRL: 0,
        averagePriceBRL: 0,
        priceQuote: 0,
        priceBRL: 0,
        valueBRL: 0,
        netValueBRL: 0,
        taxAmountBRL: 0,
        taxRatePct: 0,
        isMatured: Boolean(fixedIncomeMetadata?.maturity_date),
        maturityDate: fixedIncomeMetadata?.maturity_date ?? null,
        fixedIncomeResult: null,
        source: resolvedPrice.source,
        unrealizedPnl: 0,
        unrealizedPct: null,
        totalDividends: safeDividendsNative,
        totalDividendsBRL,
        totalReturnPnl: totalDividendsBRL,
        totalReturnPct: null,
        isCash: false,
        pricingMode: "total_value",
      };
    }

    const totalCost = Math.round(initialCost * rate * 100) / 100;
    const totalCostBRL = totalCost;
    const averagePriceBRL = totalCost;

    // Se possui parametrização Marco Zero (Fase 63), calcula a evolução contábil diária
    if (fixedIncomeMetadata) {
      const baseValue =
        fixedIncomeMetadata.base_value !== undefined &&
        fixedIncomeMetadata.base_value !== null &&
        fixedIncomeMetadata.base_value > 0
          ? fixedIncomeMetadata.base_value
          : initialCost;

      const fiResult = calculateFixedIncomeBalance({
        baseValue,
        baseDate: fixedIncomeMetadata.base_date,
        initialInvestmentDate: fixedIncomeMetadata.initial_investment_date,
        maturityDate: fixedIncomeMetadata.maturity_date,
        rateType: fixedIncomeMetadata.rate_type,
        rateValue: fixedIncomeMetadata.rate_value,
        isTaxExempt: fixedIncomeMetadata.is_tax_exempt,
        manualTaxRatePct: fixedIncomeMetadata.manual_tax_rate_pct,
        totalCost,
        annualCdiRate,
        today,
      });

      const pnl = positionPnl(fiResult.grossValue, totalCostBRL, totalDividendsBRL);

      return {
        quantity: 1,
        averagePrice: initialCost,
        totalCost,
        totalCostBRL,
        averagePriceBRL,
        priceQuote: fiResult.grossValue,
        priceBRL: fiResult.grossValue,
        valueBRL: fiResult.grossValue,
        netValueBRL: fiResult.netValue,
        taxAmountBRL: fiResult.taxAmount,
        taxRatePct: fiResult.taxRatePct,
        isMatured: fiResult.isMatured,
        maturityDate: fixedIncomeMetadata.maturity_date,
        fixedIncomeResult: fiResult,
        source: "api",
        unrealizedPnl: pnl.unrealizedPnl,
        unrealizedPct: pnl.unrealizedPct,
        totalDividends: safeDividendsNative,
        totalDividendsBRL,
        totalReturnPnl: pnl.totalReturnPnl,
        totalReturnPct: pnl.totalReturnPct,
        isCash: false,
        pricingMode: "total_value",
      };
    }

    const currentPrice = resolvedPrice.price > 0 ? resolvedPrice.price : initialCost;
    const priceBRL = Math.round(currentPrice * rate * 100) / 100;
    const valueBRL = priceBRL;
    const pnl = positionPnl(valueBRL, totalCostBRL, totalDividendsBRL);

    return {
      quantity: 1,
      averagePrice: initialCost,
      totalCost,
      totalCostBRL,
      averagePriceBRL,
      priceQuote: currentPrice,
      priceBRL,
      valueBRL,
      source: resolvedPrice.source,
      unrealizedPnl: pnl.unrealizedPnl,
      unrealizedPct: pnl.unrealizedPct,
      totalDividends: safeDividendsNative,
      totalDividendsBRL,
      totalReturnPnl: pnl.totalReturnPnl,
      totalReturnPct: pnl.totalReturnPct,
      isCash: false,
      pricingMode: "total_value",
    };
  }

  // Modo Preço Unitário (Ações, FIIs, BDRs, Cripto, etc.):
  const priceBRL = Math.round(resolvedPrice.price * rate * 100) / 100;

  if (quantity <= 0) {
    return {
      quantity: 0,
      averagePrice: 0,
      totalCost: 0,
      totalCostBRL: 0,
      averagePriceBRL: 0,
      priceQuote: resolvedPrice.price,
      priceBRL,
      valueBRL: 0,
      source: resolvedPrice.source,
      unrealizedPnl: 0,
      unrealizedPct: null,
      totalDividends: safeDividendsNative,
      totalDividendsBRL,
      totalReturnPnl: totalDividendsBRL,
      totalReturnPct: null,
      isCash: false,
      pricingMode: "unit_price",
    };
  }

  const totalCost = Math.round(quantity * averagePrice * 100) / 100;
  const totalCostBRL = Math.round(totalCost * rate * 100) / 100;
  const averagePriceBRL = Math.round(averagePrice * rate * 100) / 100;
  const valueBRL = Math.round(quantity * priceBRL * 100) / 100;
  const pnl = positionPnl(valueBRL, totalCostBRL, totalDividendsBRL);

  return {
    quantity,
    averagePrice,
    totalCost,
    totalCostBRL,
    averagePriceBRL,
    priceQuote: resolvedPrice.price,
    priceBRL,
    valueBRL,
    source: resolvedPrice.source,
    unrealizedPnl: pnl.unrealizedPnl,
    unrealizedPct: pnl.unrealizedPct,
    totalDividends: safeDividendsNative,
    totalDividendsBRL,
    totalReturnPnl: pnl.totalReturnPnl,
    totalReturnPct: pnl.totalReturnPct,
    isCash: false,
    pricingMode: "unit_price",
  };
}
