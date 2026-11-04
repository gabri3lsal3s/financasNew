import { describe, expect, it } from "vitest";
import { calculatePointInTimePosition, getMonthEndCutoffDate } from "./point-in-time";
import type {
  PortfolioAsset,
  PortfolioDividend,
  PortfolioMonthlyPrice,
  PortfolioTransaction,
} from "@/types";

describe("point-in-time portfolio calculation engine", () => {
  describe("getMonthEndCutoffDate", () => {
    it("returns correct end of month for 31-day, 30-day, and February (leap and non-leap)", () => {
      expect(getMonthEndCutoffDate("2026-01")).toBe("2026-01-31");
      expect(getMonthEndCutoffDate("2026-04")).toBe("2026-04-30");
      expect(getMonthEndCutoffDate("2024-02")).toBe("2024-02-29"); // leap year
      expect(getMonthEndCutoffDate("2026-02")).toBe("2026-02-28"); // non-leap year
    });
  });

  describe("calculatePointInTimePosition", () => {
    const assetPetr4: PortfolioAsset = {
      id: "asset-petr4",
      user_id: "user-1",
      ticker: "PETR4",
      asset_class: "Ações Nacionais",
      currency: "BRL",
      quantity: 100,
      average_price: 35,
    };

    const assetVale3: PortfolioAsset = {
      id: "asset-vale3",
      user_id: "user-1",
      ticker: "VALE3",
      asset_class: "Ações Nacionais",
      currency: "BRL",
      quantity: 50,
      average_price: 60,
    };

    const assetCash: PortfolioAsset = {
      id: "asset-cash",
      user_id: "user-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      currency: "BRL",
      quantity: 5000,
      average_price: 1,
    };

    it("reconstructs portfolio at month-end considering only prior transactions", () => {
      const transactions: PortfolioTransaction[] = [
        // Compras em Janeiro 2026
        {
          id: "tx-1",
          user_id: "user-1",
          asset_id: "asset-petr4",
          type: "buy",
          date: "2026-01-10",
          quantity: 100,
          price: 30,
          total: 3000,
        },
        // Compra adicional em Fevereiro 2026
        {
          id: "tx-2",
          user_id: "user-1",
          asset_id: "asset-petr4",
          type: "buy",
          date: "2026-02-15",
          quantity: 50,
          price: 36,
          total: 1800,
        },
        // Compra futura em Março 2026 (deve ser ignorada no fechamento de Janeiro)
        {
          id: "tx-3",
          user_id: "user-1",
          asset_id: "asset-vale3",
          type: "buy",
          date: "2026-03-01",
          quantity: 50,
          price: 60,
          total: 3000,
        },
      ];

      const monthlyPrices: PortfolioMonthlyPrice[] = [
        {
          id: "mp-1",
          user_id: "user-1",
          ticker: "PETR4",
          month: "2026-01",
          price: 34,
          currency: "BRL",
          source: "api",
        },
      ];

      const resultJan = calculatePointInTimePosition({
        month: "2026-01",
        assets: [assetPetr4, assetVale3, assetCash],
        transactions,
        monthlyPrices,
        cashBalance: 4000,
      });

      expect(resultJan.cutoffDate).toBe("2026-01-31");
      expect(resultJan.cashQuantity).toBe(4000);
      // VALE3 não tinha transações até Janeiro, runningQty = 0 -> não aparece
      expect(resultJan.positions).toHaveLength(1);

      const petr4Pos = resultJan.positions[0]!;
      expect(petr4Pos).toBeDefined();
      expect(petr4Pos.ticker).toBe("PETR4");
      expect(petr4Pos.quantity).toBe(100);
      expect(petr4Pos.averagePrice).toBe(30);
      expect(petr4Pos.totalCostBRL).toBe(3000);
      expect(petr4Pos.priceQuote).toBe(34);
      expect(petr4Pos.valueBRL).toBe(3400);
      expect(petr4Pos.unrealizedPnl).toBe(400);
      expect(petr4Pos.quoteSource).toBe("api");

      expect(resultJan.totalInvestedBRL).toBe(3400);
      expect(resultJan.totalValueBRL).toBe(7400); // 3400 + 4000 cash
    });

    it("handles partial sells and recalculates running quantity while preserving average cost", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          asset_id: "asset-petr4",
          type: "buy",
          date: "2026-01-05",
          quantity: 200,
          price: 25,
          total: 5000,
        },
        {
          id: "tx-2",
          user_id: "user-1",
          asset_id: "asset-petr4",
          type: "sell",
          date: "2026-01-20",
          quantity: 80,
          price: 30,
          total: 2400,
        },
      ];

      const result = calculatePointInTimePosition({
        month: "2026-01",
        assets: [assetPetr4],
        transactions,
        apiPrices: { PETR4: 28 },
      });

      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      expect(pos).toBeDefined();
      expect(pos.quantity).toBe(120);
      expect(pos.averagePrice).toBe(25);
      expect(pos.totalCostBRL).toBe(3000); // 120 * 25
      expect(pos.valueBRL).toBe(3360); // 120 * 28
      expect(pos.unrealizedPnl).toBe(360);
    });

    it("handles stock splits by expanding quantity without altering total invested cost", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          asset_id: "asset-petr4",
          type: "buy",
          date: "2026-01-05",
          quantity: 100,
          price: 40,
          total: 4000,
        },
        // Desdobramento 1:1 (adiciona 100 cotas extras)
        {
          id: "tx-2",
          user_id: "user-1",
          asset_id: "asset-petr4",
          type: "split",
          date: "2026-01-25",
          quantity: 100,
          price: 0,
          total: 0,
        },
      ];

      const result = calculatePointInTimePosition({
        month: "2026-01",
        assets: [assetPetr4],
        transactions,
        apiPrices: { PETR4: 22 },
      });

      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      expect(pos).toBeDefined();
      expect(pos.quantity).toBe(200);
      expect(pos.averagePrice).toBe(20); // 4000 / 200
      expect(pos.totalCostBRL).toBe(4000);
      expect(pos.valueBRL).toBe(4400); // 200 * 22
    });

    it("accrues fixed income balance using mathematical model up to cutoff date", () => {
      const fiAsset: PortfolioAsset = {
        id: "asset-cdb",
        user_id: "user-1",
        ticker: "CDB BANCO INTER 120% CDI",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        average_price: 10000,
        fixed_income_metadata: {
          rate_type: "pre",
          rate_value: 12.0, // 12% a.a. pré
          base_date: "2026-01-01",
          base_value: 10000,
          is_tax_exempt: true,
        },
      };

      const result = calculatePointInTimePosition({
        month: "2026-01",
        assets: [fiAsset],
        transactions: [],
      });

      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      expect(pos).toBeDefined();
      expect(pos.totalCostBRL).toBe(10000);
      // Valor deve ter acumulado juros entre 01-01 e 31-01
      expect(pos.valueBRL).toBeGreaterThan(10000);
      expect(pos.unrealizedPnl).toBeGreaterThan(0);
    });

    it("calculates received dividends in month and cumulative dividends", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          asset_id: "asset-petr4",
          type: "buy",
          date: "2025-12-01",
          quantity: 100,
          price: 30,
          total: 3000,
        },
      ];

      const dividends: PortfolioDividend[] = [
        {
          id: "div-1",
          user_id: "user-1",
          asset_id: "asset-petr4",
          date: "2025-12-15",
          amount: 50,
        },
        {
          id: "div-2",
          user_id: "user-1",
          asset_id: "asset-petr4",
          date: "2026-01-20",
          amount: 80,
        },
        // Provento de fevereiro (não entra no acumulado de janeiro)
        {
          id: "div-3",
          user_id: "user-1",
          asset_id: "asset-petr4",
          date: "2026-02-10",
          amount: 90,
        },
      ];

      const result = calculatePointInTimePosition({
        month: "2026-01",
        assets: [assetPetr4],
        transactions,
        dividends,
        apiPrices: { PETR4: 32 },
      });

      expect(result.monthDividendsTotalBRL).toBe(80);
      expect(result.accumulatedDividendsTotalBRL).toBe(130); // 50 + 80
      const pos = result.positions[0]!;
      expect(pos).toBeDefined();
      expect(pos.monthDividendsBRL).toBe(80);
      expect(pos.accumulatedDividendsBRL).toBe(130);
      expect(pos.totalReturnPnl).toBe(330); // Unrealized 200 + Acc Divs 130
    });

    it("converts USD assets to BRL using specified PTAX rate", () => {
      const assetAapl: PortfolioAsset = {
        id: "asset-aapl",
        user_id: "user-1",
        ticker: "AAPL",
        asset_class: "Ações Internacionais",
        currency: "USD",
        quantity: 10,
        average_price: 200,
      };

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          asset_id: "asset-aapl",
          type: "buy",
          date: "2026-01-10",
          quantity: 10,
          price: 200,
          total: 2000,
        },
      ];

      const result = calculatePointInTimePosition({
        month: "2026-01",
        assets: [assetAapl],
        transactions,
        apiPrices: { AAPL: 220 },
        usdRate: 5.5,
      });

      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      expect(pos).toBeDefined();
      expect(pos.currency).toBe("USD");
      expect(pos.priceQuote).toBe(220);
      expect(pos.priceBRL).toBe(1210); // 220 * 5.5
      expect(pos.totalCost).toBe(2000);
      expect(pos.totalCostBRL).toBe(11000); // 2000 * 5.5
      expect(pos.valueBRL).toBe(12100); // 10 * 1210
      expect(pos.unrealizedPnl).toBe(1100); // 12100 - 11000
    });

    it("preserves baseline custody for assets with initial holdings and future transactions", () => {
      // Ativo cadastrado na carteira com 100 cotas vivas a R$ 30
      // Usuário fez uma compra adicional de 10 cotas em Novembro (após o fechamento de Outubro)
      const assetBbas3: PortfolioAsset = {
        id: "asset-bbas3",
        user_id: "user-1",
        ticker: "BBAS3",
        asset_class: "Ações Nacionais",
        currency: "BRL",
        quantity: 110,
        average_price: 30,
      };

      const futureTransaction: PortfolioTransaction = {
        id: "tx-future-1",
        user_id: "user-1",
        asset_id: "asset-bbas3",
        type: "buy",
        date: "2026-11-05",
        quantity: 10,
        price: 32,
        total: 320,
      };

      const result = calculatePointInTimePosition({
        month: "2026-10",
        assets: [assetBbas3],
        transactions: [futureTransaction],
        apiPrices: { BBAS3: 31 },
      });

      // Em Outubro, o ativo NÃO deve ser zerado! A custódia baseline era de 100 cotas.
      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      expect(pos.ticker).toBe("BBAS3");
      expect(pos.quantity).toBe(100); // 110 - 10
      expect(pos.totalCostBRL).toBe(3000); // 100 * 30
      expect(pos.valueBRL).toBe(3100); // 100 * 31
    });

    it("flags fidelity as balance_only when snapshot exists but has no saved monthly prices and large discrepancy", () => {
      const asset: PortfolioAsset = {
        id: "asset-1",
        user_id: "user-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30,
      };

      // Snapshot gravado via TWA no valor de 106.700
      const snapshot = {
        id: "snap-1",
        user_id: "user-1",
        month: "2026-09",
        total_value: 106700,
        total_cost: 95000,
      };

      const result = calculatePointInTimePosition({
        month: "2026-09",
        assets: [asset],
        transactions: [],
        snapshot,
        monthlyPrices: [], // sem cotações salvas
        apiPrices: { PETR4: 30 }, // total reconstruído = 3000 (muito discrepante de 106700)
      });

      expect(result.fidelity.status).toBe("balance_only");
      expect(result.fidelity.canGenerateExecutiveReport).toBe(false);
      expect(result.fidelity.discrepancyBRL).toBeDefined();
      expect(result.fidelity.reasons[0]).toContain("TWA");
    });

    it("flags fidelity as complete when monthly prices are saved for the month", () => {
      const asset: PortfolioAsset = {
        id: "asset-1",
        user_id: "user-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30,
      };

      const snapshot = {
        id: "snap-1",
        user_id: "user-1",
        month: "2026-10",
        total_value: 3500,
        total_cost: 3000,
      };

      const monthlyPrices: PortfolioMonthlyPrice[] = [
        {
          id: "mp-1",
          user_id: "user-1",
          ticker: "PETR4",
          month: "2026-10",
          price: 35,
          currency: "BRL",
          source: "manual",
        },
      ];

      const result = calculatePointInTimePosition({
        month: "2026-10",
        assets: [asset],
        transactions: [],
        snapshot,
        monthlyPrices,
      });

      expect(result.fidelity.status).toBe("complete");
      expect(result.fidelity.canGenerateExecutiveReport).toBe(true);
      expect(result.positions[0]?.quoteSource).toBe("manual");
    });
  });
});

