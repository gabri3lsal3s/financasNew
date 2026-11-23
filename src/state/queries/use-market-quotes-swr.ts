import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FALLBACK_USD_RATE,
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isMarketOpenForTicker,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  isTickerQuoteStaleForSwr,
  normalizeTesouroTicker,
} from "@/domain/portfolio";
import { useAssetPrices } from "./use-asset-prices";
import { usePortfolioAssets } from "./use-portfolio";

const DEFAULT_INTERVAL_MS = 15 * 60_000;
const CLIENT_COOLDOWN_MS = 14.5 * 60_000;
const MARKET_CLOCK_REFRESH_MS = 60_000;

interface MarketQuotesSwrStoreSnapshot {
  isSyncing: boolean;
  lastSyncAt: number | null;
  degradedTickers: string[];
}

/** Estado de módulo compartilhado via useSyncExternalStore para zero drift entre instâncias. */
let swrStoreSnapshot: MarketQuotesSwrStoreSnapshot = {
  isSyncing: false,
  lastSyncAt: null,
  degradedTickers: [],
};
const swrStoreListeners = new Set<() => void>();
let inFlightSyncPromise: Promise<void> | null = null;
const attemptedCacheMissTickers = new Set<string>();
const lastClientAttemptByTicker = new Map<string, number>();

function updateSwrStoreSnapshot(
  updater: (prev: MarketQuotesSwrStoreSnapshot) => MarketQuotesSwrStoreSnapshot,
): void {
  const next = updater(swrStoreSnapshot);
  if (
    next.isSyncing === swrStoreSnapshot.isSyncing &&
    next.lastSyncAt === swrStoreSnapshot.lastSyncAt &&
    next.degradedTickers.length === swrStoreSnapshot.degradedTickers.length &&
    next.degradedTickers.every((t, i) => t === swrStoreSnapshot.degradedTickers[i])
  ) {
    return;
  }
  swrStoreSnapshot = next;
  for (const listener of swrStoreListeners) {
    listener();
  }
}

export function subscribeMarketQuotesSwr(listener: () => void): () => void {
  swrStoreListeners.add(listener);
  return () => {
    swrStoreListeners.delete(listener);
  };
}

export function getMarketQuotesSwrSnapshot(): MarketQuotesSwrStoreSnapshot {
  return swrStoreSnapshot;
}

export function resetMarketQuotesSwrStateForTest(): void {
  inFlightSyncPromise = null;
  attemptedCacheMissTickers.clear();
  lastClientAttemptByTicker.clear();
  updateSwrStoreSnapshot(() => ({
    isSyncing: false,
    lastSyncAt: null,
    degradedTickers: [],
  }));
}

export interface UseMarketQuotesSwrOptions {
  /** Ativa a sincronização automática (padrão: true). */
  enabled?: boolean;
  /** Revalida silenciosamente a cada 15 min enquanto aba visível e mercado aberto. */
  enableInterval?: boolean;
  /** Intervalo de revalidação em ms (padrão: 15 minutos). */
  intervalMs?: number;
}

export interface UseMarketQuotesSwrResult {
  isSyncing: boolean;
  lastSyncAt: number | null;
  hasOpenMarket: boolean;
  degradedTickers: string[];
  retryDegraded: () => Promise<void>;
}

/**
 * Motor automático de SWR compartilhado sobre `asset_prices`:
 *   • Renderiza imediatamente com o cache global do Postgres;
 *   • Envia à Edge Function apenas os tickers vencidos (>= 15 min com pregão aberto)
 *     ou em `cache_miss` (1x por sessão, inclusive em fins de semana/feriados);
 *   • Pausa automaticamente offline ou com a aba em background (`visibilityState === 'hidden'`).
 */
