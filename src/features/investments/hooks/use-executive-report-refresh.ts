import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import {
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  normalizeTesouroTicker,
} from "@/domain/portfolio";
import type { PortfolioAsset } from "@/types";

export interface UseExecutiveReportRefreshParams {
  open: boolean;
  enabled: boolean;
  assets?: readonly Pick<
    PortfolioAsset,
    "ticker" | "asset_class" | "currency" | "quantity" | "notes"
  >[];
  tickers?: readonly string[];
}

export interface UseExecutiveReportRefreshResult {
  isRefreshing: boolean;
  failedCount: number;
  rateLimited: boolean;
  retry: () => Promise<void>;
}

/**
 * Executa pré-sincronização cirúrgica e não-bloqueante ao abrir Relatórios Executivos/PDFs
 * no mês corrente (`mode: 'report_preflight'`), respeitando EOD Guard, cooldown de 5 min
 * no servidor e modo offline. Compatível com testes isolados sem `<QueryClientProvider />`.
 */
export function useExecutiveReportRefresh({
  open,
  enabled,
  assets,
  tickers,
}: UseExecutiveReportRefreshParams): UseExecutiveReportRefreshResult {
  const queryClient = useContext(QueryClientContext);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const triggeredForOpenRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const targetTickers = useMemo(() => {
    const set = new Set<string>();
    let needsUsdFx = false;

    for (const rawTicker of tickers ?? []) {
      const clean = rawTicker.trim().toUpperCase();
      if (clean && !isPrivateFixedIncomeTicker(clean) && !normalizeTesouroTicker(clean)) {
        set.add(clean);
      }
    }

    for (const a of assets ?? []) {
      if (a.currency === "USD") needsUsdFx = true;
      if ((Number(a.quantity) || 0) <= 0) continue;
      if (isCashAssetClass(a.asset_class)) continue;
      if (isFixedIncomeClass(a.asset_class)) continue;
      if (isTesouroAsset(a.ticker, a.asset_class) || Boolean(normalizeTesouroTicker(a.ticker))) {
        continue;
      }
      if (isPrivateFixedIncomeTicker(a.ticker) || isCustomValuationAsset(a)) continue;

      const clean = a.ticker.trim().toUpperCase();
      if (clean && clean !== "CAIXA" && clean !== "CASH") {
        set.add(clean);
      }
    }

    if (needsUsdFx || set.size > 0) {
      set.add("USDBRL=X");
    }

    return [...set].sort((a, b) => a.localeCompare(b));
  }, [assets, tickers]);

  const runRefresh = useCallback(async () => {
    if (!queryClient) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (targetTickers.length === 0) return;

    if (mountedRef.current) {
      setIsRefreshing(true);
      setRateLimited(false);
    }

    try {
      const { syncMarketQuotesBatch } = await import("@/services/quotes");
      const res = await syncMarketQuotesBatch({
        tickers: targetTickers,
        mode: "report_preflight",
        reason: "report_preflight",
      });

      if (mountedRef.current) {
        setFailedCount(res.failed);
        setRateLimited(res.rateLimited);
      }

      if (res.updated > 0) {
        await queryClient.invalidateQueries({ queryKey: ["asset_prices"] });
      }
    } catch {
      if (mountedRef.current) {
        setFailedCount(targetTickers.length);
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [queryClient, targetTickers]);

  useEffect(() => {
    if (!open || !enabled) {
      triggeredForOpenRef.current = false;
      return;
    }
    if (!queryClient || targetTickers.length === 0 || triggeredForOpenRef.current) return;
    triggeredForOpenRef.current = true;
    void runRefresh();
  }, [open, enabled, queryClient, targetTickers.length, runRefresh]);

  return {
    isRefreshing,
    failedCount,
    rateLimited,
    retry: runRefresh,
  };
}
