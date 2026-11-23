import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolioMonthlyPosition } from "./use-portfolio-monthly-position";
import * as usePortfolioModule from "./use-portfolio";
import * as usePortfolioPositionModule from "./use-portfolio-position";
import * as usePortfolioMonthlyPricesModule from "./use-portfolio-monthly-prices";
import * as useMacroIndicatorsModule from "./use-macro-indicators";

const listMarketPriceHistoryByMonthMock = vi.fn().mockResolvedValue([]);
const fetchHistoricalMonthlyQuotesMock = vi.fn().mockResolvedValue([]);

vi.mock("@/data/repositories/asset-prices", () => ({
  listMarketPriceHistoryByMonth: (...args: unknown[]) =>
    listMarketPriceHistoryByMonthMock(...args),
}));

vi.mock("@/services/quotes", () => ({
  fetchHistoricalMonthlyQuotes: (...args: unknown[]) =>
    fetchHistoricalMonthlyQuotesMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePortfolioMonthlyPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMarketPriceHistoryByMonthMock.mockResolvedValue([]);
    fetchHistoricalMonthlyQuotesMock.mockResolvedValue([]);
  });

  it("retorna diretamente usePortfolioPosition quando a competência é o mês corrente", () => {
    const mockRefetch = vi.fn();
    vi.spyOn(usePortfolioPositionModule, "usePortfolioPosition").mockReturnValue({
      rows: [
        {
          assetId: "a1",
          ticker: "PETR4",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 100,
          averageCost: 30,
          totalCost: 3000,
          totalCostBRL: 3000,
          priceQuote: 35,
          priceBRL: 35,
          valueBRL: 3500,
          source: "api",
          isCash: false,
          unrealizedPnl: 500,
          unrealizedPct: 16.67,
          dividends: 100,
          totalReturnPnl: 600,
          totalReturnPct: 20,
        },
      ],
      totalBRL: 3500,
      totalCostBRL: 3000,
      cashBRL: 0,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePortfolioPositionModule.usePortfolioPosition>);

    vi.spyOn(usePortfolioModule, "usePortfolioAssets").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioAssets>);

    vi.spyOn(usePortfolioModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.useAllPortfolioTransactions>);

    vi.spyOn(usePortfolioModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioDividends>);

    vi.spyOn(usePortfolioModule, "usePortfolioContributions").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioContributions>);

    vi.spyOn(usePortfolioModule, "usePortfolioSnapshots").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioSnapshots>);

    vi.spyOn(usePortfolioMonthlyPricesModule, "usePortfolioMonthlyPrices").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioMonthlyPricesModule.usePortfolioMonthlyPrices>);

    vi.spyOn(useMacroIndicatorsModule, "useMacroIndicators").mockReturnValue({
      data: { cdiAnnual: 10.5, selicAnnual: 10.5, ipcaAnnual: 4.0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useMacroIndicatorsModule.useMacroIndicators>);

    // Supõe mês atual como 2099-12 (garantido >= currentMonth)
    const { result } = renderHook(() => usePortfolioMonthlyPosition("2099-12"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCurrentMonth).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.totalValueBRL).toBe(3500);
    expect(result.current.data?.positions).toHaveLength(1);
    expect(result.current.data?.positions[0]?.ticker).toBe("PETR4");

    result.current.refetch();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("reconstrói a posição histórica via calculatePointInTimePosition para mês anterior", async () => {
    vi.spyOn(usePortfolioPositionModule, "usePortfolioPosition").mockReturnValue({
      rows: [],
      totalBRL: 0,
      totalCostBRL: 0,
      cashBRL: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioPositionModule.usePortfolioPosition>);

    vi.spyOn(usePortfolioModule, "usePortfolioAssets").mockReturnValue({
      data: [
        {
          id: "a1",
          user_id: "u1",
          ticker: "PETR4",
          asset_class: "Ações",
          currency: "BRL",
          quantity: 100,
          average_price: 30,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioAssets>);

    vi.spyOn(usePortfolioModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [
        {
          id: "tx-1",
          user_id: "u1",
          asset_id: "a1",
          type: "buy",
          date: "2026-01-10",
          quantity: 100,
          price: 30,
          total: 3000,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.useAllPortfolioTransactions>);

    vi.spyOn(usePortfolioModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioDividends>);

    vi.spyOn(usePortfolioModule, "usePortfolioContributions").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioContributions>);

    vi.spyOn(usePortfolioModule, "usePortfolioSnapshots").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioSnapshots>);

    vi.spyOn(usePortfolioMonthlyPricesModule, "usePortfolioMonthlyPrices").mockReturnValue({
      data: [
        {
          id: "p1",
          user_id: "u1",
          ticker: "PETR4",
          month: "2026-01",
          price: 36,
          currency: "BRL",
          source: "api",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioMonthlyPricesModule.usePortfolioMonthlyPrices>);

    vi.spyOn(useMacroIndicatorsModule, "useMacroIndicators").mockReturnValue({
      data: { annualCdiRate: 10.5, annualSelicRate: 10.5, annualIpcaRate: 4.0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useMacroIndicatorsModule.useMacroIndicators>);

    const { result } = renderHook(() => usePortfolioMonthlyPosition("2026-01"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isCurrentMonth).toBe(false);
    expect(result.current.data?.cutoffDate).toBe("2026-01-31");
    expect(result.current.data?.totalInvestedBRL).toBe(3600); // 100 * 36
    expect(result.current.data?.positions).toHaveLength(1);
    expect(result.current.data?.positions[0]?.unrealizedPnl).toBe(600);
    expect(listMarketPriceHistoryByMonthMock).toHaveBeenCalledWith("2026-01", { onlyMonthEnd: true });
  });

  it("não entra em loop infinito e finaliza o loading quando não há cotações salvas e a API retorna vazio", async () => {
    vi.spyOn(usePortfolioPositionModule, "usePortfolioPosition").mockReturnValue({
      rows: [],
      totalBRL: 0,
      totalCostBRL: 0,
      cashBRL: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioPositionModule.usePortfolioPosition>);

    vi.spyOn(usePortfolioModule, "usePortfolioAssets").mockReturnValue({
      data: [
        {
          id: "a-sem-cotacao",
          user_id: "u1",
          ticker: "ATIVO_CUSTOM_1",
          asset_class: "Outros",
          currency: "BRL",
          quantity: 10,
          average_price: 50,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioAssets>);

    vi.spyOn(usePortfolioModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [
        {
          id: "tx-2",
          user_id: "u1",
          asset_id: "a-sem-cotacao",
          type: "buy",
          date: "2026-01-05",
          quantity: 10,
          price: 50,
          total: 500,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.useAllPortfolioTransactions>);

    vi.spyOn(usePortfolioModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioDividends>);

    vi.spyOn(usePortfolioModule, "usePortfolioSnapshots").mockReturnValue({
      data: [
        {
          id: "snap-1",
          user_id: "u1",
          month: "2026-01",
          total_value: 500,
          total_cost: 500,
          cash_balance: 0,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioModule.usePortfolioSnapshots>);

    // Sem cotações pré-salvas na tabela
    vi.spyOn(usePortfolioMonthlyPricesModule, "usePortfolioMonthlyPrices").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePortfolioMonthlyPricesModule.usePortfolioMonthlyPrices>);

    vi.spyOn(useMacroIndicatorsModule, "useMacroIndicators").mockReturnValue({
      data: { annualCdiRate: 10.5, annualSelicRate: 10.5, annualIpcaRate: 4.0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useMacroIndicatorsModule.useMacroIndicators>);

    const { result } = renderHook(() => usePortfolioMonthlyPosition("2026-01"), {
      wrapper: createWrapper(),
    });

    // O hook conclui com os dados da cascata e fidelity calculados
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isCurrentMonth).toBe(false);
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.positions).toHaveLength(1);
    expect(result.current.data?.fidelity).toBeDefined();
  });
});
