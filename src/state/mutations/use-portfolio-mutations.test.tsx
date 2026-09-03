import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useDeletePortfolioTransaction,
  useDeletePortfolioContribution,
  useDeletePortfolioDividend,
  PORTFOLIO_QUERY_KEYS,
} from "./use-portfolio-mutations";
import * as repo from "@/data/repositories/portfolio";

vi.mock("@/data/repositories/portfolio", () => ({
  createPortfolioAsset: vi.fn(),
  updatePortfolioAsset: vi.fn(),
  deletePortfolioAsset: vi.fn(),
  createPortfolioTransaction: vi.fn(),
  createPortfolioTransactionsBatch: vi.fn(),
  updatePortfolioTransaction: vi.fn(),
  deletePortfolioTransaction: vi.fn().mockResolvedValue(undefined),
  deletePortfolioTransactionsMatching: vi.fn().mockResolvedValue(undefined),
  createPortfolioContribution: vi.fn(),
  deletePortfolioContribution: vi.fn().mockResolvedValue(undefined),
  deletePortfolioContributionsMatching: vi.fn().mockResolvedValue(undefined),
  createPortfolioDividend: vi.fn(),
  deletePortfolioDividend: vi.fn().mockResolvedValue(undefined),
  deletePortfolioDividendsMatching: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("use-portfolio-mutations (Sincronização em Cascata)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it("useDeletePortfolioDividend exclui o provento e remove a transação correspondente no histórico", async () => {
    const { result } = renderHook(() => useDeletePortfolioDividend(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "div-123",
        asset_id: "asset-petr4",
        date: "2026-08-20",
        amount: 50.0,
      });
    });

    expect(repo.deletePortfolioDividend).toHaveBeenCalledWith("div-123");
    expect(repo.deletePortfolioTransactionsMatching).toHaveBeenCalledWith({
      asset_id: "asset-petr4",
      date: "2026-08-20",
      types: ["dividend", "jcp", "fii_yield"],
      total: 50.0,
    });
  });

  it("useDeletePortfolioContribution exclui o aporte e remove a compra correspondente no histórico", async () => {
    const { result } = renderHook(() => useDeletePortfolioContribution(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "contrib-123",
        asset_id: "asset-petr4",
        date: "2026-08-15",
        amount: 3850.0,
      });
    });

    expect(repo.deletePortfolioContribution).toHaveBeenCalledWith("contrib-123");
    expect(repo.deletePortfolioTransactionsMatching).toHaveBeenCalledWith({
      asset_id: "asset-petr4",
      date: "2026-08-15",
      types: ["buy"],
    });
  });

  it("useDeletePortfolioTransaction de provento exclui a transação e o provento vinculado", async () => {
    const { result } = renderHook(() => useDeletePortfolioTransaction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "tx-div-1",
        asset_id: "asset-vale3",
        type: "dividend",
        date: "2026-08-22",
        total: 120.5,
      });
    });

    expect(repo.deletePortfolioTransaction).toHaveBeenCalledWith("tx-div-1");
    expect(repo.deletePortfolioDividendsMatching).toHaveBeenCalledWith({
      asset_id: "asset-vale3",
      date: "2026-08-22",
      amount: 120.5,
    });
  });

  it("useDeletePortfolioTransaction de compra exclui a transação e o aporte financeiro vinculado", async () => {
    const { result } = renderHook(() => useDeletePortfolioTransaction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "tx-buy-1",
        asset_id: "asset-vale3",
        type: "buy",
        date: "2026-08-10",
        total: 2500.0,
      });
    });

    expect(repo.deletePortfolioTransaction).toHaveBeenCalledWith("tx-buy-1");
    expect(repo.deletePortfolioContributionsMatching).toHaveBeenCalledWith({
      asset_id: "asset-vale3",
      date: "2026-08-10",
    });
  });

  it("busca metadados do cache quando apenas a string de ID é fornecida na exclusão", async () => {
    queryClient.setQueryData(PORTFOLIO_QUERY_KEYS.allTransactions, [
      {
        id: "tx-cached-1",
        asset_id: "asset-itub4",
        type: "dividend",
        date: "2026-08-18",
        total: 35.0,
      },
    ]);

    const { result } = renderHook(() => useDeletePortfolioTransaction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("tx-cached-1");
    });

    expect(repo.deletePortfolioTransaction).toHaveBeenCalledWith("tx-cached-1");
    expect(repo.deletePortfolioDividendsMatching).toHaveBeenCalledWith({
      asset_id: "asset-itub4",
      date: "2026-08-18",
      amount: 35.0,
    });
  });
});
