/**
 * Serviço de busca e sincronização de cotações online no cliente — ESPECIFICAÇÃO §1.6 (D5).
 *
 * Utiliza APIs com suporte nativo a CORS e fallback em cascata:
 * 1. Brapi (brapi.dev) para ações/FIIs/BDRs da B3;
 * 2. AwesomeAPI para cotações cambiais (USD-BRL);
 * 3. Yahoo Finance Chart API v8 em cascata.
 */

import {
  isCashAssetClass,
  normalizeTickerForApi,
  normalizeTickerForBrapi,
  parseAwesomeApiResponse,
  parseBrapiResponse,
  parseYahooChartResponse,
  type ParsedQuote,
} from "@/domain/portfolio";
import { setAssetPriceFromApi, setAssetPricesBatchFromApi } from "@/data/repositories/asset-prices";

const FETCH_TIMEOUT_MS = 5_000;

/** Busca cotação na API Brapi (ações/FIIs/BDRs). */
async function fetchBrapi(ticker: string): Promise<ParsedQuote | null> {
  const cleanTicker = normalizeTickerForBrapi(ticker);
  if (!cleanTicker || cleanTicker.includes("=")) return null;

  const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return parseBrapiResponse(ticker, payload);
  } catch {
    return null;
  }
}

/** Busca cotação cambial USD-BRL na AwesomeAPI. */
async function fetchAwesomeApi(ticker: string): Promise<ParsedQuote | null> {
  const url = "https://economia.awesomeapi.com.br/last/USD-BRL";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return parseAwesomeApiResponse(ticker, payload);
  } catch {
    return null;
  }
}

/** Busca cotação no Yahoo Finance Chart API v8. */
async function fetchYahoo(ticker: string): Promise<ParsedQuote | null> {
  const apiTicker = normalizeTickerForApi(ticker);
  if (!apiTicker) return null;

  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const host of hosts) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(apiTicker)}?interval=1d&range=1d`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      const parsed = parseYahooChartResponse(ticker, payload);
      if (parsed) return parsed;
    } catch {
      // continua para o próximo host
    }
  }
  return null;
}

/**
 * Busca a cotação online de um ticker através de fallback em cascata.
 */
export async function fetchOnlineQuote(ticker: string): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "USDBRL=X" || normalized === "USD-BRL" || normalized === "USDBRL") {
    const awesome = await fetchAwesomeApi(ticker);
    if (awesome) return awesome;
    return await fetchYahoo(ticker);
  }

  // Tenta Brapi primeiro para B3
  const brapi = await fetchBrapi(ticker);
  if (brapi) return brapi;

  // Fallback para Yahoo
  return await fetchYahoo(ticker);
}

/**
 * Busca a cotação de um ativo e a persiste no cache do usuário se for bem-sucedida.
 */
export async function syncQuoteForTicker(
  ticker: string,
  assetClass?: string | null,
): Promise<ParsedQuote | null> {
  if (isCashAssetClass(assetClass ?? null)) return null;

  const quote = await fetchOnlineQuote(ticker);
  if (quote && quote.price > 0) {
    try {
      await setAssetPriceFromApi(quote.ticker, quote.price, quote.currency);
    } catch {
      // Ignora erro de persistência (degradação graciosa)
    }
    return quote;
  }
  return null;
}

/**
 * Sincroniza em lote as cotações de uma lista de ativos.
 * Retorna o total de ativos atualizados com sucesso.
 */
export async function syncQuotesForAssets(
  assets: { ticker: string; asset_class?: string | null }[],
): Promise<number> {
  const eligible = assets.filter((a) => !isCashAssetClass(a.asset_class ?? null));
  if (eligible.length === 0) return 0;

  const results = await Promise.allSettled(
    eligible.map((a) => fetchOnlineQuote(a.ticker)),
  );

  const successfulQuotes: ParsedQuote[] = [];
  for (const res of results) {
    if (res.status === "fulfilled" && res.value !== null && res.value.price > 0) {
      successfulQuotes.push(res.value);
    }
  }

  if (successfulQuotes.length > 0) {
    try {
      await setAssetPricesBatchFromApi(
        successfulQuotes.map((q) => ({
          ticker: q.ticker,
          price: q.price,
          currency: q.currency,
        })),
      );
    } catch {
      // Degradação graciosa: segue sem lançar erro de persistência em lote
    }
  }

  return successfulQuotes.length;
}

