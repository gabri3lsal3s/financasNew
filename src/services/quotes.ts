/**
 * Serviço de busca e sincronização de cotações online no cliente — ESPECIFICAÇÃO §1.6 (D5).
 *
 * Cascata segura (sem proxies CORS públicos de terceiros):
 * 1. Edge Function `quotes` (servidor) — preferencial em lote e no fallback;
 * 2. AwesomeAPI (câmbio/cripto com CORS próprio);
 * 3. Tesouro Direto (origem oficial);
 * 4. Brapi (B3).
 *
 * Persistência do usuário: `asset_prices` com user_id do dono.
 * Cache global só é escrito pelo cron com service role.
 */

import {
  isCashAssetClass,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  normalizeTesouroTicker,
  normalizeTickerForBrapi,
  parseAwesomeApiResponse,
  parseBcbSgsResponse,
  parseBrapiResponse,
  type ParsedQuote,
} from "@/domain/portfolio";
import { setAssetPriceFromApi, setAssetPricesBatchFromApi } from "@/data/repositories/asset-prices";
import { getSupabase } from "@/data/client";

const FETCH_TIMEOUT_MS = 5_000;

/** Cache de taxas de indexadores (CDI / Selic) para 6 horas */
let bcbRateCache: { cdiAnnual?: number; selicAnnual?: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Limite de cache para teste ou reset */
export function clearBcbCache(): void {
  bcbRateCache = null;
}

/**
 * Busca taxas macroeconômicas oficiais do Banco Central (SGS).
 *   • Série 12: CDI Diário
 *   • Série 432: Selic Meta (% a.a.)
 *
 * Apenas origem oficial (sem proxies de terceiros).
 */
export async function fetchBcbIndicator(indicator: "CDI" | "SELIC" | "IPCA"): Promise<number | null> {
  const now = Date.now();
  if (bcbRateCache && now - bcbRateCache.timestamp < CACHE_TTL_MS) {
    if (indicator === "CDI" && bcbRateCache.cdiAnnual !== undefined) return bcbRateCache.cdiAnnual;
    if (indicator === "SELIC" && bcbRateCache.selicAnnual !== undefined) return bcbRateCache.selicAnnual;
    if (indicator === "IPCA" && (bcbRateCache as Record<string, unknown>).ipcaAnnual !== undefined) {
      return (bcbRateCache as Record<string, unknown>).ipcaAnnual as number;
    }
  }

  const serie = indicator === "CDI" ? 12 : indicator === "SELIC" ? 432 : 13522;
  const targetUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const parsed = parseBcbSgsResponse(payload);
    if (parsed && parsed.rateAnnual !== undefined) {
      if (!bcbRateCache) bcbRateCache = { timestamp: now };
      if (indicator === "CDI") bcbRateCache.cdiAnnual = parsed.rateAnnual;
      if (indicator === "SELIC") bcbRateCache.selicAnnual = parsed.rateAnnual;
      if (indicator === "IPCA") (bcbRateCache as Record<string, unknown>).ipcaAnnual = parsed.rateAnnual;
      bcbRateCache.timestamp = now;
      return parsed.rateAnnual;
    }
  } catch {
    return null;
  }

  return null;
}

/** Busca cotação na API Brapi (ações/FIIs/BDRs). */
async function fetchBrapi(ticker: string): Promise<ParsedQuote | null> {
  const cleanTicker = normalizeTickerForBrapi(ticker);
  if (!cleanTicker || cleanTicker.includes("=") || cleanTicker.includes(" ")) return null;

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

/** Busca cotação na AwesomeAPI (Câmbio USD-BRL, EUR-BRL e Cripto BTC-BRL, ETH-BRL). */
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
 * Busca a cotação online de um ticker através de fallback em cascata segura.
 */
export async function fetchOnlineQuote(ticker: string): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;

  if (isPrivateFixedIncomeTicker(normalized)) return null;

  // 1. Edge (Yahoo/Brapi no servidor — sem proxies de terceiros no browser)
  const fromEdge = await fetchViaEdgeFunction([normalized]);
  const edgeHit = fromEdge.find((q) => q.ticker.toUpperCase() === normalized && q.price > 0);
  if (edgeHit) return edgeHit;

  // 2. AwesomeAPI para Câmbio e Cripto
  const awesome = await fetchAwesomeApi(normalized);
  if (awesome) return awesome;

  // 3. Tesouro Direto e Renda Fixa não são cotados via Brapi/bolsa
  if (isTesouroAsset(normalized) || Boolean(normalizeTesouroTicker(normalized))) {
    return null;
  }

  // 4. Brapi para ações/FIIs/BDRs B3
  return await fetchBrapi(ticker);
}

