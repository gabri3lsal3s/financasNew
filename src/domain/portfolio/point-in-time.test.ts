import { describe, expect, it } from "vitest";
import {
  calculatePointInTimePosition,
  getMonthEndCutoffDate,
  getPreviousMonth,
} from "./point-in-time";
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

    it("extracts candidateAssets excluding cash and assets already in custody", () => {
      const assetAcao: PortfolioAsset = {
        id: "asset-1",
        user_id: "user-1",
        ticker: "VALE3",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 65,
      };
      const assetVoo: PortfolioAsset = {
        id: "asset-2",
        user_id: "user-1",
        ticker: "VOO",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 10,
        average_price: 450,
      };
      const assetCash: PortfolioAsset = {
        id: "asset-cash",
        user_id: "user-1",
        ticker: "CAIXA",
        asset_class: "Caixa",
        currency: "BRL",
        quantity: 15000,
        average_price: 1,
      };
      const assetPetr4: PortfolioAsset = {
        id: "asset-petr",
        user_id: "user-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 200,
        average_price: 35,
      };

      // Apenas PETR4 tem transação anterior à data de corte (2026-05)
      // VALE3 e VOO possuem transações de compra futuras (2026-08), de modo que em 2026-05 a quantidade em custódia era 0
      const txPetr: PortfolioTransaction = {
        id: "tx-petr",
        user_id: "user-1",
        asset_id: "asset-petr",
        type: "buy",
        date: "2026-05-10",
        quantity: 200,
        price: 35,
        total: 7000,
      };
      const txValeFutura: PortfolioTransaction = {
        id: "tx-vale-fut",
        user_id: "user-1",
        asset_id: "asset-1",
        type: "buy",
        date: "2026-08-10",
        quantity: 100,
        price: 65,
        total: 6500,
      };
      const txVooFutura: PortfolioTransaction = {
        id: "tx-voo-fut",
        user_id: "user-1",
        asset_id: "asset-2",
        type: "buy",
        date: "2026-08-15",
        quantity: 10,
        price: 450,
        total: 4500,
      };

      const result = calculatePointInTimePosition({
        month: "2026-05",
        assets: [assetAcao, assetVoo, assetCash, assetPetr4],
        transactions: [txPetr, txValeFutura, txVooFutura],
      });

      // PETR4 deve estar em positions
      expect(result.positions.map((p) => p.ticker)).toEqual(["PETR4"]);

      // candidateAssets deve conter VALE3 e VOO, mas NÃO PETR4 (já em custódia) nem CAIXA
      expect(result.candidateAssets).toBeDefined();
      const candidateTickers = result.candidateAssets!.map((c) => c.ticker);
      expect(candidateTickers).toContain("VALE3");
      expect(candidateTickers).toContain("VOO");
      expect(candidateTickers).not.toContain("PETR4");
      expect(candidateTickers).not.toContain("CAIXA");

      const vooCand = result.candidateAssets!.find((c) => c.ticker === "VOO")!;
      expect(vooCand.currency).toBe("USD");
      expect(vooCand.suggestedQuantity).toBe(10);
      expect(vooCand.referencePrice).toBe(450);
    });

    it("correctly handles international USD assets with PTAX currency conversion", () => {
      const assetVoo: PortfolioAsset = {
        id: "asset-voo",
        user_id: "user-1",
        ticker: "VOO",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 5,
        average_price: 400,
      };

      const txVoo: PortfolioTransaction = {
        id: "tx-voo",
        user_id: "user-1",
        asset_id: "asset-voo",
        type: "buy",
        date: "2026-06-15",
        quantity: 5,
        price: 400,
        total: 2000, // USD 2000
      };

      const result = calculatePointInTimePosition({
        month: "2026-06",
        assets: [assetVoo],
        transactions: [txVoo],
        apiPrices: { VOO: 500 }, // USD 500
        usdRate: 5.5, // 1 USD = R$ 5,50
      });

      expect(result.positions).toHaveLength(1);
      const vooPos = result.positions[0]!;
      expect(vooPos.ticker).toBe("VOO");
      expect(vooPos.currency).toBe("USD");
      expect(vooPos.quantity).toBe(5);
      expect(vooPos.averagePrice).toBe(400); // USD
      expect(vooPos.totalCost).toBe(2000); // USD
      expect(vooPos.totalCostBRL).toBe(11000); // 2000 * 5.5 = 11.000,00
      expect(vooPos.priceQuote).toBe(500); // USD
      expect(vooPos.priceBRL).toBe(2750); // 500 * 5.5 = 2.750,00
      expect(vooPos.valueBRL).toBe(13750); // 5 * 500 * 5.5 = 13.750,00
      expect(vooPos.unrealizedPnl).toBe(2750); // 13750 - 11000 = 2.750,00
      expect(vooPos.unrealizedPct).toBe(25); // +25%
    });

    it("correctly factors splits and reverse splits into running quantity and average price", () => {
      const assetItub: PortfolioAsset = {
        id: "asset-itub",
        user_id: "user-1",
        ticker: "ITUB4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 200,
        average_price: 15,
      };

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          asset_id: "asset-itub",
          type: "buy",
          date: "2026-01-10",
          quantity: 100,
          price: 30,
          total: 3000,
        },
        // Desdobramento 1:1 (+100 ações, custo inalterado)
        {
          id: "tx-split",
          user_id: "user-1",
          asset_id: "asset-itub",
          type: "split",
          date: "2026-02-10",
          quantity: 100,
          price: 0,
          total: 0,
        },
      ];

      const result = calculatePointInTimePosition({
        month: "2026-02",
        assets: [assetItub],
        transactions,
        apiPrices: { ITUB4: 18 },
      });

      const itubPos = result.positions[0]!;
      expect(itubPos.quantity).toBe(200);
      expect(itubPos.averagePrice).toBe(15); // 3000 / 200 = 15
      expect(itubPos.totalCostBRL).toBe(3000);
      expect(itubPos.valueBRL).toBe(3600); // 200 * 18
    });

    it("eliminates average_price fallback for missing quotes, preserving fidelity audit", () => {
      // Ativo em custódia com preço médio de aquisição R$ 35,00
      // Sem cotação salva, sem cotação de API e sem transação no mês
      const assetPetr: PortfolioAsset = {
        id: "asset-petr",
        user_id: "user-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 35,
      };

      const txPast: PortfolioTransaction = {
        id: "tx-past",
        user_id: "user-1",
        asset_id: "asset-petr",
        type: "buy",
        date: "2025-10-10",
        quantity: 100,
        price: 35,
        total: 3500,
      };

      const result = calculatePointInTimePosition({
        month: "2026-08",
        assets: [assetPetr],
        transactions: [txPast],
        // Nenhuma cotação informada
      });

      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      // Não cai mais arbitrariamente para average_price (35)
      expect(pos.priceQuote).toBe(0);
      expect(pos.priceBRL).toBe(0);
      expect(pos.valueBRL).toBe(0);
      expect(pos.quoteSource).toBe("fallback");
      expect(pos.isEstimate).toBe(true);
      expect(result.fidelity.fallbackQuotesCount).toBe(1);
      expect(result.fidelity.status).toBe("insufficient");
      expect(result.fidelity.canGenerateExecutiveReport).toBe(false);
    });

    it("clearly signals when a month is derived from consolidated snapshot balance (TWA)", () => {
      // Marco Zero / Snapshot histórico consolidado
      const snapshot = {
        id: "snap-twa",
        user_id: "user-1",
        month: "2026-06",
        total_value: 106700,
        total_cost: 95000,
      };

      const result = calculatePointInTimePosition({
        month: "2026-06",
        assets: [],
        transactions: [],
        snapshot,
        startBalanceBRL: 100000,
      });

      expect(result.isDerivedFromSnapshot).toBe(true);
      expect(result.fidelity.isDerivedFromSnapshot).toBe(true);
      expect(result.fidelity.status).toBe("balance_only");
      expect(result.fidelity.canGenerateExecutiveReport).toBe(false);
      expect(result.fidelity.snapshotTotalValue).toBe(106700);
      expect(result.fidelity.reasons.some((r) => r.includes("TWA") || r.includes("saldo consolidado"))).toBe(true);

      // No extrato mensal, adota o saldo do snapshot como endBalance
      expect(result.monthlyStatement).toBeDefined();
      expect(result.monthlyStatement?.endBalanceBRL).toBe(106700);
      expect(result.monthlyStatement?.startBalanceBRL).toBe(100000);
      expect(result.monthlyStatement?.monthNetPnlBRL).toBe(6700);
    });

    it("automatically resolves previous snapshot M-1 when snapshots list is provided", () => {
      const snapJuly = {
        id: "snap-jul",
        user_id: "user-1",
        month: "2026-07",
        total_value: 100000,
        total_cost: 90000,
      };
      const snapAug = {
        id: "snap-aug",
        user_id: "user-1",
        month: "2026-08",
        total_value: 105000,
        total_cost: 90000,
      };

      const result = calculatePointInTimePosition({
        month: "2026-08",
        assets: [],
        transactions: [],
        snapshot: snapAug,
        snapshots: [snapJuly, snapAug],
      });

      expect(result.monthlyStatement).toBeDefined();
      expect(result.monthlyStatement?.startBalanceBRL).toBe(100000);
      expect(result.monthlyStatement?.endBalanceBRL).toBe(105000);
      expect(result.monthlyStatement?.monthNetPnlBRL).toBe(5000);
      expect(result.monthlyStatement?.monthRatePct).toBe(5.0);
    });

    describe("Quality Gate 1 (QG1) Mathematical Verification", () => {
      it("Cenário A (Queda no mês): Saldo M-1 = 112.000, Saldo M = 110.000 sem aportes -> rate = -1.79%, pnl = -R$ 2.000,00", () => {
        const snapMMinus1 = {
          id: "snap-prev",
          user_id: "user-1",
          month: "2026-07",
          total_value: 112000,
          total_cost: 100000,
        };
        const snapM = {
          id: "snap-curr",
          user_id: "user-1",
          month: "2026-08",
          total_value: 110000,
          total_cost: 100000,
        };

        const result = calculatePointInTimePosition({
          month: "2026-08",
          assets: [],
          transactions: [],
          snapshot: snapM,
          previousSnapshot: snapMMinus1,
        });

        expect(result.monthlyStatement).toBeDefined();
        const stmt = result.monthlyStatement!;
        expect(stmt.startBalanceBRL).toBe(112000);
        expect(stmt.endBalanceBRL).toBe(110000);
        expect(stmt.monthNetContributionBRL).toBe(0);
        expect(stmt.monthNetPnlBRL).toBe(-2000.0);
        expect(stmt.monthRatePct).toBe(-1.79);
      });

      it("Cenário B (Aporte no mês com ganho): Saldo M-1 = 100.000, Aporte no dia 15 = 10.000, Saldo M = 115.000 -> Ganho real de R$ 5.000, rate positivo ponderado", () => {
        const snapMMinus1 = {
          id: "snap-prev",
          user_id: "user-1",
          month: "2026-07",
          total_value: 100000,
          total_cost: 90000,
        };
        const snapM = {
          id: "snap-curr",
          user_id: "user-1",
          month: "2026-08",
          total_value: 115000,
          total_cost: 100000,
        };

        const externalFlows = [
          {
            date: "2026-08-15",
            amount: 10000,
          },
        ];

        const result = calculatePointInTimePosition({
          month: "2026-08",
          assets: [],
          transactions: [],
          snapshot: snapM,
          previousSnapshot: snapMMinus1,
          externalFlows,
        });

        expect(result.monthlyStatement).toBeDefined();
        const stmt = result.monthlyStatement!;
        expect(stmt.startBalanceBRL).toBe(100000);
        expect(stmt.endBalanceBRL).toBe(115000);
        expect(stmt.monthNetContributionBRL).toBe(10000);
        // Ganho real da carteira = (115.000 - 100.000) - 10.000 = 5.000,00
        expect(stmt.monthNetPnlBRL).toBe(5000.0);
        // Taxa positiva ponderada pelo Modified Dietz ANBIMA
        expect(stmt.monthRatePct).toBeGreaterThan(0);
        expect(stmt.monthRatePct).toBe(4.74);
      });

      it("garante zero contaminação com rentabilidades de meses anteriores", () => {
        // Transações de compras efetuadas em anos/meses anteriores
        const assetPetr: PortfolioAsset = {
          id: "asset-petr",
          user_id: "user-1",
          ticker: "PETR4",
          asset_class: "Ações",
          currency: "BRL",
          quantity: 100,
          average_price: 20, // Comprado a R$ 20 no passado distante (retorno histórico de +100%)
        };

        const txPast: PortfolioTransaction = {
          id: "tx-old",
          user_id: "user-1",
          asset_id: "asset-petr",
          type: "buy",
          date: "2024-01-10",
          quantity: 100,
          price: 20,
          total: 2000,
        };

        const monthlyPricesAug: PortfolioMonthlyPrice[] = [
          {
            id: "mp-petr-aug",
            user_id: "user-1",
            ticker: "PETR4",
            month: "2026-08",
            price: 40, // Em 2026-08 fechou a R$ 40
            currency: "BRL",
            source: "manual",
          },
        ];

        // No mês anterior (2026-07) a cotação era 42 (ou seja, no mês de agosto o ativo caiu de 42 para 40)
        const result = calculatePointInTimePosition({
          month: "2026-08",
          assets: [assetPetr],
          transactions: [txPast],
          monthlyPrices: monthlyPricesAug,
          startBalanceBRL: 4200, // 100 * 42
        });

        expect(result.monthlyStatement).toBeDefined();
        const stmt = result.monthlyStatement!;
        // P&L do mês deve ser estritamente negativo (-R$ 200), ignorando o ganho histórico de R$ 2000 desde 2024
        expect(stmt.monthNetPnlBRL).toBe(-200);
        expect(stmt.monthRatePct).toBe(-4.76); // -200 / 4200 = -4.76%
      });
    });
  });

  describe("getPreviousMonth", () => {
    it("correctly decrements month across year boundary and regular months", () => {
      expect(getPreviousMonth("2026-01")).toBe("2025-12");
      expect(getPreviousMonth("2026-08")).toBe("2026-07");
      expect(getPreviousMonth("2026-10")).toBe("2026-09");
      expect(getPreviousMonth("2026-12")).toBe("2026-11");
    });
  });
});


