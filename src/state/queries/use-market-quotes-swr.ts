import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Estado de módulo compartilhado para evitar corridas entre montagens simultâneas (Home / Investimentos). */
let inFlightSyncPromise: Promise<void> | null = null;
const attemptedCacheMissTickers = new Set<string>();
const lastClientAttemptByTicker = new Map<string, number>();

export function resetMarketQuotesSwrStateForTest(): void {
  inFlightSyncPromise = null;
  attemptedCacheMissTickers.clear();
  lastClientAttemptByTicker.clear();
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

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [degradedTickers, setDegradedTickers] = useState<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const eligibleTickers = useMemo(() => {
    const assets = assetsQuery.data ?? [];
    if (assets.length === 0) return [];

    const set = new Set<string>();
    let needsUsdFx = false;

    for (const a of assets) {
      if (a.currency === "USD") needsUsdFx = true;
      if ((Number(a.quantity) || 0) <= 0) continue;
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

    if (needsUsdFx || set.size > 0) {
      set.add("USDBRL=X");
    }

    return [...set].sort((a, b) => a.localeCompare(b));
  }, [assetsQuery.data]);

  const hasOpenMarket = useMemo(
    () => eligibleTickers.some((t) => isMarketOpenForTicker(t)),
    [eligibleTickers],
  );

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
      const priceRows = pricesQuery.data ?? [];
      const rowByTicker = new Map(priceRows.map((r) => [r.ticker.toUpperCase().trim(), r]));

      const cacheMissCandidates: string[] = [];
      const swrCandidates: string[] = [];
      const eligibleSet = new Set(eligibleTickers);

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
            cacheMissCandidates.push(ticker);
            continue;
          }

          const prevAttempt = lastClientAttemptByTicker.get(ticker) ?? 0;
          if (nowMs - prevAttempt < CLIENT_COOLDOWN_MS) continue;
          lastClientAttemptByTicker.set(ticker, nowMs);
          swrCandidates.push(ticker);
        }
      }

      const allCandidates = [...cacheMissCandidates, ...swrCandidates];
      if (allCandidates.length === 0) return;

      if (mountedRef.current) setIsSyncing(true);

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
          for (const res of results) {
            totalUpdated += res.updated;
            for (const q of res.quotes) {
              returnedMap.set(q.ticker, q);
            }
          }

          const attemptedSet = new Set(allCandidates);
          const failedTickers: string[] = [];
          for (const t of allCandidates) {
            const hit = returnedMap.get(t);
            const existingRow = rowByTicker.get(t);
            const hasValidQuote =
              (hit && hit.price > 0) ||
              (existingRow?.source === "api" && existingRow.price > 0 &&
                !(t === "USDBRL=X" && existingRow.price === FALLBACK_USD_RATE && !existingRow.fetched_at));
            if (!hasValidQuote) {
              failedTickers.push(t);
            }
          }

          if (mountedRef.current) {
            setDegradedTickers((prev) => {
              const merged = new Set(
                prev.filter((t) => eligibleSet.has(t) && !attemptedSet.has(t)),
              );
              for (const t of failedTickers) {
                merged.add(t);
              }
              return [...merged].sort((a, b) => a.localeCompare(b));
            });
            setLastSyncAt(Date.now());
          }

          if (totalUpdated > 0) {
            await queryClient.invalidateQueries({ queryKey: ["asset_prices"] });
          }
        } catch {
          // Degradação graciosa: mantém cache existente sem travar UI
        } finally {
          inFlightSyncPromise = null;
          if (mountedRef.current) {
            setIsSyncing(false);
          }
        }
      })();

      inFlightSyncPromise = work;
      await work;
    },
    [
      enabled,
      assetsQuery.isLoading,
      pricesQuery.isLoading,
      pricesQuery.data,
      eligibleTickers,
      intervalMs,
      queryClient,
    ],
  );

  // Disparo automático na entrada e quando novos ativos/preços ficam disponíveis
  useEffect(() => {
    if (!enabled) return;
    void runSyncForTickers();
  }, [enabled, runSyncForTickers]);

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
    if (degradedTickers.length === 0) return;
    for (const t of degradedTickers) {
      attemptedCacheMissTickers.delete(t);
      lastClientAttemptByTicker.delete(t);
    }
    await runSyncForTickers(degradedTickers);
  }, [degradedTickers, runSyncForTickers]);

  return {
    isSyncing,
    lastSyncAt,
    hasOpenMarket,
    degradedTickers,
    retryDegraded,
  };
}
