/**
 * Hook de consulta da posição histórica mensal de investimentos (§F10/F40/F51).
 *
 * Se a competência solicitada for o mês corrente, reutiliza a query `usePortfolioPosition`.
 * Se for um mês histórico (< mês atual):
 * 1. Carrega ativos, movimentações, proventos, snapshots e cotações mensais salvas;
 * 2. Se houver ativos cotados sem cotação salva na tabela `portfolio_monthly_prices`,
 *    consulta a Edge Function de cotações em background;
 * 3. Reconstrói deterministicamente a custódia através do motor puro `calculatePointInTimePosition`.
 */

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { listMarketPriceHistoryByMonth } from "@/data/repositories/asset-prices";
import { todaySaoPauloISO } from "@/domain/portfolio/dividend-suggester";
import { STALE_TIMES } from "@/state/cache-policy";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioSnapshots,
} from "./use-portfolio";
import { usePortfolioMonthlyPrices } from "./use-portfolio-monthly-prices";
import { usePortfolioPosition } from "./use-portfolio-position";
import { useMacroIndicators } from "./use-macro-indicators";
import { fetchHistoricalMonthlyQuotes } from "@/services/quotes";
import {
  calculateMonthlyStatement,
  calculatePointInTimePosition,
  extractExplicitRateFromNotes,
  FALLBACK_USD_RATE,
  getPreviousMonth,
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isHistoricalWithdrawal,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  normalizeTesouroTicker,
  type MonthlyStatementCashFlow,
  type PointInTimeResult,
} from "@/domain/portfolio";

import type { PortfolioAsset } from "@/types";

export interface PortfolioMonthlyPositionState {
  data: PointInTimeResult | null;
  isLoading: boolean;
  isError: boolean;
  isCurrentMonth: boolean;
  isEnrichingQuotes: boolean;
  assets: PortfolioAsset[];
  error: unknown;
  refetch: () => void;
}

