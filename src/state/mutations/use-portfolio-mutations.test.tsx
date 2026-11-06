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
import type { PortfolioAsset, PortfolioDividend, PortfolioTransaction } from "@/types";

vi.mock("@/data/repositories/portfolio", () => ({
  createPortfolioAsset: vi.fn(),
  updatePortfolioAsset: vi.fn(),
  deletePortfolioAsset: vi.fn(),
  createPortfolioTransaction: vi.fn(),
  createPortfolioTransactionsBatch: vi.fn(),
  listPortfolioTransactions: vi.fn().mockResolvedValue([]),
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

    it("em resgate de renda fixa com customTaxAmount credita Caixa com o líquido exato", async () => {
      const mockFiAsset: PortfolioAsset = {
        id: "rf-1",
        user_id: "u-1",
        ticker: "Tesouro Selic 2029",
        asset_class: "Tesouro Direto",
        quantity: 1,
        average_price: 1426.79,
        currency: "BRL",
        fixed_income_metadata: {
          base_value: 1426.79,
          base_date: "2024-01-01",
          initial_investment_value: 1426.79,
          initial_investment_date: "2024-01-01",
          rate_type: "selic",
          rate_value: 100,
          is_tax_exempt: false,
        },
      };

      vi.mocked(repo.createPortfolioTransaction).mockResolvedValue({ id: "tx-rf-sell" } as unknown as PortfolioTransaction);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "rf-1" } as unknown as PortfolioAsset);

      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          asset: mockFiAsset,
          type: "sell",
          date: "2026-08-26",
          quantity: 1,
          price: 1653.17,
          total: 1653.17,
          syncCash: true,
          cashAsset: mockCashAsset,
          customTaxAmount: 42.67,
          customTaxRatePct: 18.85,
        });
      });

      // Caixa deve ser incrementado com 1.653,17 - 42,67 = 1.610,50 (1000 + 1610.50 = 2610.50)
      expect(repo.updatePortfolioAsset).toHaveBeenCalledWith(
        "cash-1",
        expect.objectContaining({
          quantity: 2610.5,
          average_price: 1,
        }),
      );
    });

    it("em resgate parcial de renda fixa com valor bruto > custo, preserva saldo bruto residual no base_value e recalcula custo residual proporcional", async () => {
      const mockFiAssetWithGain: PortfolioAsset = {
        id: "rf-td-1",
        user_id: "u-1",
        ticker: "Tesouro Selic 2029",
        asset_class: "Tesouro Direto",
        quantity: 1,
        average_price: 8000, // Custo original aplicado
        currency: "BRL",
        fixed_income_metadata: {
          base_value: 9000, // Saldo bruto acumulado
          base_date: "2026-08-26",
          initial_investment_value: 8000, // Custo histórico
          initial_investment_date: "2024-01-01",
          rate_type: "selic",
          rate_value: 100,
          is_tax_exempt: false,
        },
      };

      vi.mocked(repo.createPortfolioTransaction).mockResolvedValue({ id: "tx-rf-partial" } as unknown as PortfolioTransaction);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "rf-td-1" } as unknown as PortfolioAsset);

      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          asset: mockFiAssetWithGain,
          type: "sell",
          date: "2026-08-26",
          quantity: 1,
          price: 1600,
          total: 1600,
          syncCash: false,
        });
      });

      // Saldo bruto restante: 9000 - 1600 = 7400
      // Proporção resgatada: 1600 / 9000 = 0.177777...
      // Custo residual: 8000 * (1 - 0.177777...) = 6577.78
      expect(repo.updatePortfolioAsset).toHaveBeenCalledWith(
        "rf-td-1",
        expect.objectContaining({
          quantity: 1,
          average_price: 6577.78,
          fixed_income_metadata: expect.objectContaining({
            base_value: 7400,
            base_date: "2026-08-26",
            initial_investment_value: 6577.78,
          }),
        }),
      );
    });

    it("resgate com valor superior ao custo mas inferior ao saldo bruto NÃO encerra a posição (mantém saldo residual)", async () => {
      const mockFiAssetWithGain: PortfolioAsset = {
        id: "rf-td-large-partial",
        user_id: "u-1",
        ticker: "Tesouro IPCA+ 2035",
        asset_class: "Tesouro Direto",
        quantity: 1,
        average_price: 8000, // Custo
        currency: "BRL",
        fixed_income_metadata: {
          base_value: 9000, // Saldo bruto
          base_date: "2026-08-26",
          initial_investment_value: 8000,
          initial_investment_date: "2024-01-01",
          rate_type: "ipca",
          rate_value: 6,
          is_tax_exempt: false,
        },
      };

      vi.mocked(repo.createPortfolioTransaction).mockResolvedValue({ id: "tx-large-sell" } as unknown as PortfolioTransaction);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "rf-td-large-partial" } as unknown as PortfolioAsset);

      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      // Resgata R$ 8.200 (maior que o custo de R$ 8.000, mas menor que o saldo de R$ 9.000)
      await act(async () => {
        await result.current.mutateAsync({
          asset: mockFiAssetWithGain,
          type: "sell",
          date: "2026-08-26",
          quantity: 1,
          price: 8200,
          total: 8200,
          syncCash: false,
        });
      });

      // Saldo bruto restante deve ser 9000 - 8200 = 800 (NÃO 0!)
      // Proporção: 8200 / 9000 = 0.911111...
      // Custo restante: 8000 * (1 - 0.911111...) = 711.11
      expect(repo.updatePortfolioAsset).toHaveBeenCalledWith(
        "rf-td-large-partial",
        expect.objectContaining({
          quantity: 1,
          average_price: 711.11,
          fixed_income_metadata: expect.objectContaining({
            base_value: 800,
            base_date: "2026-08-26",
            initial_investment_value: 711.11,
          }),
        }),
      );
    });

    it("não insere compra duplicada no ledger se o ativo já possui compras anteriores", async () => {
      vi.mocked(repo.listPortfolioTransactions).mockResolvedValue([
        { id: "tx-existing-buy", asset_id: "rf-td-1", type: "buy", date: "2024-01-01", quantity: 1, price: 8000, total: 8000 } as PortfolioTransaction,
      ]);
      vi.mocked(repo.createPortfolioTransaction).mockResolvedValue({ id: "tx-sell-only" } as unknown as PortfolioTransaction);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "rf-td-1" } as unknown as PortfolioAsset);

      const mockFiAsset: PortfolioAsset = {
        id: "rf-td-1",
        user_id: "u-1",
        ticker: "Tesouro Selic 2029",
        asset_class: "Tesouro Direto",
        quantity: 1,
        average_price: 8000,
        currency: "BRL",
        fixed_income_metadata: {
          base_value: 9000,
          base_date: "2026-08-26",
          initial_investment_value: 8000,
          initial_investment_date: "2024-01-01",
          rate_type: "selic",
          rate_value: 100,
          is_tax_exempt: false,
        },
      };

      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          asset: mockFiAsset,
          type: "sell",
          date: "2026-08-26",
          quantity: 1,
          price: 1600,
          total: 1600,
          syncCash: false,
        });
      });

      // Apenas 1 transação (a própria venda) deve ser criada no ledger, sem duplicar a compra!
      expect(repo.createPortfolioTransaction).toHaveBeenCalledTimes(1);
      expect(repo.createPortfolioTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sell",
          total: 1600,
        }),
      );
    });

    it("em provento com syncCash persiste sync_cash e cash_amount e credita Caixa", async () => {
      vi.mocked(repo.createPortfolioTransaction).mockResolvedValue({ id: "tx-div-1" } as unknown as PortfolioTransaction);
      vi.mocked(repo.createPortfolioDividend).mockResolvedValue({ id: "div-1", amount: 50 } as unknown as PortfolioDividend);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "cash-1" } as unknown as PortfolioAsset);

      const { result } = renderHook(() => useRecordOrder(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          asset: mockStockAsset,
          type: "dividend",
          date: "2026-08-27",
          quantity: 0,
          price: 0,
          total: 50,
          syncCash: true,
          cashAsset: mockCashAsset,
        });
      });

      expect(repo.createPortfolioDividend).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
          sync_cash: true,
          cash_amount: 50,
        }),
      );

      expect(repo.updatePortfolioAsset).toHaveBeenCalledWith(
        "cash-1",
        expect.objectContaining({
          quantity: 1050,
          average_price: 1,
        }),
      );
    });

    it("ao excluir provento com rollbackCash debita Caixa sem deixar saldo negativo", async () => {
      vi.mocked(repo.deletePortfolioDividend).mockResolvedValue(undefined);
      vi.mocked(repo.updatePortfolioAsset).mockResolvedValue({ id: "cash-1" } as unknown as PortfolioAsset);

      queryClient.setQueryData(PORTFOLIO_QUERY_KEYS.assets, [mockCashAsset]);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEYS.dividends, [
        {
          id: "div-1",
          asset_id: "stock-1",
          date: "2026-08-27",
          amount: 50,
          sync_cash: true,
          cash_amount: 50,
        },
      ]);

      const { result } = renderHook(() => useDeletePortfolioDividend(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: "div-1",
          asset_id: "stock-1",
          date: "2026-08-27",
          amount: 50,
          sync_cash: true,
          cash_amount: 50,
          rollbackCash: true,
        });
      });

      expect(repo.deletePortfolioDividend).toHaveBeenCalledWith("div-1");
      expect(repo.updatePortfolioAsset).toHaveBeenCalledWith(
        "cash-1",
        expect.objectContaining({
          quantity: 950, // 1000 - 50 = 950
          average_price: 1,
        }),
      );
    });

    it("ao excluir provento com rollbackCash: false preserva o saldo de Caixa intacto", async () => {
      vi.mocked(repo.deletePortfolioDividend).mockResolvedValue(undefined);

      queryClient.setQueryData(PORTFOLIO_QUERY_KEYS.assets, [mockCashAsset]);
      queryClient.setQueryData(PORTFOLIO_QUERY_KEYS.dividends, [
        {
          id: "div-2",
          asset_id: "stock-1",
          date: "2026-08-27",
          amount: 50,
          sync_cash: true,
          cash_amount: 50,
        },
      ]);

      const { result } = renderHook(() => useDeletePortfolioDividend(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: "div-2",
          asset_id: "stock-1",
          date: "2026-08-27",
          amount: 50,
          sync_cash: true,
          cash_amount: 50,
          rollbackCash: false,
        });
      });

      expect(repo.deletePortfolioDividend).toHaveBeenCalledWith("div-2");
      expect(repo.updatePortfolioAsset).not.toHaveBeenCalled();
    });
  });
});
