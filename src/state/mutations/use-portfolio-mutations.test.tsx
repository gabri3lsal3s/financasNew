import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useDeletePortfolioTransaction,
  useDeletePortfolioContribution,
  useDeletePortfolioDividend,
  useRecordOrder,
  PORTFOLIO_QUERY_KEYS,
} from "./use-portfolio-mutations";
import * as repo from "@/data/repositories/portfolio";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

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

  describe("useRecordOrder e saneamento de Caixa", () => {
    const mockCashAsset: PortfolioAsset = {
      id: "cash-1",
      user_id: "u-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      quantity: 1000,
      average_price: 1,
      currency: "BRL",
    };

    const mockStockAsset: PortfolioAsset = {
      id: "stock-1",
      user_id: "u-1",
      ticker: "VALE3",
      asset_class: "Ações",
      quantity: 10,
      average_price: 60,
      currency: "BRL",
    };

    it("impede ordem direta de compra ou venda quando o ativo for da classe Caixa", async () => {
      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            asset: mockCashAsset,
            type: "buy",
            date: "2026-08-25",
            quantity: 500,
            price: 1,
            total: 500,
          });
        }),
      ).rejects.toThrow(/Ordens diretas em ativos de Caixa não são permitidas/i);

      expect(repo.createPortfolioTransaction).not.toHaveBeenCalled();
    });

    it("em compra com syncCash debita saldo de Caixa sem emitir nenhuma transação de venda de CAIXA", async () => {
      vi.mocked(repo.createPortfolioTransaction).mockResolvedValue({ id: "tx-stock-1" } as unknown as PortfolioTransaction);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "stock-1" } as unknown as PortfolioAsset);

      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          asset: mockStockAsset,
          type: "buy",
          date: "2026-08-25",
          quantity: 5,
          price: 60,
          total: 300,
          syncCash: true,
          cashAsset: mockCashAsset,
        });
      });

      // Transação criada apenas para VALE3
      expect(repo.createPortfolioTransaction).toHaveBeenCalledTimes(1);
      expect(repo.createPortfolioTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: "stock-1",
          type: "buy",
          total: 300,
        }),
      );

      // Caixa atualizado de 1000 para 700 (1000 - 300)
      expect(repo.updatePortfolioAsset).toHaveBeenCalledWith(
        "cash-1",
        expect.objectContaining({
          quantity: 700,
          average_price: 1,
        }),
      );
    });

    it("em venda com syncCash credita saldo de Caixa sem emitir nenhuma transação de compra de CAIXA", async () => {
      vi.mocked(repo.createPortfolioTransaction).mockResolvedValue({ id: "tx-stock-2" } as unknown as PortfolioTransaction);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "stock-1" } as unknown as PortfolioAsset);

      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          asset: mockStockAsset,
          type: "sell",
          date: "2026-08-26",
          quantity: 2,
          price: 65,
          total: 130,
          syncCash: true,
          cashAsset: mockCashAsset,
        });
      });

      // Transação criada para a venda de VALE3 (e opcionalmente compra inicial se não existisse histórico)
      const txCalls = vi.mocked(repo.createPortfolioTransaction).mock.calls;
      const createdTxAssetIds = txCalls.map((c) => c[0].asset_id);
      expect(createdTxAssetIds).not.toContain("cash-1");

      // Caixa incrementado em 130 (1000 + 130 = 1130)
      expect(repo.updatePortfolioAsset).toHaveBeenCalledWith(
        "cash-1",
        expect.objectContaining({
          quantity: 1130,
          average_price: 1,
        }),
      );
    });
  });
});