export function usePortfolioMonthlyPosition(
  month: string,
  options?: { enabled?: boolean },
): PortfolioMonthlyPositionState {
  const enabled = options?.enabled ?? true;
  const isCurrent = month >= todaySaoPauloISO().slice(0, 7);
  const queryClient = useContext(QueryClientContext);

  // Se for o mês corrente, delega para usePortfolioPosition
  const currentPos = usePortfolioPosition({ enabled: enabled && isCurrent });

  // Queries para reconstrução retroativa
  const retroactiveEnabled = enabled && !isCurrent;
  const assetsQuery = usePortfolioAssets({ enabled: retroactiveEnabled });
  const transactionsQuery = useAllPortfolioTransactions({ enabled: retroactiveEnabled });
  const dividendsQuery = usePortfolioDividends({ enabled: retroactiveEnabled });
  const contributionsQuery = usePortfolioContributions({ enabled: retroactiveEnabled });
  const monthlyPricesQuery = usePortfolioMonthlyPrices(month, { enabled: retroactiveEnabled });
  const marketHistoryQuery = useQuery({
    queryKey: ["market_price_history", month],
    queryFn: () => listMarketPriceHistoryByMonth(month, { onlyMonthEnd: true }),
    staleTime: STALE_TIMES.static,
    enabled: retroactiveEnabled && Boolean(month),
  });
  const snapshotsQuery = usePortfolioSnapshots({ enabled });
  const macroQuery = useMacroIndicators({ enabled: retroactiveEnabled });

  // Cotações buscadas via API sob demanda isoladas estritamente por competência (sem vazamento entre meses)
  const [apiQuotesByMonth, setApiQuotesByMonth] = useState<
    Record<string, Record<string, number>>
  >({});
  const [isFetchingApiQuotes, setIsFetchingApiQuotes] = useState(false);
  const attemptedKeysRef = useRef<Map<string, AbortController>>(new Map());

  const monthApiQuotes = useMemo(
    () => apiQuotesByMonth[month] ?? {},
    [apiQuotesByMonth, month],
  );

  const mergedMonthlyPrices = useMemo(() => {
    const userRows = monthlyPricesQuery.data ?? [];
    const histRows = marketHistoryQuery.data ?? [];
    if (histRows.length === 0) return userRows;

    const existingTickers = new Set(userRows.map((p) => p.ticker.toUpperCase().trim()));
    const syntheticFromHistory = histRows
      .filter((h) => !existingTickers.has(h.ticker.toUpperCase().trim()))
      .map((h) => ({
        id: `hist_${h.ticker}_${h.month}`,
        user_id: "",
        ticker: h.ticker,
        month: h.month,
        price: h.price,
        currency: h.currency,
        source: "api" as const,
        updated_at: h.market_price_at ?? undefined,
      }));
    return [...userRows, ...syntheticFromHistory];
  }, [monthlyPricesQuery.data, marketHistoryQuery.data]);

  useEffect(() => {
    if (
      isCurrent ||
      assetsQuery.isLoading ||
      monthlyPricesQuery.isLoading ||
      marketHistoryQuery.isLoading ||
      !assetsQuery.data
    ) {
      return;
    }

    const assets = assetsQuery.data ?? [];
    const savedTickerSet = new Set([
      ...(monthlyPricesQuery.data ?? []).map((p) => p.ticker.toUpperCase().trim()),
      ...(marketHistoryQuery.data ?? []).map((p) => p.ticker.toUpperCase().trim()),
    ]);

    const candidateTickers = new Set<string>();
    let hasUsdAsset = false;

    for (const a of assets) {
      if (a.currency === "USD") hasUsdAsset = true;
      const ticker = a.ticker.toUpperCase().trim();
      if (!ticker || ticker === "CAIXA" || ticker === "CASH") continue;
      if (isCashAssetClass(a.asset_class)) continue;
      if (isFixedIncomeClass(a.asset_class)) continue;
      if (isTesouroAsset(ticker, a.asset_class) || Boolean(normalizeTesouroTicker(ticker))) {
        continue;
      }
      if (isPrivateFixedIncomeTicker(ticker) || isCustomValuationAsset(a)) continue;
      candidateTickers.add(ticker);
    }

    if (hasUsdAsset) {
      candidateTickers.add("USDBRL=X");
    }

    // Tickers elegíveis que ainda não têm cotação salva e nunca foram consultados para este mês
    const missingTickers = [...candidateTickers].filter((ticker) => {
      if (savedTickerSet.has(ticker)) return false;
      const cacheKey = `${month}:${ticker}`;
      return !attemptedKeysRef.current.has(cacheKey);
    });

    if (missingTickers.length === 0) return;

    const abortController = new AbortController();
    const batchKeys = missingTickers.map((ticker) => `${month}:${ticker}`);
    for (const cacheKey of batchKeys) {
      attemptedKeysRef.current.set(cacheKey, abortController);
    }

    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted && !abortController.signal.aborted) setIsFetchingApiQuotes(true);
    });

    // Safety timeout: descongela a UI e aborta transporte em no máximo 3.5s caso a API externa/rede demore
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsFetchingApiQuotes(false);
    }, 3500);

    fetchHistoricalMonthlyQuotes(missingTickers, month, {
      existingHistoryRows: marketHistoryQuery.data ?? [],
      signal: abortController.signal,
    })
      .then((quotes) => {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }
        if (quotes.length > 0) {
          const newMap: Record<string, number> = {};
          for (const q of quotes) {
            if (q.price > 0) {
              newMap[q.ticker] = q.price;
            }
          }
          if (Object.keys(newMap).length > 0) {
            setApiQuotesByMonth((prev) => ({
              ...prev,
              [month]: {
                ...(prev[month] ?? {}),
                ...newMap,
              },
            }));
            void queryClient?.invalidateQueries({ queryKey: ["market_price_history", month] });
          }
        }
      })
      .catch(() => {
        const attemptedKeys = attemptedKeysRef.current;
        for (const cacheKey of batchKeys) {
          if (attemptedKeys.get(cacheKey) === abortController) {
            attemptedKeys.delete(cacheKey);
          }
        }
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        if (isMounted) setIsFetchingApiQuotes(false);
      });

    const attemptedKeys = attemptedKeysRef.current;
    return () => {
      isMounted = false;
      abortController.abort();
      for (const cacheKey of batchKeys) {
        if (attemptedKeys.get(cacheKey) === abortController) {
          attemptedKeys.delete(cacheKey);
        }
      }
      clearTimeout(safetyTimer);
    };
  }, [
    isCurrent,
    month,
    assetsQuery.data,
    assetsQuery.isLoading,
    monthlyPricesQuery.data,
    monthlyPricesQuery.isLoading,
    marketHistoryQuery.data,
    marketHistoryQuery.isLoading,
    queryClient,
  ]);

  // Execução do motor puro de Ponto-no-Tempo
  const historicalResult = useMemo<PointInTimeResult | null>(() => {
    if (isCurrent) return null;
    if (
      assetsQuery.isLoading ||
      transactionsQuery.isLoading ||
      dividendsQuery.isLoading ||
      monthlyPricesQuery.isLoading ||
      marketHistoryQuery.isLoading ||
      snapshotsQuery.isLoading
    ) {
      return null;
    }

    const assets = assetsQuery.data ?? [];
    const transactions = transactionsQuery.data ?? [];
    const dividends = dividendsQuery.data ?? [];
    const monthlyPrices = mergedMonthlyPrices;
    const annualCdiRate = macroQuery.data?.annualCdiRate ?? 10.5;

    // Localiza snapshot arquivado para este mês
    const targetSnapshot =
      (snapshotsQuery.data ?? []).find((s) => s.month === month) ?? null;

    // Localiza saldo de caixa gravado em snapshot ou no ativo Caixa
    const cashAsset = assets.find(
      (a) =>
        (a.asset_class ?? "").toLowerCase().trim() === "caixa" ||
        a.ticker.toUpperCase() === "CAIXA" ||
        a.ticker.toUpperCase() === "CASH",
    );
    const cashBalance = cashAsset ? cashAsset.quantity : undefined;

    // Localiza aportes e resgates externos do bolso para a competência
    const monthContributions = (contributionsQuery.data ?? []).filter(
      (c) => Boolean(c.date && c.date.startsWith(month)),
    );
    const explicitRate =
      monthContributions
        .map((c) => extractExplicitRateFromNotes(c.notes))
        .find((r) => r !== null) ?? null;

    const externalFlows: MonthlyStatementCashFlow[] = monthContributions.map((c) => {
      const isWithdrawal = isHistoricalWithdrawal(c);
      const signedAmount = isWithdrawal ? -Math.abs(c.amount) : Math.abs(c.amount);
      return {
        date: c.date,
        amount: signedAmount,
        notes: c.notes,
      };
    });

    const explicitHistoricalUsd =
      monthApiQuotes["USDBRL=X"] && monthApiQuotes["USDBRL=X"] > 0
        ? monthApiQuotes["USDBRL=X"]
        : undefined;

    return calculatePointInTimePosition({
      month,
      assets,
      transactions,
      dividends,
      monthlyPrices,
      snapshot: targetSnapshot,
      snapshots: snapshotsQuery.data ?? [],
      apiPrices: monthApiQuotes,
      usdRate: explicitHistoricalUsd,
      annualCdiRate,
      cashBalance,
      externalFlows,
      explicitRatePct: explicitRate,
    });
  }, [
    isCurrent,
    month,
    assetsQuery.data,
    assetsQuery.isLoading,
    transactionsQuery.data,
    transactionsQuery.isLoading,
    dividendsQuery.data,
    dividendsQuery.isLoading,
    contributionsQuery.data,
    mergedMonthlyPrices,
    monthlyPricesQuery.isLoading,
    marketHistoryQuery.isLoading,
    snapshotsQuery.data,
    snapshotsQuery.isLoading,
    macroQuery.data,
    monthApiQuotes,
  ]);

  if (isCurrent) {
    const prevMonth = getPreviousMonth(month);
    const prevSnapshot = (snapshotsQuery.data ?? []).find((s) => s.month === prevMonth);
    const prevStartBalance =
      prevSnapshot && prevSnapshot.total_value !== undefined && prevSnapshot.total_value !== null
        ? Number(prevSnapshot.total_value) || 0
        : 0;
    const assetMap = new Map<string, PortfolioAsset>(
      (assetsQuery.data ?? []).map((a) => [a.id, a]),
    );
    const usdRateCurrent =
      currentPos.usdRate ??
      currentPos.rows.find((r) => r.currency === "USD")?.usdRate ??
      FALLBACK_USD_RATE;

    const currentDividends = (dividendsQuery.data ?? []).map((d) => {
      const asset = d.asset_id ? assetMap.get(d.asset_id) : undefined;
      const isUSD = asset?.currency === "USD";
      const fx = isUSD ? usdRateCurrent : 1;
      const rawAmount = Number(d.amount) || 0;
      return {
        date: d.date,
        amount: Math.round(rawAmount * fx * 100) / 100,
        ticker: d.ticker,
        notes: d.notes,
      };
    });

    const currentTransactions = (transactionsQuery.data ?? []).map((t) => {
      const asset = assetMap.get(t.asset_id);
      const isUSD = asset?.currency === "USD";
      const fx = isUSD ? usdRateCurrent : 1;
      const rawTotal = Number(t.total) || (Number(t.quantity) || 0) * (Number(t.price) || 0);
      return {
        date: t.date,
        type: t.type,
        quantity: Number(t.quantity) || 0,
        price: Number(t.price) || 0,
        total: Math.round(rawTotal * fx * 100) / 100,
        ticker: asset?.ticker ?? null,
      };
    });

    const currentMonthContributions = (contributionsQuery.data ?? []).filter(
      (c) => Boolean(c.date && c.date.startsWith(month)),
    );
    const explicitRateCurrent =
      currentMonthContributions
        .map((c) => extractExplicitRateFromNotes(c.notes))
        .find((r) => r !== null) ?? null;

    const currentExternalFlows: MonthlyStatementCashFlow[] = currentMonthContributions.map((c) => {
      const isWithdrawal = isHistoricalWithdrawal(c);
      const signedAmount = isWithdrawal ? -Math.abs(c.amount) : Math.abs(c.amount);
      return {
        date: c.date,
        amount: signedAmount,
        notes: c.notes,
      };
    });

    // Modalidade B: Invariante Contábil de Fluxo Externo (Bloco 1 v6 / FINANCIAL_MATH_SPEC §4.2)
    // Em competências operacionais vivas (mês corrente MTD), o aporte líquido injetado (F_t)
    // deriva ESTRITAMENTE dos eventos reais do ledger e aportes externos do bolso,
    // nunca sendo sobrescrito ou contaminado por Delta C bruto cambial ou ajustes sintéticos.
    const curMonthSeriesPoint = currentPos.monthlySeries?.find((p) => p.month === month);

    const currentStatement = calculateMonthlyStatement({
      month,
      startBalanceBRL: prevStartBalance,
      endBalanceBRL: currentPos.totalBRL,
      externalFlows: currentExternalFlows,
      dividends: currentDividends,
      transactions: currentTransactions,
      explicitRatePct: explicitRateCurrent ?? curMonthSeriesPoint?.twrMonthPct ?? null,
    });

    if (curMonthSeriesPoint?.netContributionBRL != null) {
      currentStatement.monthNetContributionBRL = curMonthSeriesPoint.netContributionBRL;
      currentStatement.monthNetPnlBRL =
        Math.round((currentPos.totalBRL - prevStartBalance - curMonthSeriesPoint.netContributionBRL) * 100) / 100;
      if (curMonthSeriesPoint.twrMonthPct != null) {
        currentStatement.monthRatePct = curMonthSeriesPoint.twrMonthPct;
      }
    }

    // Mapeia usePortfolioPosition para a estrutura unificada PointInTimeResult sem mascarar fallback/manual
    const nonCashRows = currentPos.rows.filter((r) => !r.isCash);
    const calibratedCount = nonCashRows.filter((r) => r.source === "manual").length;
    const fallbackCount = nonCashRows.filter((r) =>
      Boolean(r.isEstimate ?? r.source === "fallback"),
    ).length;
    const apiCount = Math.max(0, nonCashRows.length - calibratedCount - fallbackCount);

    const mappedCurrentResult: PointInTimeResult = {
      month,
      cutoffDate: `${month}-01`,
      positions: nonCashRows.map((r) => ({
        assetId: r.assetId,
        ticker: r.ticker,
        assetClass: r.assetClass ?? "Outros",
        sector: r.sector ?? null,
        currency: r.currency,
        quantity: r.quantity,
        averagePrice: r.averageCost,
        totalCost: r.totalCost,
        totalCostBRL: r.totalCostBRL,
        priceQuote: r.priceQuote,
        priceBRL: r.priceBRL,
        valueBRL: r.valueBRL,
        quoteSource: r.source,
        isEstimate: Boolean(r.isEstimate ?? r.source === "fallback"),
        unrealizedPnl: r.unrealizedPnl,
        unrealizedPct: r.unrealizedPct,
        monthDividendsBRL: 0,
        accumulatedDividendsBRL: r.dividends,
        totalReturnPnl: r.totalReturnPnl,
        totalReturnPct: r.totalReturnPct,
      })),
      cashQuantity: currentPos.cashBRL,
      totalInvestedBRL: currentPos.totalBRL - currentPos.cashBRL,
      totalCostBRL: currentPos.totalCostBRL,
      totalValueBRL: currentPos.totalBRL,
      monthDividendsTotalBRL: currentStatement.monthDividendsBRL,
      accumulatedDividendsTotalBRL: currentPos.rows.reduce((acc, r) => acc + (r.dividends ?? 0), 0),
      fidelity: {
        status: "complete",
        canGenerateExecutiveReport: true,
        reasons: [],
        reconstructedTotalValue: currentPos.totalBRL,
        totalAssetsCount: nonCashRows.length,
        calibratedQuotesCount: calibratedCount,
        apiQuotesCount: apiCount,
        fallbackQuotesCount: fallbackCount,
        isDerivedFromSnapshot: false,
      },
      isDerivedFromSnapshot: false,
      usdRate: usdRateCurrent,
      monthlyStatement: currentStatement,
    };

    return {
      data: mappedCurrentResult,
      isLoading: currentPos.isLoading,
      isError: Boolean(currentPos.error),
      isCurrentMonth: true,
      isEnrichingQuotes: false,
      assets: assetsQuery.data ?? [],
      error: currentPos.error ?? null,
      refetch: () => {
        void currentPos.refetch();
      },
    };
  }

  // Carregamento instantâneo: depende estritamente das queries locais do banco Supabase (<50ms).
  // A busca de cotações em APIs externas roda de forma 100% não-bloqueante em background.
  const isLoading =
    assetsQuery.isLoading ||
    transactionsQuery.isLoading ||
    dividendsQuery.isLoading ||
    contributionsQuery.isLoading ||
    monthlyPricesQuery.isLoading ||
    marketHistoryQuery.isLoading ||
    snapshotsQuery.isLoading;

  const isError =
    assetsQuery.isError ||
    transactionsQuery.isError ||
    dividendsQuery.isError ||
    contributionsQuery.isError ||
    monthlyPricesQuery.isError ||
    marketHistoryQuery.isError ||
    snapshotsQuery.isError;

  const error =
    (assetsQuery.error as Error | null) ??
    (transactionsQuery.error as Error | null) ??
    (dividendsQuery.error as Error | null) ??
    (contributionsQuery.error as Error | null) ??
    (monthlyPricesQuery.error as Error | null) ??
    (marketHistoryQuery.error as Error | null) ??
    (snapshotsQuery.error as Error | null);

  return {
    data: historicalResult,
    isLoading,
    isError,
    isCurrentMonth: false,
    isEnrichingQuotes: isFetchingApiQuotes,
    assets: assetsQuery.data ?? [],
    error,
    refetch: () => {
      attemptedKeysRef.current.clear();
      void queryClient?.invalidateQueries({ queryKey: ["market_price_history", month] });
      void assetsQuery.refetch();
      void transactionsQuery.refetch();
      void dividendsQuery.refetch();
      void contributionsQuery.refetch();
      void monthlyPricesQuery.refetch();
      void marketHistoryQuery.refetch();
      void snapshotsQuery.refetch();
    },
  };
}
