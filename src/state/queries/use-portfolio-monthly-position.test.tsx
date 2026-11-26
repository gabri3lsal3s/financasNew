import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolioMonthlyPosition } from "./use-portfolio-monthly-position";

const mockFetchHistoricalMonthlyQuotes = vi.fn();

vi.mock("@/services/quotes", () => ({
  fetchHistoricalMonthlyQuotes: (...args: unknown[]) =>
    mockFetchHistoricalMonthlyQuotes(...args),
}));

vi.mock("@/data/repositories/asset-prices", () => ({
  listMarketPriceHistoryByMonth: vi.fn().mockResolvedValue([]),
}));

const MOCK_ASSETS = [
  {
    id: "asset-1",
    user_id: "u1",
    ticker: "PETR4",
    asset_class: "Ações",
    currency: "BRL",
    quantity: 10,
    average_price: 30,
  },
];
const MOCK_TXS = [
  {
    id: "tx-1",
    user_id: "u1",
    asset_id: "asset-1",
    type: "buy",
    date: "2025-12-01",
    quantity: 10,
    price: 30,
    total: 300,
  },
];
const EMPTY_ARR: never[] = [];
const MOCK_ROWS: never[] = [];
const MOCK_MACRO = { annualCdiRate: 11.75 };

vi.mock("./use-portfolio", () => ({
  usePortfolioAssets: () => ({ data: MOCK_ASSETS, isLoading: false, error: null }),
  useAllPortfolioTransactions: () => ({ data: MOCK_TXS, isLoading: false, error: null }),
  usePortfolioDividends: () => ({ data: EMPTY_ARR, isLoading: false, error: null }),
  usePortfolioContributions: () => ({ data: EMPTY_ARR, isLoading: false, error: null }),
  usePortfolioMonthlyPrices: () => ({ data: EMPTY_ARR, isLoading: false, error: null }),
  usePortfolioSnapshots: () => ({ data: EMPTY_ARR, isLoading: false, error: null }),
}));

vi.mock("./use-portfolio-position", () => ({
  usePortfolioPosition: () => ({
    rows: MOCK_ROWS,
    usdRate: 5,
    totalBRL: 0,
    totalInvestedBRL: 0,
    cashBRL: 0,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("./use-macro-indicators", () => ({
  useMacroIndicators: () => ({ data: MOCK_MACRO, isLoading: false }),
}));

describe("usePortfolioMonthlyPosition — T3.2 A→B→A race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("libera chave sincronamente no cleanup e resolve A corretamente quando A→B→A ocorre antes da rejeição antiga", async () => {
    let rejectFirstA: ((err: unknown) => void) | null = null;
    let callCount = 0;

    mockFetchHistoricalMonthlyQuotes.mockImplementation(
      (_tickers: string[], month: string) => {
        callCount++;
        if (callCount === 1 && month === "2026-01") {
          return new Promise((_resolve, reject) => {
            rejectFirstA = reject;
          });
        }
        if (month === "2026-02") {
          return Promise.resolve([
            { ticker: "PETR4", price: 41, currency: "BRL", source: "api" },
          ]);
        }
        return Promise.resolve([
          { ticker: "PETR4", price: 39.5, currency: "BRL", source: "api" },
        ]);
      },
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      ({ m }: { m: string }) => usePortfolioMonthlyPosition(m),
      { initialProps: { m: "2026-01" }, wrapper },
    );

    await waitFor(() => expect(mockFetchHistoricalMonthlyQuotes).toHaveBeenCalledTimes(1));

    // Troca A -> B
    rerender({ m: "2026-02" });
    await waitFor(() => expect(mockFetchHistoricalMonthlyQuotes).toHaveBeenCalledTimes(2));

    // Volta B -> A ANTES que a primeira promessa de A rejeite
    rerender({ m: "2026-01" });
    await waitFor(() => expect(mockFetchHistoricalMonthlyQuotes).toHaveBeenCalledTimes(3));

    // Rejeição atrasada da primeira tentativa de A não apaga a posse da nova tentativa
    rejectFirstA?.(new DOMException("Aborted", "AbortError"));

    await waitFor(() => {
      const petrRow = result.current.data?.positions.find((r) => r.ticker === "PETR4");
      expect(petrRow?.priceQuote).toBe(39.5);
    });
  });
});