export function useMarketQuotesSwr(
  options: UseMarketQuotesSwrOptions = {},
): UseMarketQuotesSwrResult {
  const { enabled = true, enableInterval = false, intervalMs = DEFAULT_INTERVAL_MS } = options;
  const queryClient = useQueryClient();
  const assetsQuery = usePortfolioAssets();
  const pricesQuery = useAssetPrices();

  const swrSnapshot = useSyncExternalStore(
    subscribeMarketQuotesSwr,
    getMarketQuotesSwrSnapshot,
    getMarketQuotesSwrSnapshot,
  );
  const [marketClockTick, setMarketClockTick] = useState(0);
  const pricesDataRef = useRef(pricesQuery.data);
  useEffect(() => {
    pricesDataRef.current = pricesQuery.data;
  }, [pricesQuery.data]);

  const eligibleTickers = useMemo(() => {
    const assets = assetsQuery.data ?? [];
    if (assets.length === 0) return [];

    const set = new Set<string>();
    let needsUsdFx = false;

    for (const a of assets) {
      if ((Number(a.quantity) || 0) <= 0) continue;
      if (a.currency === "USD") needsUsdFx = true;
      if (isCashAssetClass(a.asset_class)) continue;
      if (isFixedIncomeClass(a.asset_class)) continue;
      if (isTesouroAsset(a.ticker, a.asset_class) || Boolean(normalizeTesouroTicker(a.ticker))) {
        continue;
      }
      if (isPrivateFixedIncomeTicker(a.ticker)) continue;
      if (isCustomValuationAsset(a)) continue;

      const clean = a.ticker.trim().toUpperCase();
      if (
        !clean ||
        clean === "CAIXA" ||
        clean === "CASH" ||
        clean.startsWith("CAIXA_") ||
        clean.startsWith("CASH_")
      ) {
        continue;
      }
      set.add(clean);
    }

    if (needsUsdFx) {
      set.add("USDBRL=X");
    }

    return [...set].sort((a, b) => a.localeCompare(b));
  }, [assetsQuery.data]);

  useEffect(() => {
    if (!enabled || eligibleTickers.length === 0) return;
    const timer = setInterval(() => {
      setMarketClockTick((prev) => prev + 1);
    }, MARKET_CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, eligibleTickers.length]);

  const hasOpenMarket = useMemo(() => {
    void marketClockTick;
    return eligibleTickers.some((t) => isMarketOpenForTicker(t));
  }, [eligibleTickers, marketClockTick]);

  const runSyncForTickers = useCallback(
    async (forceRetryTickers?: string[]) => {
      if (!enabled) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (inFlightSyncPromise) return;
      if (assetsQuery.isLoading || pricesQuery.isLoading) return;
      if (eligibleTickers.length === 0) return;

      const now = new Date();
      const nowMs = now.getTime();
      const priceRows = pricesDataRef.current ?? [];
      const rowByTicker = new Map(priceRows.map((r) => [r.ticker.toUpperCase().trim(), r]));

      const cacheMissCandidates: string[] = [];
      const swrCandidates: string[] = [];
      const eligibleSet = new Set(eligibleTickers);
      const addedMissAttempt: string[] = [];
      const prevClientAttempts = new Map<string, number | undefined>();

      const classifyForceTicker = (ticker: string) => {
        const row = rowByTicker.get(ticker);
        const isMiss = !row || row.source !== "api" || row.price <= 0;
        if (isMiss) {
          cacheMissCandidates.push(ticker);
        } else {
          swrCandidates.push(ticker);
        }
      };

      if (forceRetryTickers && forceRetryTickers.length > 0) {
        for (const t of forceRetryTickers) {
          const clean = t.trim().toUpperCase();
          if (clean && eligibleSet.has(clean)) {
            classifyForceTicker(clean);
          }
        }
      } else {
        for (const ticker of eligibleTickers) {
          const row = rowByTicker.get(ticker);
          const staleReason = isTickerQuoteStaleForSwr({
            ticker,
            source: row?.source ?? null,
            price: row?.price ?? null,
            fetchedAt: row?.fetched_at ?? null,
            marketPriceAt: row?.market_price_at ?? null,
            now,
            ttlMs: intervalMs,
          });

          if (!staleReason) continue;

          if (staleReason === "cache_miss") {
            if (attemptedCacheMissTickers.has(ticker)) continue;
            attemptedCacheMissTickers.add(ticker);
            addedMissAttempt.push(ticker);
            cacheMissCandidates.push(ticker);
            continue;
          }

          const prevAttempt = lastClientAttemptByTicker.get(ticker);
          if (prevAttempt !== undefined && nowMs - prevAttempt < CLIENT_COOLDOWN_MS) continue;
          prevClientAttempts.set(ticker, prevAttempt);
          lastClientAttemptByTicker.set(ticker, nowMs);
          swrCandidates.push(ticker);
        }
      }

      const allCandidates = [...cacheMissCandidates, ...swrCandidates];
      if (allCandidates.length === 0) return;

      const rollbackAttemptCaches = () => {
        for (const t of addedMissAttempt) {
          attemptedCacheMissTickers.delete(t);
        }
        for (const [t, prevVal] of prevClientAttempts.entries()) {
          if (prevVal === undefined) {
            lastClientAttemptByTicker.delete(t);
          } else {
            lastClientAttemptByTicker.set(t, prevVal);
          }
        }
      };

      updateSwrStoreSnapshot((prev) => ({ ...prev, isSyncing: true }));

      const work = (async () => {
        try {
          const { syncMarketQuotesBatch } = await import("@/services/quotes");
          const batches: Array<{ tickers: string[]; reason: "cache_miss" | "swr" }> = [];
          if (cacheMissCandidates.length > 0) {
            batches.push({ tickers: cacheMissCandidates, reason: "cache_miss" });
          }
          if (swrCandidates.length > 0) {
            batches.push({ tickers: swrCandidates, reason: "swr" });
          }

          const results = await Promise.all(
            batches.map((b) =>
              syncMarketQuotesBatch({
                tickers: b.tickers,
                mode: "swr",
                reason: b.reason,
              }),
            ),
          );

          const returnedMap = new Map<string, { ticker: string; price: number }>();
          let totalUpdated = 0;
          let hadTransientBlock = false;
          for (const res of results) {
            totalUpdated += res.updated;
            if (res.rateLimited || res.skippedByLock > 0 || (res.failed > 0 && res.quotes.length === 0)) {
              hadTransientBlock = true;
            }
            for (const q of res.quotes) {
              returnedMap.set(q.ticker, q);
            }
          }

          if (hadTransientBlock) {
            for (const t of addedMissAttempt) {
              if (!returnedMap.has(t)) attemptedCacheMissTickers.delete(t);
            }
            for (const [t, prevVal] of prevClientAttempts.entries()) {
              if (!returnedMap.has(t)) {
                if (prevVal === undefined) lastClientAttemptByTicker.delete(t);
                else lastClientAttemptByTicker.set(t, prevVal);
              }
            }
          }

          const attemptedSet = new Set(allCandidates);
          const failedTickers: string[] = [];
          for (const t of allCandidates) {
            const hit = returnedMap.get(t);
            const existingRow = rowByTicker.get(t);
            const hasValidQuote =
              (hit && hit.price > 0) ||
              (existingRow?.source === "api" &&
                existingRow.price > 0 &&
                !(t === "USDBRL=X" && existingRow.price === FALLBACK_USD_RATE && !existingRow.fetched_at));
            if (!hasValidQuote) {
              failedTickers.push(t);
            }
          }

          updateSwrStoreSnapshot((prev) => {
            const merged = new Set(
              prev.degradedTickers.filter((t) => eligibleSet.has(t) && !attemptedSet.has(t)),
            );
            for (const t of failedTickers) {
              merged.add(t);
            }
            return {
              ...prev,
              degradedTickers: [...merged].sort((a, b) => a.localeCompare(b)),
              lastSyncAt: Date.now(),
            };
          });

          if (totalUpdated > 0 || returnedMap.size > 0) {
            await queryClient.invalidateQueries({ queryKey: ["asset_prices"] });
          }
        } catch {
          rollbackAttemptCaches();
        } finally {
          inFlightSyncPromise = null;
          updateSwrStoreSnapshot((prev) => ({ ...prev, isSyncing: false }));
        }
      })();

      inFlightSyncPromise = work;
      await work;
    },
    [
      enabled,
      assetsQuery.isLoading,
      pricesQuery.isLoading,
      eligibleTickers,
      intervalMs,
      queryClient,
    ],
  );

  // Disparo automático na entrada e quando novos ativos/preços ficam disponíveis
  useEffect(() => {
    if (!enabled) return;
    void runSyncForTickers();
  }, [enabled, runSyncForTickers, pricesQuery.data]);

  // Revalidação silenciosa a cada 15 min enquanto ativo em tela com pregão aberto
  useEffect(() => {
    if (!enabled || !enableInterval) return;

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void runSyncForTickers();
    }, intervalMs);

    const handleVisibilityOrOnline = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void runSyncForTickers();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleVisibilityOrOnline);
    }

    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleVisibilityOrOnline);
      }
    };
  }, [enabled, enableInterval, intervalMs, runSyncForTickers]);

  const retryDegraded = useCallback(async () => {
    if (swrSnapshot.degradedTickers.length === 0) return;
    for (const t of swrSnapshot.degradedTickers) {
      attemptedCacheMissTickers.delete(t);
      lastClientAttemptByTicker.delete(t);
    }
    await runSyncForTickers(swrSnapshot.degradedTickers);
  }, [swrSnapshot.degradedTickers, runSyncForTickers]);

  return {
    isSyncing: swrSnapshot.isSyncing,
    lastSyncAt: swrSnapshot.lastSyncAt,
    hasOpenMarket,
    degradedTickers: swrSnapshot.degradedTickers,
    retryDegraded,
  };
}