/**
 * Busca a cotação de um ativo e a persiste no cache do usuário se for bem-sucedida.
 */
export async function syncQuoteForTicker(
  ticker: string,
  assetClass?: string | null,
): Promise<ParsedQuote | null> {
  if (isCashAssetClass(assetClass ?? null)) return null;
  if (isPrivateFixedIncomeTicker(ticker)) return null;
  if (isFixedIncomeClass(assetClass ?? null) && !isTesouroAsset(ticker, assetClass)) return null;

  // Tesouro Direto: precificado pelo motor de renda fixa ou Edge Function, nunca via Brapi
  if (isTesouroAsset(ticker, assetClass) || Boolean(normalizeTesouroTicker(ticker))) {
    const fromEdge = await fetchViaEdgeFunction([ticker.trim().toUpperCase()]);
    const hit = fromEdge.find((q) => q.ticker.toUpperCase() === ticker.trim().toUpperCase() && q.price > 0);
    if (hit) {
      try {
        await setAssetPriceFromApi(hit.ticker, hit.price, hit.currency);
      } catch {
        // Ignora erro de persistência (degradação graciosa)
      }
      return hit;
    }
    return null;
  }

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
  const eligible = assets.filter((a) => {
    if (isCashAssetClass(a.asset_class ?? null)) return false;
    if (isFixedIncomeClass(a.asset_class ?? null) && !isTesouroAsset(a.ticker, a.asset_class)) {
      return false;
    }
    if (isPrivateFixedIncomeTicker(a.ticker)) return false;
    return true;
  });

  const tickersToFetch = new Set(eligible.map((a) => a.ticker.trim().toUpperCase()));
  tickersToFetch.add("USDBRL=X");

  const tickerList = [...tickersToFetch];

  const edgeQuotes = await fetchViaEdgeFunction(tickerList);
  const successfulQuotes: ParsedQuote[] = [...edgeQuotes];

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
      // Degradação graciosa
    }
  }

  const userAssetUpdatedCount = successfulQuotes.filter((q) => q.ticker !== "USDBRL=X").length;
  return userAssetUpdatedCount > 0 ? userAssetUpdatedCount : successfulQuotes.length;
}

export interface HistoricalMonthlyQuote {
  ticker: string;
  price: number;
  currency: "BRL" | "USD";
  source: "api" | "fallback";
}

/**
 * Busca cotações históricas oficiais de fechamento do mês para uma lista de ativos.
 * Cascata defensiva com timeout de 4s:
 * 1. Edge Function `quotes` com payload { tickers, month };
 * 2. Fallback gracioso caso a Edge Function falhe ou retorne vazio: devolve array vazio
 *    permitindo que a cascata de domínio use última transação ou estimativa.
 */
export async function fetchHistoricalMonthlyQuotes(
  tickers: string[],
  month: string,
): Promise<HistoricalMonthlyQuote[]> {
  const cleanTickers = [
    ...new Set(
      tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0 && !isPrivateFixedIncomeTicker(t)),
    ),
  ];

  if (cleanTickers.length === 0) return [];

  try {
    const supabase = getSupabase();
    const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout quotes edge function")), 4000),
    );

    const fetchPromise = supabase.functions.invoke<{
      quotes?: Array<{ ticker: string; price: number; currency: "BRL" | "USD" }>;
    }>("quotes", {
      body: { tickers: cleanTickers, month },
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    const quotes = response.data?.quotes;

    if (Array.isArray(quotes) && quotes.length > 0) {
      return quotes
        .filter((q) => q.price > 0)
        .map((q) => ({
          ticker: q.ticker.toUpperCase().trim(),
          price: q.price,
          currency: q.currency ?? "BRL",
          source: "api",
        }));
    }
  } catch {
    // Degradação graciosa em timeout ou falha de rede
  }

  return [];
}
