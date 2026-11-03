/**
 * Resolução e priorização de cotações históricas para fechamento mensal (§F10/F40).
 *
 * Cascata de Prioridades (Padrão ANBIMA / Resiliência Quantitativa):
 * 1. manual: Cotação explicitamente informada ou editada pelo investidor no fechamento;
 * 2. api: Cotação oficial de fechamento do último pregão do mês obtida via API;
 * 3. fallback: Preço praticado na última movimentação (compra/venda) realizada no mês;
 * 4. estimate: Cotação atual (hoje) com flag de estimativa e status sugerido.
 */

import type { MonthlyPriceRow, MonthlyPriceSource } from "@/types";

export interface ResolvedHistoricalQuote {
  ticker: string;
  price: number;
  currency: "BRL" | "USD";
  source: MonthlyPriceSource;
  isEstimate: boolean;
  badgeLabel: "Oficial API" | "Manual" | "Sugerida";
}

export interface ResolveHistoricalQuoteParams {
  ticker: string;
  currency?: "BRL" | "USD";
  savedMonthlyPrice?: MonthlyPriceRow | null;
  apiClosePrice?: number | null;
  lastTransactionPriceInMonth?: number | null;
  currentLivePrice?: number | null;
}

export function resolveHistoricalQuotePriority(
  params: ResolveHistoricalQuoteParams,
): ResolvedHistoricalQuote {
  const normalizedTicker = params.ticker.toUpperCase().trim();
  const currency = params.currency ?? "BRL";

  // Prioridade 1 & 2: Registro salvo no banco (manual ou api)
  if (params.savedMonthlyPrice && params.savedMonthlyPrice.price > 0) {
    const isManual = params.savedMonthlyPrice.source === "manual";
    return {
      ticker: normalizedTicker,
      price: Math.round(params.savedMonthlyPrice.price * 10000) / 10000,
      currency: params.savedMonthlyPrice.currency ?? currency,
      source: params.savedMonthlyPrice.source,
      isEstimate: false,
      badgeLabel: isManual ? "Manual" : "Oficial API",
    };
  }

  // Prioridade 2: Cotação oficial de API obtida na consulta de fechamento
  if (params.apiClosePrice !== undefined && params.apiClosePrice !== null && params.apiClosePrice > 0) {
    return {
      ticker: normalizedTicker,
      price: Math.round(params.apiClosePrice * 10000) / 10000,
      currency,
      source: "api",
      isEstimate: false,
      badgeLabel: "Oficial API",
    };
  }

  // Prioridade 3: Fallback baseado no preço da última transação no mês
  if (
    params.lastTransactionPriceInMonth !== undefined &&
    params.lastTransactionPriceInMonth !== null &&
    params.lastTransactionPriceInMonth > 0
  ) {
    return {
      ticker: normalizedTicker,
      price: Math.round(params.lastTransactionPriceInMonth * 10000) / 10000,
      currency,
      source: "fallback",
      isEstimate: true,
      badgeLabel: "Sugerida",
    };
  }

  // Prioridade 4: Cotação atual de mercado estimada
  if (params.currentLivePrice !== undefined && params.currentLivePrice !== null && params.currentLivePrice > 0) {
    return {
      ticker: normalizedTicker,
      price: Math.round(params.currentLivePrice * 10000) / 10000,
      currency,
      source: "fallback",
      isEstimate: true,
      badgeLabel: "Sugerida",
    };
  }

  // Fallback seguro quando não há referências: preço 0
  return {
    ticker: normalizedTicker,
    price: 0,
    currency,
    source: "fallback",
    isEstimate: true,
    badgeLabel: "Sugerida",
  };
}
