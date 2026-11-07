/**
 * Hook de consulta dos proventos corporativos B3 e apuração de proventos sugeridos.
 *
 * Integra a inteligência da B3 com a custódia sob ponto-no-tempo do investidor,
 * segregando entre "Disponíveis para Crédito" e "Previstos".
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listCorporateDividends,
  listPortfolioDividendDismissals,
} from "@/data/repositories/portfolio";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioDividends,
} from "./use-portfolio";
import {
  calculateSuggestedDividends,
  type SuggestedDividendsResult,
} from "@/domain/portfolio";

export const CORPORATE_DIVIDENDS_QUERY_KEY = ["corporate_dividends"] as const;
export const PORTFOLIO_DIVIDEND_DISMISSALS_QUERY_KEY = ["portfolio_dividend_dismissals"] as const;

export interface UseCorporateDividendsState extends SuggestedDividendsResult {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useCorporateDividends(): UseCorporateDividendsState {
  const corporateQuery = useQuery({
    queryKey: CORPORATE_DIVIDENDS_QUERY_KEY,
    queryFn: () => listCorporateDividends(),
    staleTime: 1000 * 60 * 15, // 15 minutos
  });

  const dismissalsQuery = useQuery({
    queryKey: PORTFOLIO_DIVIDEND_DISMISSALS_QUERY_KEY,
    queryFn: () => listPortfolioDividendDismissals(),
    staleTime: 1000 * 60 * 5,
  });

  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const manualDividendsQuery = usePortfolioDividends();

  const isLoading =
    corporateQuery.isLoading ||
    dismissalsQuery.isLoading ||
    assetsQuery.isLoading ||
    transactionsQuery.isLoading ||
    manualDividendsQuery.isLoading;

  const isError =
    corporateQuery.isError ||
    dismissalsQuery.isError ||
    assetsQuery.isError ||
    transactionsQuery.isError ||
    manualDividendsQuery.isError;

  const refetch = () => {
    corporateQuery.refetch();
    dismissalsQuery.refetch();
  };

  const calculation = useMemo<SuggestedDividendsResult>(() => {
    if (isLoading || isError) {
      return {
        available: [],
        projected: [],
        totalAvailableAmount: 0,
        totalProjectedAmount: 0,
      };
    }

    const corporateEvents = corporateQuery.data ?? [];
    const dismissals = dismissalsQuery.data ?? [];
    const assets = assetsQuery.data ?? [];
    const transactions = transactionsQuery.data ?? [];
    const manualDividends = manualDividendsQuery.data ?? [];

    return calculateSuggestedDividends({
      corporateEvents,
      dismissals,
      assets,
      transactions,
      manualDividends,
    });
  }, [
    isLoading,
    isError,
    corporateQuery.data,
    dismissalsQuery.data,
    assetsQuery.data,
    transactionsQuery.data,
    manualDividendsQuery.data,
  ]);

  return {
    ...calculation,
    isLoading,
    isError,
    refetch,
  };
}
