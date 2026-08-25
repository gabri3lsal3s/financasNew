/**
 * Serviço de busca e sincronização de cotações online no cliente — ESPECIFICAÇÃO §1.6 (D5).
 *
 * Utiliza APIs com suporte a CORS e fallback em cascata:
 * 1. AwesomeAPI para câmbio (USD-BRL, EUR-BRL) e cripto (BTC-BRL, ETH-BRL);
 * 2. Brapi (brapi.dev) para ações/FIIs/BDRs da B3;
 * 3. Yahoo Finance Chart API v8 via proxies CORS públicos abertos (AllOrigins, CorsProxy, CodeTabs);
 * 4. Supabase Edge Function `quotes` como backend gateway.
 */

import {
  isCashAssetClass,
  normalizeTesouroTicker,
  normalizeTickerForApi,
  normalizeTickerForBrapi,
  parseAwesomeApiResponse,
  parseBcbSgsResponse,
  parseBrapiResponse,
  parseTesouroDiretoResponse,
  parseYahooChartResponse,
  type ParsedQuote,
} from "@/domain/portfolio";
import { setAssetPriceFromApi, setAssetPricesBatchFromApi } from "@/data/repositories/asset-prices";
import { getSupabase } from "@/data/client";

const FETCH_TIMEOUT_MS = 5_000;

/** Cache de taxas de indexadores (CDI / Selic) para 6 horas */
let bcbRateCache: { cdiAnnual?: number; selicAnnual?: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Busca taxas macroeconômicas oficiais do Banco Central (SGS).
 *   • Série 12: CDI Diário
 *   • Série 432: Selic Meta (% a.a.)
 */
export async function fetchBcbIndicator(indicator: "CDI" | "SELIC"): Promise<number | null> {
  const now = Date.now();
  if (bcbRateCache && now - bcbRateCache.timestamp < CACHE_TTL_MS) {
    if (indicator === "CDI" && bcbRateCache.cdiAnnual !== undefined) return bcbRateCache.cdiAnnual;
    if (indicator === "SELIC" && bcbRateCache.selicAnnual !== undefined) return bcbRateCache.selicAnnual;
  }

  const serie = indicator === "CDI" ? 12 : 432;
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const parsed = parseBcbSgsResponse(payload);
    if (parsed && parsed.rateAnnual !== undefined) {
      if (!bcbRateCache) bcbRateCache = { timestamp: now };
      if (indicator === "CDI") bcbRateCache.cdiAnnual = parsed.rateAnnual;
      if (indicator === "SELIC") bcbRateCache.selicAnnual = parsed.rateAnnual;
      bcbRateCache.timestamp = now;
      return parsed.rateAnnual;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca a cotação oficial (Preço Unitário / PU) de títulos do Tesouro Direto.
 */
async function fetchTesouroDireto(ticker: string): Promise<ParsedQuote | null> {
  const tesouroCanon = normalizeTesouroTicker(ticker);
  if (!tesouroCanon) return null;

  const targetUrl = "https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json";
  const proxyEndpoints = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
    targetUrl,
  ];

  for (const url of proxyEndpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      const parsed = parseTesouroDiretoResponse(tesouroCanon, payload);
      if (parsed && parsed.price > 0) {
        return {
          ticker,
          price: parsed.price,
          currency: "BRL",
        };
      }
    } catch {
      // Tenta próximo endpoint
    }
  }

  return null;
}

/** Busca cotação na API Brapi (ações/FIIs/BDRs). */
async function fetchBrapi(ticker: string): Promise<ParsedQuote | null> {
  const cleanTicker = normalizeTickerForBrapi(ticker);
  if (!cleanTicker || cleanTicker.includes("=")) return null;

  const token =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_BRAPI_TOKEN
      ? `?token=${encodeURIComponent(import.meta.env.VITE_BRAPI_TOKEN)}`
      : "";
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}${token}`;
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

/** Busca cotação na AwesomeAPI (Câmbio USD-BRL, EUR-BRL e Cripto BTC-BRL, ETH-BRL com CORS aberto). */
async function fetchAwesomeApi(ticker: string): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  let pair: string;
  if (normalized === "USDBRL=X" || normalized === "USD-BRL" || normalized === "USDBRL") {
    pair = "USD-BRL";
  } else if (normalized === "EURBRL=X" || normalized === "EUR-BRL" || normalized === "EURBRL") {
    pair = "EUR-BRL";
  } else if (normalized === "BTC" || normalized === "BTC-BRL" || normalized === "BTCBRL") {
    pair = "BTC-BRL";
  } else if (normalized === "ETH" || normalized === "ETH-BRL" || normalized === "ETHBRL") {
    pair = "ETH-BRL";
  } else {
    return null;
  }

  const url = `https://economia.awesomeapi.com.br/last/${pair}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const parsed = parseAwesomeApiResponse(ticker, payload);
    if (parsed) {
      return { ...parsed, ticker };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca cotação no Yahoo Finance Chart API v8 contornando restrições de CORS
 * do navegador através de gateways CORS públicos e rotação de hosts.
 */
async function fetchYahoo(ticker: string): Promise<ParsedQuote | null> {
  const apiTicker = normalizeTickerForApi(ticker);
  if (!apiTicker) return null;

  const targetYahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(apiTicker)}?interval=1d&range=1d`;

  // Em navegadores clientes, chamadas diretas ao Yahoo sofrem bloqueio Same-Origin (CORS).
  // Os proxies CORS transparentes abaixo resolvem o bloqueio e retornam o JSON oficial.
  const proxyEndpoints = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetYahooUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(targetYahooUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetYahooUrl)}`,
    targetYahooUrl,
  ];

  for (const url of proxyEndpoints) {
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
      // Continua para o próximo endpoint/proxy da cascata
    }
  }
  return null;
}

