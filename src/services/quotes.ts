/**
 * Serviço de cotações online no cliente — Modelo Global Compartilhado (§1.6 D5).
 *
 * Toda a cadeia de provedores (Yahoo Finance, Brapi c/ token privado, BCB PTAX,
 * AwesomeAPI) roda exclusivamente no servidor (Edge Function `quotes` via service_role).
 * O cliente lê `asset_prices` / `market_price_history` e delega apenas tickers vencidos
 * ou ausentes à Edge Function, mantendo `fetchBcbIndicator` e `fetchPtaxForDate`
 * para indicadores macroeconômicos e preenchimento assistido de câmbio em ordens.
 */

import {
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  normalizeTesouroTicker,
  parseBcbSgsResponse,
  type ParsedQuote,
} from "@/domain/portfolio";
import { listMarketPriceHistoryByMonth } from "@/data/repositories/asset-prices";
import { getSupabase } from "@/data/client";

const FETCH_TIMEOUT_MS = 5_000;

/** Cache de taxas de indexadores (CDI / Selic / IPCA) para 6 horas. */
let bcbRateCache: {
  cdiAnnual?: number;
  selicAnnual?: number;
  ipcaAnnual?: number;
  timestamp: number;
} | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type QuoteSyncMode = "swr" | "report_preflight" | "preview";
export type QuoteSyncReason = "swr" | "cache_miss" | "post_trade_stale" | "report_preflight";

export interface SyncedQuoteItem extends ParsedQuote {
  marketPriceAt?: string | null;
  fetchedAt?: string | null;
  provider?: string | null;
}

export interface SyncMarketQuotesResult {
  updated: number;
  guarded: number;
  failed: number;
  skippedByEodGuard: number;
  skippedByCooldown: number;
  skippedByLock: number;
  rateLimited: boolean;
  retryAfterSeconds?: number;
  quotes: SyncedQuoteItem[];
}

export interface HistoricalMonthlyQuote {
  ticker: string;
  price: number;
  currency: "BRL" | "USD";
  source: "api" | "fallback";
  marketPriceAt?: string | null;
  provider?: string | null;
}

/** Limpa o cache em memória de indicadores BCB (uso em testes/reset). */
export function clearBcbCache(): void {
  bcbRateCache = null;
}

/**
 * Busca taxas macroeconômicas oficiais do Banco Central (SGS).
 *   • Série 12: CDI Diário
 *   • Série 432: Selic Meta (% a.a.)
 *   • Série 13522: IPCA acumulado 12m (% a.a.)
 */
