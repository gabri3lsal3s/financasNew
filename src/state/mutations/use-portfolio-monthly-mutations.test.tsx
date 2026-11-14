import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSaveMonthlyClosing } from "./use-portfolio-monthly-mutations";
import { useDeletePortfolioSnapshot } from "./use-portfolio-snapshots-mutations";
import * as rpcModule from "@/data/rpc/portfolio";
import * as pricesRepo from "@/data/repositories/portfolio-monthly-prices";
import * as snapRepo from "@/data/repositories/portfolio";
import { PORTFOLIO_QUERY_KEYS } from "./use-portfolio-mutations";
import { PORTFOLIO_MONTHLY_PRICES_QUERY_KEY } from "@/state/queries/use-portfolio-monthly-prices";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
}

describe("useSaveMonthlyClosing & useDeletePortfolioSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama commitMonthlyClosingRpc prioritariamente com dados normalizados", async () => {
    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const rpcSpy = vi.spyOn(rpcModule, "commitMonthlyClosingRpc").mockResolvedValue({
      success: true,
      month: "2026-08",
      total_value: 50000,
      total_cost: 40000,
      prices_count: 1,
    });

    const { result } = renderHook(() => useSaveMonthlyClosing(), { wrapper });

    await result.current.mutateAsync({
      month: "2026-08",
      closingDate: "2026-08-31",
      prices: [
        {
          ticker: "PETR4",
          month: "2026-08",
          price: 35.5,
          currency: "BRL",
          source: "api",
        },
      ],
      totalValueBRL: 50000,
      totalCostBRL: 40000,
    });

    expect(rpcSpy).toHaveBeenCalledWith({
      month: "2026-08",
      closing_date: "2026-08-31",
      prices: [
        {
          ticker: "PETR4",
          price: 35.5,
          currency: "BRL",
          source: "api",
        },
      ],
      total_value: 50000,
      total_cost: 40000,
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, "2026-08"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: PORTFOLIO_QUERY_KEYS.snapshots,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["portfolio_position"],
      });
    });
  });

  it("executa fallback gracioso via repositório quando a RPC não estiver disponível", async () => {
    const { wrapper } = createWrapper();

    vi.spyOn(rpcModule, "commitMonthlyClosingRpc").mockRejectedValue(new Error("RPC not found"));
    const pricesSpy = vi
      .spyOn(pricesRepo, "upsertPortfolioMonthlyPricesBatch")
      .mockResolvedValue(undefined);
    const snapshotSpy = vi.spyOn(snapRepo, "upsertPortfolioSnapshot").mockResolvedValue({
      id: "s1",
      user_id: "u1",
      month: "2026-08",
      total_value: 50000,
      total_cost: 40000,
      status: "closed",
    });

    const { result } = renderHook(() => useSaveMonthlyClosing(), { wrapper });

    await result.current.mutateAsync({
      month: "2026-08",
      closingDate: "2026-08-31",
      prices: [
        {
          ticker: "VALE3",
          month: "2026-08",
          price: 60,
          currency: "BRL",
          source: "manual",
        },
      ],
      totalValueBRL: 50000,
      totalCostBRL: 40000,
    });

    expect(pricesSpy).toHaveBeenCalledWith([
      expect.objectContaining({ ticker: "VALE3", price: 60 }),
    ]);
    expect(snapshotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-08",
        total_value: 50000,
        total_cost: 40000,
        status: "closed",
        closing_date: "2026-08-31",
      }),
    );
  });

  it("useDeletePortfolioSnapshot invalida cotações mensais e snapshots", async () => {
    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(snapRepo, "deletePortfolioSnapshot").mockResolvedValue();

    const { result } = renderHook(() => useDeletePortfolioSnapshot(), { wrapper });

    await result.current.mutateAsync("2026-08");

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: PORTFOLIO_QUERY_KEYS.snapshots,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["portfolio_position"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, "2026-08"],
      });
    });
  });
});
