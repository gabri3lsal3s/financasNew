import { describe, expect, it } from "vitest";
import { computeCanonicalAssetLedger } from "@/domain/portfolio/canonical-normalizer";
import {
  createCanonicalAssetHolding,
  createCanonicalPortfolioState,
} from "@/domain/portfolio/canonical-types";
import { buildTearSheetModel } from "@/domain/reports/build-tear-sheet-model";
import type { AllocationAnalysisResult } from "@/domain/reports/allocation-gaps";
import type { ConcentrationRiskResult } from "@/domain/reports/concentration-risk";
import { GOLDEN_EXPECTED } from "./fixtures/golden_portfolio_6445";

describe("Portão de Qualidade 1 (Gate 1) — Saneamento Contábil, Custódia, Caixa e Ledger", () => {
  describe("Critério 1: Invariante Matemático de Ganho de Capital Aberto", () => {
    it("valida rigorosamente que P_total - C_total === V_ativos - C_ativos", () => {
      // Criação de estado consolidado com ativos vivos e reserva de caixa de R$ 0,96
      const holdingAcao = createCanonicalAssetHolding({
        assetId: "asset-1",
        ticker: "VALE3",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 60.0,
        totalCost: 6000.0,
        resolvedPrice: {
          ticker: "VALE3",
          priceQuote: 62.0,
          priceBRL: 62.0,
          usdRate: 1.0,
          source: "api",
          isEstimate: false,
          asOfDate: "2026-11-18",
        },
      });

      const holdingFii = createCanonicalAssetHolding({
        assetId: "asset-2",
        ticker: "HGLG11",
        assetClass: "FIIs",
        currency: "BRL",
        quantity: 70,
        averageCost: 161.71342857,
        totalCost: 11319.94,
        resolvedPrice: {
          ticker: "HGLG11",
          priceQuote: 161.46742857,
          priceBRL: 161.46742857,
          usdRate: 1.0,
          source: "api",
          isEstimate: false,
          asOfDate: "2026-11-18",
        },
      });

      const cashHolding = createCanonicalAssetHolding({
        assetId: "asset-cash",
        ticker: "CAIXA",
        assetClass: "Caixa / Reserva",
        currency: "BRL",
        quantity: 0.96,
        averageCost: 1.0,
        totalCost: 0.96,
        resolvedPrice: {
          ticker: "CAIXA",
          priceQuote: 1.0,
          priceBRL: 1.0,
          usdRate: 1.0,
          source: "cash",
          isEstimate: false,
          asOfDate: "2026-11-18",
        },
        isCash: true,
      });

      const state = createCanonicalPortfolioState({
        asOfDate: "2026-11-18",
        holdings: [holdingAcao, holdingFii, cashHolding],
      });

      // Valores exatos do caso BR-20261118-6445:
      // V_ativos = 6200.00 + 11302.72 = 17502.72
      // C_ativos = 6000.00 + 11319.94 = 17319.94
      // V_caixa = C_caixa = 0.96
      // P_total = 17502.72 + 0.96 = 17503.68
      // C_total = 17319.94 + 0.96 = 17320.90
      expect(state.activeDividendsBRL).toBe(0);
      expect(state.totalBRL).toBe(GOLDEN_EXPECTED.totalPatrimonyBRL); // 17503.68
      expect(state.totalCostBRL).toBe(GOLDEN_EXPECTED.totalConsolidatedCostBRL); // 17320.90
      expect(state.assetsTotalCostBRL).toBe(GOLDEN_EXPECTED.activeAssetsCostBRL); // 17319.94
      expect(state.totalAppliedCostBRL).toBe(GOLDEN_EXPECTED.totalConsolidatedCostBRL); // 17320.90
      expect(state.cashBRL).toBe(GOLDEN_EXPECTED.cashBRL); // 0.96

      // Invariante de Ganho de Capital Aberto
      const openGainConsolidated = Math.round((state.totalBRL - state.totalCostBRL) * 100) / 100;
      const openGainActiveAssets =
        Math.round((state.totalBRL - state.totalCashBRL - state.assetsTotalCostBRL) * 100) / 100;

      expect(openGainConsolidated).toBe(GOLDEN_EXPECTED.unrealizedCapitalGainBRL); // 182.78
      expect(openGainActiveAssets).toBe(GOLDEN_EXPECTED.unrealizedCapitalGainBRL); // 182.78
      expect(openGainConsolidated).toBe(openGainActiveAssets);
      expect(state.unrealizedPnlBRL).toBe(GOLDEN_EXPECTED.unrealizedCapitalGainBRL);
    });

    it("garante congruência entre Dossiê e Extrato Analítico para o Custo Total", () => {
      // Mock do modelo do Tear Sheet (Dossiê)
      const tearSheetModel = buildTearSheetModel({
        rows: [
          {
            ticker: "VALE3",
            assetClass: "Ações",
            currency: "BRL",
            quantity: 100,
            averagePrice: 60.0,
            currentPrice: 62.0,
            valueBRL: 6200.0,
            totalCostBRL: 6000.0,
            unrealizedPnlBRL: 200.0,
            unrealizedPnlPct: 3.33,
          },
          {
            ticker: "HGLG11",
            assetClass: "FIIs",
            currency: "BRL",
            quantity: 70,
            averagePrice: 161.7134,
            currentPrice: 161.4674,
            valueBRL: 11302.72,
            totalCostBRL: 11319.94,
            unrealizedPnlBRL: -17.22,
            unrealizedPnlPct: -0.15,
          },
        ],
        totalBRL: GOLDEN_EXPECTED.totalPatrimonyBRL, // 17503.68
        totalCostBRL: GOLDEN_EXPECTED.totalConsolidatedCostBRL, // 17320.90
        assetsCostBRL: GOLDEN_EXPECTED.activeAssetsCostBRL, // 17319.94
        cashBRL: GOLDEN_EXPECTED.cashBRL, // 0.96
        allocationAnalysis: {
          classGaps: [],
          targetSum: 100,
          actualSum: 100,
        } as unknown as AllocationAnalysisResult,
        concentrationRisk: {} as unknown as ConcentrationRiskResult,
      });

      // No Dossiê:
      expect(tearSheetModel.totalInvestedValueBRL).toBe(GOLDEN_EXPECTED.activeAssetsMarketValueBRL); // 17502.72
      expect(tearSheetModel.effectiveCostBRL).toBe(GOLDEN_EXPECTED.activeAssetsCostBRL); // 17319.94
      expect(tearSheetModel.unrealizedPnlBRL).toBe(GOLDEN_EXPECTED.unrealizedCapitalGainBRL); // 182.78

      // As tabelas de custódia somam exatamente o patrimônio total e custo total consolidado incluindo Caixa
      const totalCustodyFromGroups = tearSheetModel.classTableGroups.reduce(
        (acc, g) => acc + g.totalCents / 100,
        0,
      );
      const totalCostFromGroups = tearSheetModel.classTableGroups.reduce(
        (acc, g) => acc + g.totalCostCents / 100,
        0,
      );

      expect(Math.round(totalCustodyFromGroups * 100) / 100).toBe(GOLDEN_EXPECTED.totalPatrimonyBRL); // 17503.68
      expect(Math.round(totalCostFromGroups * 100) / 100).toBe(GOLDEN_EXPECTED.totalConsolidatedCostBRL); // 17320.90
    });
  });

  describe("Critério 2: Reconstituição de Ledger, Realized P&L e Ações Corporativas", () => {
    it("calcula Realized P&L em vendas parciais e preserva preço médio (Salvaguarda S16)", () => {
      const txs = [
        { date: "2024-01-10", type: "buy", quantity: 100, price: 50.0, total: 5000.0 },
        { date: "2024-02-15", type: "buy", quantity: 100, price: 60.0, total: 6000.0 },
        // Total 200 cotas a R$ 55,00 PM (Custo R$ 11.000,00)
        // Venda de 80 cotas a R$ 70,00:
        // Custo baixado: 80 * 55 = 4400. Receita: 80 * 70 = 5600. Realized PnL = +1200.00
        { date: "2024-03-20", type: "sell", quantity: 80, price: 70.0, total: 5600.0 },
      ];

      const ledger = computeCanonicalAssetLedger(txs);

      expect(ledger.quantity).toBe(120);
      expect(ledger.totalCost).toBe(6600.0);
      expect(ledger.averagePrice).toBe(55.0);
      expect(ledger.realizedPnl).toBe(1200.0);
    });

    it("calcula amortização de cotas reduzindo custo e apurando PnL quando exceder", () => {
      const txs = [
        { date: "2024-01-10", type: "buy", quantity: 100, price: 100.0, total: 10000.0 },
        // Amortização ordinária de R$ 3.000,00
        { date: "2024-06-15", type: "amortization", total: 3000.0 },
      ];

      const ledger1 = computeCanonicalAssetLedger(txs);
      expect(ledger1.quantity).toBe(100);
      expect(ledger1.totalCost).toBe(7000.0);
      expect(ledger1.averagePrice).toBe(70.0);
      expect(ledger1.realizedPnl).toBe(0.0);

      // Amortização excedente: devolve R$ 8.000,00 (R$ 7.000 baixa custo para 0 e R$ 1.000 vira lucro realizado)
      const txs2 = [...txs, { date: "2024-12-15", type: "amortization", total: 8000.0 }];
      const ledger2 = computeCanonicalAssetLedger(txs2);
      expect(ledger2.quantity).toBe(100);
      expect(ledger2.totalCost).toBe(0.0);
      expect(ledger2.averagePrice).toBe(0.0);
      expect(ledger2.realizedPnl).toBe(1000.0);
    });

    it("ajusta bonificação de ações acrescentando cotas e custo atribuído", () => {
      const txs = [
        { date: "2024-01-10", type: "buy", quantity: 100, price: 50.0, total: 5000.0 },
        // Bonificação de 10 cotas com custo atribuído de R$ 300,00
        { date: "2024-05-10", type: "bonus_shares", quantity: 10, total: 300.0 },
      ];

      const ledger = computeCanonicalAssetLedger(txs);
      expect(ledger.quantity).toBe(110);
      expect(ledger.totalCost).toBe(5300.0);
      expect(ledger.averagePrice).toBe(48.1818);
    });
  });

  describe("Critério 3: Preservação de Posições Encerradas no Agregador Global", () => {
    it("preserva proventos e PnL realizado de ativos encerrados (quantity === 0)", () => {
      const activeHolding = createCanonicalAssetHolding({
        assetId: "asset-active",
        ticker: "ITUB4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 30.0,
        totalCost: 3000.0,
        resolvedPrice: {
          ticker: "ITUB4",
          priceQuote: 35.0,
          priceBRL: 35.0,
          usdRate: 1.0,
          source: "api",
          isEstimate: false,
          asOfDate: "2026-11-18",
        },
        accumulatedDividendsBRL: 200.0,
      });

      const closedHolding = createCanonicalAssetHolding({
        assetId: "asset-closed",
        ticker: "BBDC4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 0,
        averageCost: 0,
        totalCost: 0,
        resolvedPrice: {
          ticker: "BBDC4",
          priceQuote: 0,
          priceBRL: 0,
          usdRate: 1.0,
          source: "fallback",
          isEstimate: false,
          asOfDate: "2026-11-18",
        },
        accumulatedDividendsBRL: 36.90, // Provento de ativo encerrado
        realizedPnl: 150.0, // Lucro realizado na venda
      });

      const state = createCanonicalPortfolioState({
        asOfDate: "2026-11-18",
        holdings: [activeHolding, closedHolding],
        cashBRL: 0.96,
      });

      // Ativo vivo: Valor R$ 3.500,00, Custo R$ 3.000,00, Ganho Aberto R$ 500,00, Proventos R$ 200,00
      // Caixa: R$ 0,96
      // Total Patrimônio: R$ 3.500,96
      // Total Custo Consolidado: R$ 3.000,96
      // Ganho Aberto: R$ 500,00
      expect(state.totalBRL).toBe(3500.96);
      expect(state.totalCostBRL).toBe(3000.96);
      expect(state.unrealizedPnlBRL).toBe(500.0);

      // Proventos: ativos (200.00) vs encerrados (36.90) vs total (236.90)
      expect(state.activeDividendsBRL).toBe(200.0);
      expect(state.closedDividendsBRL).toBe(36.90);
      expect(state.totalDividendsBRL).toBe(236.90);

      // PnL Realizado acumulado
      expect(state.realizedPnlBRL).toBe(150.0);

      // P&L Econômico Total: Ganho Aberto (500) + Proventos Totais (236.90) + Realizado (150.00) = 886.90
      expect(state.allTimeEconomicPnlBRL).toBe(886.90);
    });
  });
});