export async function fetchBcbIndicator(
  indicator: "CDI" | "SELIC" | "IPCA",
): Promise<number | null> {
  const now = Date.now();
  if (bcbRateCache && now - bcbRateCache.timestamp < CACHE_TTL_MS) {
    if (indicator === "CDI" && bcbRateCache.cdiAnnual !== undefined) return bcbRateCache.cdiAnnual;
    if (indicator === "SELIC" && bcbRateCache.selicAnnual !== undefined) {
      return bcbRateCache.selicAnnual;
    }
    if (indicator === "IPCA" && bcbRateCache.ipcaAnnual !== undefined) {
      return bcbRateCache.ipcaAnnual;
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
      if (indicator === "IPCA") bcbRateCache.ipcaAnnual = parsed.rateAnnual;
      bcbRateCache.timestamp = now;
      return parsed.rateAnnual;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Busca a cotação PTAX oficial do BCB (Série SGS 1 / market_price_history) para uma data civil (YYYY-MM-DD),
 * cobrindo finais de semana/feriados com lookback de 7 dias corridos para o formulário de ordens históricas.
 */
export async function fetchPtaxForDate(dateISO: string): Promise<number | null> {
  const cleanDate = dateISO.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;

  // 1. Consulta primeiro o histórico oficial já congelado no Postgres (mês correspondente)
  try {
    const month = cleanDate.slice(0, 7);
    const histRows = await listMarketPriceHistoryByMonth(month);
    const exact = histRows.find(
      (r) => r.ticker === "USDBRL=X" && r.reference_date === cleanDate && r.price > 0,
    );
    if (exact) return Math.round(exact.price * 10000) / 10000;
  } catch {
    // Segue para consulta oficial no BCB
  }

  const [y, m, d] = cleanDate.split("-").map(Number);
  const endUtc = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  const startUtc = new Date(endUtc.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmtBcb = (dt: Date) =>
    `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${dt.getUTCFullYear()}`;

  // 2. API oficial do Banco Central (Série SGS 1 - Dólar Comercial Venda / PTAX)
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${fmtBcb(startUtc)}&dataFinal=${fmtBcb(endUtc)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      const payload: unknown = await response.json();
      if (Array.isArray(payload) && payload.length > 0) {
        const item = payload[payload.length - 1] as { valor?: string };
        const rate = parseFloat(String(item.valor ?? "").replace(",", "."));
        if (Number.isFinite(rate) && rate > 0) return Math.round(rate * 10000) / 10000;
      }
    }
  } catch {
    // Fallback silencioso
  }

  return null;
}

function emptySyncResult(): SyncMarketQuotesResult {
  return {
    updated: 0,
    guarded: 0,
    failed: 0,
    skippedByEodGuard: 0,
    skippedByCooldown: 0,
    skippedByLock: 0,
    rateLimited: false,
    quotes: [],
  };
}

/** Invoca a Edge Function `quotes` no servidor com tratamento seguro e resposta estruturada. */
export async function syncMarketQuotesBatch(params: {
  tickers: string[];
  mode?: QuoteSyncMode;
  reason?: QuoteSyncReason;
}): Promise<SyncMarketQuotesResult> {
  const cleanTickers = [
    ...new Set(
      params.tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => Boolean(t) && !isPrivateFixedIncomeTicker(t) && !normalizeTesouroTicker(t)),
    ),
  ];

  if (cleanTickers.length === 0) return emptySyncResult();

  const aggregated = emptySyncResult();
  const mode = params.mode ?? "swr";
  const reason = params.reason ?? (mode === "report_preflight" ? "report_preflight" : "swr");

  const chunkSize = 50;
  for (let i = 0; i < cleanTickers.length; i += chunkSize) {
    const chunk = cleanTickers.slice(i, i + chunkSize);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.functions.invoke<{
        updated?: number;
        guarded?: number;
        failed?: number;
        skippedByEodGuard?: number;
        skippedByCooldown?: number;
        skippedByLock?: number;
        rateLimited?: boolean;
        retryAfterSeconds?: number;
        quotes?: SyncedQuoteItem[];
      }>("quotes", {
        body: {
          tickers: chunk,
          mode,
          reason,
        },
      });

      if (error || !data) {
        aggregated.failed += chunk.length;
        continue;
      }

      aggregated.updated += Number(data.updated ?? 0);
      aggregated.guarded += Number(data.guarded ?? 0);
      aggregated.failed += Number(data.failed ?? 0);
      aggregated.skippedByEodGuard += Number(data.skippedByEodGuard ?? 0);
      aggregated.skippedByCooldown += Number(data.skippedByCooldown ?? 0);
      aggregated.skippedByLock += Number(data.skippedByLock ?? 0);
      if (data.rateLimited) {
        aggregated.rateLimited = true;
        aggregated.retryAfterSeconds = data.retryAfterSeconds;
      }
      if (Array.isArray(data.quotes)) {
        for (const q of data.quotes) {
          if (q && q.ticker && Number(q.price) > 0) {
            aggregated.quotes.push({
              ticker: q.ticker.trim().toUpperCase(),
              price: Number(q.price),
              currency: q.currency === "USD" ? "USD" : "BRL",
              marketPriceAt: q.marketPriceAt ?? null,
              fetchedAt: q.fetchedAt ?? null,
              provider: q.provider ?? null,
            });
          }
        }
      }
    } catch {
      aggregated.failed += chunk.length;
    }
  }

  return aggregated;
}

/**
 * Consulta cotação prévia de um ticker exclusivamente via Edge Function (`mode: 'preview'`).
 * Não grava cache global para ativos ainda não persistidos na carteira.
 */
export async function fetchOnlineQuote(ticker: string): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  if (
    !normalized ||
    isPrivateFixedIncomeTicker(normalized) ||
    isTesouroAsset(normalized) ||
    Boolean(normalizeTesouroTicker(normalized))
  ) {
    return null;
  }

  const res = await syncMarketQuotesBatch({
    tickers: [normalized],
    mode: "preview",
    reason: "cache_miss",
  });
  const hit = res.quotes.find((q) => q.ticker === normalized && q.price > 0);
  if (!hit) return null;
  return {
    ticker: hit.ticker,
    price: hit.price,
    currency: hit.currency,
  };
}

/**
 * Sincroniza um único ativo cadastrado diretamente no cache global via Edge Function (`service_role`).
 */
