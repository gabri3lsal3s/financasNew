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

import { useEffect, useMemo, useState } from "react";
import { currentMonth } from "@/lib/date";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioDividends,
} from "./use-portfolio";
import { usePortfolioMonthlyPrices } from "./use-portfolio-monthly-prices";
import { usePortfolioPosition } from "./use-portfolio-position";
import { useMacroIndicators } from "./use-macro-indicators";
import { fetchHistoricalMonthlyQuotes } from "@/services/quotes";
import { calculatePointInTimePosition, type PointInTimeResult } from "@/domain/portfolio";

export interface PortfolioMonthlyPositionState {
  data: PointInTimeResult | null;
  isLoading: boolean;
  isError: boolean;
  isCurrentMonth: boolean;
  error: unknown;
  refetch: () => void;
}

export function usePortfolioMonthlyPosition(month: string): PortfolioMonthlyPositionState {
  const isCurrent = month >= currentMonth();

  // Se for o mês corrente, delega para usePortfolioPosition
  const currentPos = usePortfolioPosition();

  // Queries para reconstrução retroativa
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const dividendsQuery = usePortfolioDividends();
  const monthlyPricesQuery = usePortfolioMonthlyPrices(month);
  const macroQuery = useMacroIndicators();

  // Cotações buscadas via API sob demanda para tickers sem registro salvo
  const [apiQuotesMap, setApiQuotesMap] = useState<Record<string, number>>({});
  const [isFetchingApiQuotes, setIsFetchingApiQuotes] = useState(false);

  useEffect(() => {
    if (isCurrent || assetsQuery.isLoading || !assetsQuery.data) return;

    const assets = assetsQuery.data ?? [];
    const savedPrices = monthlyPricesQuery.data ?? [];
    const savedTickerSet = new Set(savedPrices.map((p) => p.ticker.toUpperCase().trim()));

    // Tickers elegíveis que ainda não têm cotação salva
    const missingTickers = assets
      .map((a) => a.ticker.toUpperCase().trim())
      .filter(
        (ticker) =>
          ticker &&
          ticker !== "CAIXA" &&
          ticker !== "CASH" &&
          !savedTickerSet.has(ticker) &&
          apiQuotesMap[ticker] === undefined,
      );

    if (missingTickers.length === 0) return;

    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) setIsFetchingApiQuotes(true);
    });

    fetchHistoricalMonthlyQuotes(missingTickers, month)
      .then((quotes) => {
        if (!isMounted) return;
        const newMap: Record<string, number> = {};
        for (const q of quotes) {
          if (q.price > 0) {
            newMap[q.ticker] = q.price;
          }
        }
        setApiQuotesMap((prev) => ({ ...prev, ...newMap }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setIsFetchingApiQuotes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isCurrent, month, assetsQuery.data, assetsQuery.isLoading, monthlyPricesQuery.data, apiQuotesMap]);

  // Execução do motor puro de Ponto-no-Tempo
  const historicalResult = useMemo<PointInTimeResult | null>(() => {
    if (isCurrent) return null;
    if (
      assetsQuery.isLoading ||
      transactionsQuery.isLoading ||
      dividendsQuery.isLoading ||
      monthlyPricesQuery.isLoading
    ) {
      return null;
    }

    const assets = assetsQuery.data ?? [];
    const transactions = transactionsQuery.data ?? [];
    const dividends = dividendsQuery.data ?? [];
    const monthlyPrices = monthlyPricesQuery.data ?? [];
    const annualCdiRate = macroQuery.data?.annualCdiRate ?? 10.5;

    // Localiza saldo de caixa gravado em snapshot ou no ativo Caixa
    const cashAsset = assets.find(
      (a) =>
        (a.asset_class ?? "").toLowerCase().trim() === "caixa" ||
        a.ticker.toUpperCase() === "CAIXA" ||
        a.ticker.toUpperCase() === "CASH",
    );
    const cashBalance = cashAsset ? cashAsset.quantity : undefined;

    return calculatePointInTimePosition({
      month,
      assets,
      transactions,
      dividends,
      monthlyPrices,
      apiPrices: apiQuotesMap,
      annualCdiRate,
      cashBalance,
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
    monthlyPricesQuery.data,
    monthlyPricesQuery.isLoading,
    macroQuery.data,
    apiQuotesMap,
  ]);

  if (isCurrent) {
    // Mapeia usePortfolioPosition para a estrutura unificada PointInTimeResult
    const mappedCurrentResult: PointInTimeResult = {
      month,
      cutoffDate: `${month}-01`,
      positions: currentPos.rows
        .filter((r) => !r.isCash)
        .map((r) => ({
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
          isEstimate: false,
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
      monthDividendsTotalBRL: 0,
      accumulatedDividendsTotalBRL: currentPos.rows.reduce((acc, r) => acc + (r.dividends ?? 0), 0),
    };

    return {
      data: mappedCurrentResult,
      isLoading: currentPos.isLoading,
      isError: Boolean(currentPos.error),
      isCurrentMonth: true,
      error: currentPos.error ?? null,
      refetch: () => {
        void currentPos.refetch();
      },
    };
  }

  const isLoading =
    assetsQuery.isLoading ||
    transactionsQuery.isLoading ||
    dividendsQuery.isLoading ||
    monthlyPricesQuery.isLoading ||
    isFetchingApiQuotes;

  const isError =
    assetsQuery.isError ||
    transactionsQuery.isError ||
    dividendsQuery.isError ||
    monthlyPricesQuery.isError;

  const error =
    (assetsQuery.error as Error | null) ??
    (transactionsQuery.error as Error | null) ??
    (dividendsQuery.error as Error | null) ??
    (monthlyPricesQuery.error as Error | null);

  return {
    data: historicalResult,
    isLoading,
    isError,
    isCurrentMonth: false,
    error,
    refetch: () => {
      void assetsQuery.refetch();
      void transactionsQuery.refetch();
      void dividendsQuery.refetch();
      void monthlyPricesQuery.refetch();
    },
  };
}