/** Tenta buscar via Supabase Edge Function se estiver disponível */
async function fetchViaEdgeFunction(tickers: string[]): Promise<ParsedQuote[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke("quotes", {
      body: { tickers },
    });
    if (error || !data || !Array.isArray(data.quotes)) return [];
    return data.quotes as ParsedQuote[];
  } catch {
    return [];
  }
}

/**
 * Busca a cotação online de um ticker através de fallback em cascata.
 */
export async function fetchOnlineQuote(ticker: string): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;

  // 1. AwesomeAPI primeiro para Câmbio e Cripto (CORS aberto, altíssima velocidade)
  const awesome = await fetchAwesomeApi(normalized);
  if (awesome) return awesome;

  // 2. Tesouro Direto oficial se for título público federal
  if (normalizeTesouroTicker(normalized)) {
    const tesouro = await fetchTesouroDireto(normalized);
    if (tesouro) return tesouro;
  }

  // 3. Brapi para B3 (se token configurado ou público)
  const brapi = await fetchBrapi(ticker);
  if (brapi) return brapi;

  // 4. Yahoo Finance com CORS Gateway
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
 * Sincroniza em lote as cotações de uma lista de ativos + câmbio USDBRL=X.
 * Retorna o total de ativos atualizados com sucesso.
 */
export async function syncQuotesForAssets(
  assets: { ticker: string; asset_class?: string | null }[],
): Promise<number> {
  const eligible = assets.filter((a) => !isCashAssetClass(a.asset_class ?? null));

  // Garante que a cotação do dólar USDBRL=X seja sempre sincronizada
  const tickersToFetch = new Set(eligible.map((a) => a.ticker.trim().toUpperCase()));
  tickersToFetch.add("USDBRL=X");

  const tickerList = [...tickersToFetch];

  // Tenta primeiro a Edge Function (servidor com acesso direto ao Yahoo)
  const edgeQuotes = await fetchViaEdgeFunction(tickerList);
  if (edgeQuotes.length > 0) {
    const userAssetUpdatedCount = edgeQuotes.filter((q) => q.ticker !== "USDBRL=X").length;
    return userAssetUpdatedCount > 0 ? userAssetUpdatedCount : edgeQuotes.length;
  }

  // Fallback client-side paralelo em cascata
  const results = await Promise.allSettled(tickerList.map((t) => fetchOnlineQuote(t)));

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

  const userAssetUpdatedCount = successfulQuotes.filter((q) => q.ticker !== "USDBRL=X").length;
  return userAssetUpdatedCount > 0 ? userAssetUpdatedCount : successfulQuotes.length;
}