export async function syncQuoteForTicker(
  ticker: string,
  assetClass?: string | null,
  reason: QuoteSyncReason = "cache_miss",
): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;
  if (isCashAssetClass(assetClass ?? null)) return null;
  if (isPrivateFixedIncomeTicker(normalized)) return null;
  if (isFixedIncomeClass(assetClass ?? null) && !isTesouroAsset(normalized, assetClass)) return null;
  if (isTesouroAsset(normalized, assetClass) || Boolean(normalizeTesouroTicker(normalized))) {
    return null;
  }

  const res = await syncMarketQuotesBatch({
    tickers: [normalized],
    mode: "swr",
    reason,
  });
  const hit = res.quotes.find((q) => q.ticker === normalized && q.price > 0);
  if (!hit) return null;
  return {
    ticker: hit.ticker,
    price: hit.price,
    currency: hit.currency,
  };
}

/**
 * Sincroniza lote de ativos elegíveis + câmbio `USDBRL=X` exclusivamente pela Edge Function.
 * Mantido para compatibilidade até a remoção do botão manual no Bloco B.
 */
export async function syncQuotesForAssets(
  assets: { ticker: string; asset_class?: string | null; notes?: string | null }[],
): Promise<number> {
  const eligible = assets.filter((a) => {
    if (isCashAssetClass(a.asset_class ?? null)) return false;
    if (isFixedIncomeClass(a.asset_class ?? null) && !isTesouroAsset(a.ticker, a.asset_class)) {
      return false;
    }
    if (isPrivateFixedIncomeTicker(a.ticker)) return false;
    if (isCustomValuationAsset(a)) return false;
    if (isTesouroAsset(a.ticker, a.asset_class) || Boolean(normalizeTesouroTicker(a.ticker))) {
      return false;
    }
    return true;
  });

  const tickersToFetch = new Set(eligible.map((a) => a.ticker.trim().toUpperCase()));
  tickersToFetch.add("USDBRL=X");

  const result = await syncMarketQuotesBatch({
    tickers: [...tickersToFetch],
    mode: "swr",
    reason: "swr",
  });

  if (result.updated > 0) return result.updated;
  const nonFxQuotes = result.quotes.filter((q) => q.ticker !== "USDBRL=X").length;
  return nonFxQuotes > 0 ? nonFxQuotes : result.quotes.length;
}

/**
 * Busca cotações históricas oficiais de fechamento do mês para uma lista de ativos:
 *   1. Consulta `public.market_price_history` no Postgres primeiro (0 chamadas externas);
 *   2. Solicita à Edge Function `quotes` (`{ tickers, month }`) apenas os tickers ausentes.
 */
export async function fetchHistoricalMonthlyQuotes(
  tickers: string[],
  month: string,
): Promise<HistoricalMonthlyQuote[]> {
  const cleanTickers = [
    ...new Set(
      tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0 && !isPrivateFixedIncomeTicker(t) && !normalizeTesouroTicker(t)),
    ),
  ];

  if (cleanTickers.length === 0 || !/^\d{4}-\d{2}$/.test(month)) return [];

  const resolvedMap = new Map<string, HistoricalMonthlyQuote>();

  try {
    const historyRows = await listMarketPriceHistoryByMonth(month);
    const requestedSet = new Set(cleanTickers);
    for (const row of historyRows) {
      const key = row.ticker.toUpperCase().trim();
      if (requestedSet.has(key) && row.price > 0) {
        resolvedMap.set(key, {
          ticker: key,
          price: row.price,
          currency: row.currency,
          source: "api",
          marketPriceAt: row.market_price_at,
          provider: row.provider,
        });
      }
    }
  } catch {
    // Segue para Edge Function em caso de falha na leitura local
  }

  const missingTickers = cleanTickers.filter((t) => !resolvedMap.has(t));
  if (missingTickers.length > 0) {
    try {
      const supabase = getSupabase();
      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout quotes edge function")), 4_500),
      );

      const fetchPromise = supabase.functions.invoke<{
        quotes?: Array<{
          ticker: string;
          price: number;
          currency: "BRL" | "USD";
          marketPriceAt?: string | null;
          provider?: string | null;
        }>;
      }>("quotes", {
        body: { tickers: missingTickers, month },
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const quotes = response.data?.quotes;

      if (Array.isArray(quotes)) {
        for (const q of quotes) {
          const key = q.ticker?.toUpperCase().trim();
          if (key && Number(q.price) > 0 && !resolvedMap.has(key)) {
            resolvedMap.set(key, {
              ticker: key,
              price: Number(q.price),
              currency: q.currency === "USD" ? "USD" : "BRL",
              source: "api",
              marketPriceAt: q.marketPriceAt ?? null,
              provider: q.provider ?? null,
            });
          }
        }
      }
    } catch {
      // Degradação graciosa em timeout ou falha de rede
    }
  }

  return Array.from(resolvedMap.values());
}
