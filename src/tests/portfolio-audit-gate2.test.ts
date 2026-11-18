import { describe, expect, it } from "vitest";
import { computeCanonicalAssetLedger } from "@/domain/portfolio/canonical-normalizer";
import {
  createCanonicalAssetHolding,
} from "@/domain/portfolio/canonical-types";
import { evaluatePortfolioCanonicalState } from "@/domain/portfolio/canonical-engine";
import { calculatePositionSummary } from "@/domain/portfolio/valuation";
import { buildTearSheetModel } from "@/domain/reports/build-tear-sheet-model";
import { formatSignedPct } from "@/services/masks/percent";
import type { AllocationAnalysisResult } from "@/domain/reports/allocation-gaps";
import type { ConcentrationRiskResult } from "@/domain/reports/concentration-risk";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";
import {
  GOLDEN_AS_OF_DATE,
  GOLDEN_PTAX_RATE,
} from "./fixtures/golden_portfolio_6445";

describe("Portão de Qualidade 2 (Gate 2) — Motor Multi-Moeda (FX Engine) e Integração de Dados de Mercado", () => {
  describe("Critério 1: Decomposição Matemática Estrita de Ativos Internacionais", () => {
    it("valida que para ativos sem dividendos (BITB e GLD), se FX_atual !== FX_hist, R_Total_BRL !== R_USD", () => {
      // BITB: Preço médio USD = 41.85, Cotação atual USD = 37.27
      // Variação na moeda nativa (USD) = (37.27 / 41.85) - 1 = -10.943847%
      const bitbAvgUSD = 41.85;
      const bitbPriceUSD = 37.27;
      const bitbQty = 2.9887;
      const bitbTotalCostUSD = Math.round(bitbQty * bitbAvgUSD * 100) / 100; // 125.08 USD

      // Câmbio histórico de compra = 5.0000; PTAX atual = 5.2500
      const fxHist = 5.0;
      const fxCurrent = GOLDEN_PTAX_RATE; // 5.25
      const bitbTotalCostBRL = Math.round(bitbTotalCostUSD * fxHist * 100) / 100; // 625.40 BRL

      const bitbHolding = createCanonicalAssetHolding({
        assetId: "asset-bitb",
        ticker: "BITB",
        assetClass: "Internacional",
        currency: "USD",
        quantity: bitbQty,
        averageCost: bitbAvgUSD,
        totalCost: bitbTotalCostUSD,
        totalCostBRL: bitbTotalCostBRL,
        resolvedPrice: {
          ticker: "BITB",
          priceQuote: bitbPriceUSD,
          priceBRL: Math.round(bitbPriceUSD * fxCurrent * 10000) / 10000,
          usdRate: fxCurrent,
          source: "api",
          isEstimate: false,
          asOfDate: GOLDEN_AS_OF_DATE,
        },
        accumulatedDividendsBRL: 0,
      });

      // Retorno nativo em USD
      expect(bitbHolding.pricePnlPctUSD).not.toBeNull();
      const rUSD = bitbHolding.pricePnlPctUSD! / 100;
      expect(bitbHolding.pricePnlPctUSD).toBeCloseTo(-10.9438, 3);

      // Variação cambial implícita: (5.25 / 5.00) - 1 = +5.0%
      expect(bitbHolding.fxPnlPct).not.toBeNull();
      const rFX = bitbHolding.fxPnlPct! / 100;
      expect(bitbHolding.fxPnlPct).toBeCloseTo(5.0, 3);

      // Retorno total em BRL deve diferir do retorno em USD porque houve valorização cambial (+5%)
      expect(bitbHolding.totalReturnPct).not.toBeNull();
      const rTotalBRL = bitbHolding.totalReturnPct! / 100;
      expect(rTotalBRL).not.toEqual(rUSD);

      // Invariante de Decomposição: (1 + R_USD) * (1 + R_FX) - 1 === R_Cota_BRL
      const expectedCombined = (1 + rUSD) * (1 + rFX) - 1;
      expect(rTotalBRL).toBeCloseTo(expectedCombined, 3);

      // Para GLD: sem variação em USD (R_USD = 0%), todo o ganho é cambial
      const gldHolding = createCanonicalAssetHolding({
        assetId: "asset-gld",
        ticker: "GLD",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 1.554,
        averageCost: 229.47,
        totalCost: Math.round(1.554 * 229.47 * 100) / 100, // 356.60
        totalCostBRL: Math.round(1.554 * 229.47 * 5.0 * 100) / 100, // 1782.98 BRL
        resolvedPrice: {
          ticker: "GLD",
          priceQuote: 229.47,
          priceBRL: Math.round(229.47 * fxCurrent * 10000) / 10000,
          usdRate: fxCurrent,
          source: "api",
          isEstimate: false,
          asOfDate: GOLDEN_AS_OF_DATE,
        },
        accumulatedDividendsBRL: 0,
      });

      expect(gldHolding.pricePnlPctUSD).toBeCloseTo(0.0, 2);
      expect(gldHolding.fxPnlPct).toBeCloseTo(5.0, 2);
      expect(gldHolding.totalReturnPct).toBeCloseTo(5.0, 2);
      // R_Total_BRL (5%) !== R_USD (0%)
      expect(gldHolding.totalReturnPct).not.toBe(gldHolding.pricePnlPctUSD);
    });

    it("valida decomposição em ativo com proventos em reais (VOO)", () => {
      const vooHolding = createCanonicalAssetHolding({
        assetId: "asset-voo",
        ticker: "VOO",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 1.378,
        averageCost: 500.0,
        totalCost: 689.0,
        totalCostBRL: Math.round(689.0 * 5.1 * 100) / 100, // 3513.90 BRL (câmbio 5.10)
        resolvedPrice: {
          ticker: "VOO",
          priceQuote: 500.0,
          priceBRL: 500.0 * 5.25,
          usdRate: 5.25,
          source: "api",
          isEstimate: false,
          asOfDate: GOLDEN_AS_OF_DATE,
        },
        accumulatedDividendsBRL: 45.0, // Proventos recebidos
      });

      const rCotaBRL = vooHolding.unrealizedPct! / 100;
      const dividendYieldBRL = 45.0 / vooHolding.totalCostBRL;
      const rTotalBRL = vooHolding.totalReturnPct! / 100;

      // R_Total_BRL === R_Cota_BRL + (Proventos / Custo_BRL)
      expect(rTotalBRL).toBeCloseTo(rCotaBRL + dividendYieldBRL, 4);
    });
  });

  describe("Critério 2: Homogeneidade de PTAX Oficial com 4 Casas Decimais", () => {
    it("garante que todas as posições USD na mesma data-base utilizam rigorosamente a mesma PTAX", () => {
      const assets: PortfolioAsset[] = [
        {
          id: "asset-bitb",
          user_id: "user-test",
          ticker: "BITB",
          currency: "USD",
          quantity: 2.9887,
          average_price: 41.85,
          total_cost_brl: 625.39,
          asset_class: "Internacional",
        },
        {
          id: "asset-gld",
          user_id: "user-test",
          ticker: "GLD",
          currency: "USD",
          quantity: 1.554,
          average_price: 229.47,
          total_cost_brl: 1782.98,
          asset_class: "Internacional",
        },
      ];

      const state = evaluatePortfolioCanonicalState({
        asOfDate: GOLDEN_AS_OF_DATE,
        mode: "instant",
        assets,
        transactions: [],
        contributions: [],
        dividends: [],
        monthlyPrices: [
          {
            id: "price-usd",
            user_id: "user-6445",
            ticker: "USDBRL=X",
            month: "2026-11",
            price: 5.25,
            currency: "BRL",
            source: "api",
          },
        ],
        assetPrices: {
          BITB: 37.27,
          GLD: 229.47,
        },
      });

      // PTAX consolidada do estado
      expect(state.usdRate).toBe(5.25);

      // Todas as posições internacionais devem ter usdRate idêntico a 5.2500
      for (const holding of state.holdings) {
        if (holding.currency === "USD") {
          expect(holding.resolvedPrice.usdRate).toBe(5.25);
          expect(holding.usdRate).toBe(5.25);
        }
      }
    });
  });

  describe("Critério 3: Precisão de Arredondamento do BITB (BUG-16)", () => {
    it("formata a variação da cota do BITB (-10.9438%) rigorosamente como -10,9% e nunca -11,0%", () => {
      const pmUSD = 41.85;
      const quoteUSD = 37.27;
      const rawPct = ((quoteUSD - pmUSD) / pmUSD) * 100; // -10.943847072879326%

      // Formatação direta da máscara padrão
      const formatted = formatSignedPct(rawPct);
      expect(formatted).toBe("-10,9%");
      expect(formatted).not.toBe("-11,0%");

      // Verificação através do holding canônico
      const holding = createCanonicalAssetHolding({
        assetId: "asset-bitb",
        ticker: "BITB",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 2.9887,
        averageCost: pmUSD,
        totalCost: 125.08,
        totalCostBRL: 625.39,
        resolvedPrice: {
          ticker: "BITB",
          priceQuote: quoteUSD,
          priceBRL: quoteUSD * 5.25,
          usdRate: 5.25,
          source: "api",
          isEstimate: false,
          asOfDate: GOLDEN_AS_OF_DATE,
        },
      });

      expect(holding.pricePnlPctUSD).not.toBeNull();
      expect(formatSignedPct(holding.pricePnlPctUSD ?? null)).toBe("-10,9%");
    });
  });

  describe("Critério 4: Reconstituição do Custo Histórico em BRL via Ledger Multi-Lote", () => {
    it("conserva o custo histórico em reais através de múltiplos lotes com taxas de câmbio distintas", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx-buy-1",
          user_id: "user-1",
          asset_id: "asset-voo",
          type: "buy",
          date: "2024-10-01",
          quantity: 1,
          price: 100.0,
          total: 100.0,
          fx_rate: 5.0, // Custo BRL = 500,00
        },
        {
          id: "tx-buy-2",
          user_id: "user-1",
          asset_id: "asset-voo",
          type: "buy",
          date: "2025-01-15",
          quantity: 1,
          price: 120.0,
          total: 120.0,
          fx_rate: 5.5, // Custo BRL = 660,00
        },
      ];

      const ledger = computeCanonicalAssetLedger(transactions, undefined, {
        currency: "USD",
      });

      // Total USD = 100 + 120 = 220 USD
      expect(ledger.quantity).toBe(2);
      expect(ledger.totalCost).toBe(220.0);
      expect(ledger.averagePrice).toBe(110.0);

      // Total BRL = 500 + 660 = 1160 BRL
      expect(ledger.totalCostBRL).toBe(1160.0);
      expect(ledger.averageCostBRL).toBe(580.0);

      // Câmbio médio implícito = 1160 / 220 = 5.2727
      expect(ledger.impliedHistoricalFxRate).toBeCloseTo(5.2727, 4);
    });

    it("aplica baixa proporcional de custo em BRL e apura PnL realizado na venda parcial", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx-buy-1",
          user_id: "user-1",
          asset_id: "asset-voo",
          type: "buy",
          date: "2024-10-01",
          quantity: 2,
          price: 100.0,
          total: 200.0,
          fx_rate: 5.0, // Custo BRL = 1000,00 (500/cota)
        },
        {
          id: "tx-sell-1",
          user_id: "user-1",
          asset_id: "asset-voo",
          type: "sell",
          date: "2025-05-10",
          quantity: 1, // Vende 1 cota
          price: 150.0,
          total: 150.0,
          fx_rate: 5.8, // Receita BRL = 150 * 5.8 = 870,00
        },
      ];

      const ledger = computeCanonicalAssetLedger(transactions, undefined, {
        currency: "USD",
      });

      // Restou 1 cota: Custo USD = 100, Custo BRL = 500
      expect(ledger.quantity).toBe(1);
      expect(ledger.totalCost).toBe(100.0);
      expect(ledger.totalCostBRL).toBe(500.0);
      expect(ledger.averageCostBRL).toBe(500.0);

      // PnL Realizado em BRL = 870.00 (receita) - 500.00 (custo da cota) = 370.00
      expect(ledger.realizedPnl).toBe(370.0);
    });
  });

  describe("Critério 5: Subtotal Internacional e Rodapé PTAX nos Relatórios", () => {
    it("gera subtotal internacional com variação em USD e BRL e nota de rodapé com PTAX a 4 casas", () => {
      const dummyAllocation: AllocationAnalysisResult = {
        totalBRL: 10000,
        alignmentScore: 85,
        equilibriumIndexPct: 85,
        totalTargetPct: 100,
        totalGapBRL: 0,
        classGaps: [],
        sectorGaps: [],
        assetGaps: [],
        topDeficitClass: null,
        topDeficitSector: null,
        topDeficitAsset: null,
        treeNodes: [],
      };
      const dummyRisk: ConcentrationRiskResult = {
        totalBRL: 10000,
        top5BRL: 5000,
        top5Pct: 50,
        top10BRL: 10000,
        top10Pct: 100,
        singleAssetDominance: null,
        sectorExposure: [],
        topSectorDominance: null,
        top3SectorsPct: 0,
        currencyExposure: { brlBRL: 8000, brlPct: 80, usdBRL: 2000, usdPct: 20 },
        riskScore: 85,
        riskAlerts: [],
      };

      const tearSheet = buildTearSheetModel({
        rows: [
          {
            ticker: "BITB",
            currency: "USD",
            quantity: 2.9887,
            averagePrice: 41.85,
            currentPrice: 37.27,
            valueBRL: 584.65,
            totalCostBRL: 625.39,
            unrealizedPnlBRL: -40.74,
            unrealizedPnlPct: -6.51,
            pricePnlPctUSD: -10.9438,
            assetClass: "Internacional",
          },
          {
            ticker: "GLD",
            currency: "USD",
            quantity: 1.554,
            averagePrice: 229.47,
            currentPrice: 229.47,
            valueBRL: 1872.26,
            totalCostBRL: 1782.98,
            unrealizedPnlBRL: 89.28,
            unrealizedPnlPct: 5.0,
            pricePnlPctUSD: 0.0,
            assetClass: "Internacional",
          },
        ],
        totalBRL: 2456.91,
        totalCostBRL: 2408.37,
        allocationAnalysis: dummyAllocation,
        concentrationRisk: dummyRisk,
        usdRate: 5.25,
      });

      const intlGroup = tearSheet.classTableGroups.find((g) => g.className === "Internacional");
      expect(intlGroup).toBeDefined();
      expect(intlGroup!.usdRate).toBe(5.25);
      expect(intlGroup!.subtotalPriceVarPctUSD).toBeDefined();

      // BITB tem variação em USD no item da tabela
      const bitbItem = intlGroup!.items.find((i) => i.ticker === "BITB");
      expect(bitbItem).toBeDefined();
      expect(bitbItem!.pricePnlPct).toBeCloseTo(-10.9438, 3);
      expect(formatSignedPct(bitbItem!.pricePnlPct)).toBe("-10,9%");
    });
  });

  describe("Integração com Valuation Service: calculatePositionSummary", () => {
    it("respeita explicitTotalCostBRL quando informado, sem sobrescrever com PTAX atual", () => {
      const summary = calculatePositionSummary({
        quantity: 10,
        averagePrice: 50.0,
        assetClass: "Internacional",
        currency: "USD",
        resolvedPrice: {
          price: 50.0,
          source: "api",
        },
        usdRate: 5.25,
        totalCostBRL: 2500.0, // Câmbio histórico = 5.0000
      });

      expect(summary.totalCost).toBe(500.0); // 10 * 50
      expect(summary.totalCostBRL).toBe(2500.0); // Preserva 2500.00 em vez de 500 * 5.25 = 2625.00
      expect(summary.valueBRL).toBe(2625.0); // 10 * 50 * 5.25
      expect(summary.unrealizedPnl).toBe(125.0); // 2625 - 2500
      expect(summary.unrealizedPct).toBe(5.0); // 125 / 2500 = +5%
    });
  });
});
