/**
 * Motor puro de cotações de mercado — ESPECIFICAÇÃO §1.6 (D5) e §3.11.2.
 *
 * Funções puras sem I/O para normalização e parsing de respostas de APIs
 * de cotações (Brapi, AwesomeAPI, Yahoo Finance).
 */

import type { AssetCurrency } from "@/types";

export type QuoteCurrency = "BRL" | "USD";

export interface ParsedQuote {
  ticker: string;
  price: number;
  currency: AssetCurrency;
}

/**
 * Normaliza o ticker armazenado para o formato da API Yahoo Finance:
 *   • B3 com número (PETR4, BOVA11, IVVB11) → sufixo `.SA`;
 *   • já com sufixo/`=`/`-` (PETR4.SA, USDBRL=X, BTC-BRL) → mantém;
 *   • internacional puro 2–5 letras (AAPL, MSFT) → mantém.
 * Retorna "" para entrada vazia.
 */
export function normalizeTickerForApi(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return "";
  if (ticker.endsWith(".SA")) return ticker;
  if (ticker.includes("=") || ticker.includes("-") || ticker.includes(".")) return ticker;
  if (/^[A-Za-z]{2,5}$/.test(ticker)) return ticker;
  return `${ticker}.SA`;
}

/**
 * Normaliza o ticker para a API Brapi (remove sufixo `.SA` se presente).
 */
export function normalizeTickerForBrapi(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (ticker.endsWith(".SA")) return ticker.slice(0, -3);
  return ticker;
}

/**
 * Extrai { price, currency } do payload da API Brapi (`/api/quote/{ticker}`).
 * Payload típico: { results: [{ symbol: "PETR4", regularMarketPrice: 38.5, currency: "BRL" }] }
 */
export function parseBrapiResponse(ticker: string, payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const results = (payload as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const item = results[0];
  if (!item || typeof item !== "object") return null;
  const itemRecord = item as Record<string, unknown>;
  const rawPrice = itemRecord.regularMarketPrice ?? itemRecord.price;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  const rawCurrency = itemRecord.currency;
  return {
    ticker,
    price: priceNum,
    currency: rawCurrency === "USD" ? "USD" : "BRL",
  };
}

/**
 * Extrai a cotação cambial da AwesomeAPI (`/last/USD-BRL`).
 * Payload típico: { USDBRL: { bid: "5.45" } }
 */
export function parseAwesomeApiResponse(ticker: string, payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const pairKey = Object.keys(record).find((key) => !key.startsWith("_"));
  if (!pairKey) return null;
  const data = record[pairKey];
  if (!data || typeof data !== "object") return null;
  const dataRecord = data as Record<string, unknown>;
  const rawPrice = dataRecord.bid ?? dataRecord.ask;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  return {
    ticker,
    price: priceNum,
    currency: "BRL",
  };
}

/**
 * Extrai { price, currency } do payload da Yahoo Chart API v8
 * (`/v8/finance/chart/{ticker}` → `chart.result[0].meta`).
 * Retorna null para payloads inválidos/incompletos ou preço não-positivo.
 */
export function parseYahooChartResponse(ticker: string, payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const chart = (payload as Record<string, unknown>).chart;
  if (!chart || typeof chart !== "object") return null;
  const result = (chart as Record<string, unknown>).result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const meta = (result[0] as Record<string, unknown> | undefined)?.meta;
  if (!meta || typeof meta !== "object") return null;
  const rawPrice = (meta as Record<string, unknown>).regularMarketPrice;
  if (typeof rawPrice !== "number" || !Number.isFinite(rawPrice) || rawPrice <= 0) return null;
  const rawCurrency = (meta as Record<string, unknown>).currency;
  return {
    ticker,
    price: rawPrice,
    currency: rawCurrency === "USD" ? "USD" : "BRL",
  };
}
