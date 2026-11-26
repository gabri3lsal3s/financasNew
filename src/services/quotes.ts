/**
 * Serviço de cotações online no cliente — Modelo Global Compartilhado (§1.6 D5).
 *
 * Toda a cadeia de provedores (Yahoo Finance, Brapi c/ token privado, BCB PTAX,
 * AwesomeAPI) roda exclusivamente no servidor (Edge Function `quotes` via service_role).
 * O cliente lê `asset_prices` / `market_price_history` e delega apenas tickers vencidos
 * ou ausentes à Edge Function, mantendo `fetchBcbIndicator` e `fetchPtaxForDate`
 * para indicadores macroeconômicos e preenchimento assistido de câmbio em ordens.
 */

import { z } from "zod";
import { isCashAssetClass, isCustomValuationAsset, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { isPrivateFixedIncomeTicker, normalizeTesouroTicker, parseBcbSgsResponse, type ParsedQuote } from "@/domain/portfolio/quotes";
import {
  getMarketPriceHistoryForDate,
  listMarketPriceHistoryByMonth,
} from "@/data/repositories/asset-prices";
import { getSupabase } from "@/data/client";

const FETCH_TIMEOUT_MS = 5_000;

/** Cache individual por série de taxas de indexadores (CDI / Selic / IPCA) para 6 horas. */
const bcbRateCache: Partial<
  Record<"CDI" | "SELIC" | "IPCA", { value: number; timestamp: number }>
> = {};
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

const QuoteItemSchema = z.object({
  ticker: z.string().trim().min(1),
  price: z.number().finite().positive(),
  currency: z.enum(["BRL", "USD"]).optional(),
  marketPriceAt: z.string().nullable().optional(),
  fetchedAt: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
});

const QuotesEnvelopeSchema = z.object({
  updated: z.number().finite().nonnegative().optional(),
  guarded: z.number().finite().nonnegative().optional(),
  failed: z.number().finite().nonnegative().optional(),
  skippedByEodGuard: z.number().finite().nonnegative().optional(),
  skippedByCooldown: z.number().finite().nonnegative().optional(),
  skippedByLock: z.number().finite().nonnegative().optional(),
  rateLimited: z.boolean().optional(),
  retryAfterSeconds: z.number().finite().nonnegative().optional(),
  quotes: z.array(z.unknown()).optional(),
});

const HistoricalQuotesEnvelopeSchema = z.object({
  quotes: z.array(z.unknown()).optional(),
});

/** Limpa o cache em memória de indicadores BCB (uso em testes/reset). */
export function clearBcbCache(): void {
  delete bcbRateCache.CDI;
  delete bcbRateCache.SELIC;
  delete bcbRateCache.IPCA;
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
  const cached = bcbRateCache[indicator];
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const serie = indicator === "CDI" ? 12 : indicator === "SELIC" ? 432 : 13522;
  const unit = indicator === "CDI" ? "daily" : "annual";
  const targetUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(targetUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const parsed = parseBcbSgsResponse(payload, unit);
    if (parsed && parsed.rateAnnual !== undefined) {
      bcbRateCache[indicator] = { value: parsed.rateAnnual, timestamp: now };
      return parsed.rateAnnual;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  return null;
}

/**
 * Busca a cotação PTAX oficial do BCB (Série SGS 1 / market_price_history) para uma data civil (YYYY-MM-DD),
 * cobrindo finais de semana/feriados com lookback de 7 dias corridos para o formulário de ordens históricas.
 */
export async function fetchPtaxForDate(
  dateISO: string,
  options?: { signal?: AbortSignal },
): Promise<number | null> {
  const cleanDate = dateISO.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;
  if (options?.signal?.aborted) return null;

  let historyFallbackRate: number | null = null;

  // 1. Consulta primeiro o histórico oficial já congelado no Postgres (janela de 7 dias)
  try {
    const histRow = await getMarketPriceHistoryForDate("USDBRL=X", cleanDate);
    if (options?.signal?.aborted) return null;
    if (histRow && histRow.price > 0) {
      const rounded = Math.round(histRow.price * 10000) / 10000;
      if (histRow.reference_date === cleanDate) {
        return rounded;
      }
      historyFallbackRate = rounded;
    }
  } catch {
    // Segue para consulta oficial no BCB
  }

  const [y, m, d] = cleanDate.split("-").map(Number);
  const endUtc = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  const startUtc = new Date(endUtc.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmtBcb = (dt: Date) =>
    `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${dt.getUTCFullYear()}`;

  // 2. API oficial do Banco Central (Série SGS 1 - Dólar Comercial Venda / PTAX)
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  options?.signal?.addEventListener("abort", onParentAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${fmtBcb(startUtc)}&dataFinal=${fmtBcb(endUtc)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (response.ok) {
      const payload: unknown = await response.json();
      if (Array.isArray(payload) && payload.length > 0) {
        const item = payload[payload.length - 1] as { valor?: string };
        const rate = parseFloat(String(item.valor ?? "").replace(",", "."));
        if (Number.isFinite(rate) && rate > 0) return Math.round(rate * 10000) / 10000;
      }
    }
  } catch {
    // Fallback silencioso para histórico lookback
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onParentAbort);
  }

  return historyFallbackRate;
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

      const parsedEnvelope = QuotesEnvelopeSchema.safeParse(data);
      if (!parsedEnvelope.success) {
        aggregated.failed += chunk.length;
        continue;
      }
      const env = parsedEnvelope.data;

      aggregated.updated += env.updated ?? 0;
      aggregated.guarded += env.guarded ?? 0;
      aggregated.failed += env.failed ?? 0;
      aggregated.skippedByEodGuard += env.skippedByEodGuard ?? 0;
      aggregated.skippedByCooldown += env.skippedByCooldown ?? 0;
      aggregated.skippedByLock += env.skippedByLock ?? 0;
      if (env.rateLimited) {
        aggregated.rateLimited = true;
        aggregated.retryAfterSeconds = env.retryAfterSeconds;
      }
      if (Array.isArray(env.quotes)) {
        for (const rawItem of env.quotes) {
          const parsedItem = QuoteItemSchema.safeParse(rawItem);
          if (!parsedItem.success) continue;
          const q = parsedItem.data;
          aggregated.quotes.push({
            ticker: q.ticker.trim().toUpperCase(),
            price: q.price,
            currency: q.currency === "USD" ? "USD" : "BRL",
            marketPriceAt: q.marketPriceAt ?? null,
            fetchedAt: q.fetchedAt ?? null,
            provider: q.provider ?? null,
          });
        }
      }
      if (aggregated.rateLimited) {
        break;
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
  options?: {
    existingHistoryRows?: Array<{
      ticker: string;
      price: number;
      currency: "BRL" | "USD";
      market_price_at?: string | null;
      provider?: string | null;
    }>;
    signal?: AbortSignal;
  },
): Promise<HistoricalMonthlyQuote[]> {
  const cleanTickers = [
    ...new Set(
      tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0 && !isPrivateFixedIncomeTicker(t) && !normalizeTesouroTicker(t)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  if (cleanTickers.length === 0 || !/^\d{4}-\d{2}$/.test(month)) return [];
  if (options?.signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  const resolvedMap = new Map<string, HistoricalMonthlyQuote>();

  try {
    const historyRows =
      options?.existingHistoryRows ?? (await listMarketPriceHistoryByMonth(month));
    const requestedSet = new Set(cleanTickers);
    for (const row of historyRows) {
      const key = row.ticker.toUpperCase().trim();
      if (requestedSet.has(key) && row.price > 0) {
        resolvedMap.set(key, {
          ticker: key,
          price: row.price,
          currency: row.currency,
          source: "api",
          marketPriceAt: row.market_price_at ?? null,
          provider: row.provider ?? null,
        });
      }
    }
  } catch {
    // Segue para Edge Function em caso de falha na leitura local
  }

  const missingTickers = cleanTickers.filter((t) => !resolvedMap.has(t));
  if (missingTickers.length > 0) {
    const supabase = getSupabase();
    const chunkSize = 50;
    const chunks: string[][] = [];
    for (let i = 0; i < missingTickers.length; i += chunkSize) {
      chunks.push(missingTickers.slice(i, i + chunkSize));
    }

    const invokeChunk = async (chunk: string[]) => {
      if (options?.signal?.aborted) return;
      const chunkController = new AbortController();
      const onParentAbort = () => chunkController.abort();
      options?.signal?.addEventListener("abort", onParentAbort, { once: true });
      const timerId = setTimeout(() => chunkController.abort(), 15_000);

      try {
        const invokePromise = supabase.functions.invoke<{
          quotes?: Array<{
            ticker: string;
            price: number;
            currency: "BRL" | "USD";
            marketPriceAt?: string | null;
            provider?: string | null;
          }>;
        }>("quotes", {
          body: { tickers: chunk, month },
          signal: chunkController.signal,
        } as Parameters<typeof supabase.functions.invoke>[1]);

        const abortPromise = new Promise<never>((_, reject) => {
          if (chunkController.signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          chunkController.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });

        const response = await Promise.race([invokePromise, abortPromise]);
        const parsedEnv = HistoricalQuotesEnvelopeSchema.safeParse(response.data);
        const quotes = parsedEnv.success ? parsedEnv.data.quotes : undefined;

        if (Array.isArray(quotes)) {
          for (const rawItem of quotes) {
            const parsedItem = QuoteItemSchema.safeParse(rawItem);
            if (!parsedItem.success) continue;
            const q = parsedItem.data;
            const key = q.ticker.toUpperCase().trim();
            if (key && !resolvedMap.has(key)) {
              resolvedMap.set(key, {
                ticker: key,
                price: q.price,
                currency: q.currency === "USD" ? "USD" : "BRL",
                source: "api",
                marketPriceAt: q.marketPriceAt ?? null,
                provider: q.provider ?? null,
              });
            }
          }
        }
      } catch (err) {
        if (options?.signal?.aborted) {
          throw err;
        }
        // Degradação graciosa em timeout ou falha parcial de lote
      } finally {
        clearTimeout(timerId);
        options?.signal?.removeEventListener("abort", onParentAbort);
      }
    };

    // Processa ondas paralelas com concorrência limitada (3 lotes por vez)
    const maxConcurrency = 3;
    for (let i = 0; i < chunks.length; i += maxConcurrency) {
      if (options?.signal?.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }
      await Promise.allSettled(chunks.slice(i, i + maxConcurrency).map(invokeChunk));
    }
  }

  return Array.from(resolvedMap.values());
}
