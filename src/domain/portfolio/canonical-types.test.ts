import { describe, expect, it } from "vitest";
import {
  CANONICAL_FIDELITY_TOLERANCE_PCT,
  createCanonicalAssetHolding,
  createCanonicalFidelityReport,
  createCanonicalMonthlyStatement,
  createCanonicalPortfolioState,
  createFixedIncomeDiagnostic,
  DEFAULT_CANONICAL_IRR,
  DEFAULT_CANONICAL_TWR,
  isCanonicalAssetHolding,
  isCanonicalFidelityReport,
  isCanonicalMonthlyStatement,
  isCanonicalPortfolioState,
  type CanonicalFidelityReport,
  type CanonicalFidelityStatus,
  type CanonicalMonthlyStatement,
  type CanonicalPortfolioState,
  type CanonicalResolvedPrice,
} from "./canonical-types";
import type { FixedIncomeMetadata } from "@/types";
import type { FixedIncomeBalanceResult } from "./fixed-income";
import type { TwrConsolidatedResult } from "./twr";
import type { XIRRResult } from "./irr";

describe("canonical-types", () => {
  const baseResolvedPrice: CanonicalResolvedPrice = {
    ticker: "PETR4",
    priceQuote: 35.5,
    priceBRL: 35.5,
    usdRate: 1.0,
    source: "api",
    isEstimate: false,
    asOfDate: "2026-10-31",
    badgeLabel: "Oficial API",
  };

  describe("createCanonicalAssetHolding — Ação B3 Nacional", () => {
    it("deve construir holding canônica de ação nacional com todas as métricas calculadas", () => {
      const holding = createCanonicalAssetHolding({
        assetId: "asset-petr4",
        ticker: "petr4",
        assetClass: "Ações",
        sector: "Petróleo e Gás",
        currency: "BRL",
        quantity: 100,
        averageCost: 30.0,
        totalCost: 3000.0,
        resolvedPrice: baseResolvedPrice,
        accumulatedDividendsBRL: 250.0,
        totalPortfolioValueBRL: 10000.0,
        notes: "Posição estratégica de dividendos",
      });

      expect(holding.assetId).toBe("asset-petr4");
      expect(holding.id).toBe("asset-petr4");
      expect(holding.ticker).toBe("PETR4");
      expect(holding.assetClass).toBe("Ações");
      expect(holding.sector).toBe("Petróleo e Gás");
      expect(holding.currency).toBe("BRL");
      expect(holding.quantity).toBe(100);
      expect(holding.averageCost).toBe(30.0);
      expect(holding.totalCost).toBe(3000.0);
      expect(holding.averageCostBRL).toBe(30.0);
      expect(holding.totalCostBRL).toBe(3000.0);

      // Cotação e Valor de Mercado
      expect(holding.priceQuote).toBe(35.5);
      expect(holding.priceBRL).toBe(35.5);
      expect(holding.usdRate).toBe(1.0);
      expect(holding.quoteSource).toBe("api");
      expect(holding.marketValueBRL).toBe(3550.0);
      expect(holding.valueBRL).toBe(3550.0);

      // PnL Não Realizado (3550 - 3000 = 550)
      expect(holding.unrealizedPnl).toBe(550.0);
      expect(holding.unrealizedPct).toBe(18.3333); // (550 / 3000) * 100

      // Proventos e Retorno Total (550 + 250 = 800)
      expect(holding.accumulatedDividendsBRL).toBe(250.0);
      expect(holding.dividends).toBe(250.0);
      expect(holding.dividendsNative).toBe(250.0);
      expect(holding.totalReturnPnl).toBe(800.0);
      expect(holding.totalReturnPct).toBe(26.6667); // (800 / 3000) * 100

      // Diagnóstico de RF e Flags
      expect(holding.fixedIncomeDiagnostic).toBeNull();
      expect(holding.isCash).toBe(false);
      expect(holding.pricingMode).toBe("unit_price");
      expect(holding.weightPct).toBe(35.5); // (3550 / 10000) * 100
      expect(holding.notes).toBe("Posição estratégica de dividendos");
    });
  });

  describe("createCanonicalAssetHolding — Ativo Internacional USD", () => {
    it("deve converter custos, proventos e cotação de USD para BRL corretamente", () => {
      const usdResolvedPrice: CanonicalResolvedPrice = {
        ticker: "AAPL",
        priceQuote: 180.0,
        priceBRL: 990.0, // 180 * 5.50
        usdRate: 5.5,
        source: "api",
        isEstimate: false,
      };

      const holding = createCanonicalAssetHolding({
        assetId: "asset-aapl",
        ticker: "AAPL",
        assetClass: "Internacional",
        sector: "Tecnologia",
        currency: "USD",
        quantity: 10,
        averageCost: 150.0,
        totalCost: 1500.0, // $ 1,500.00
        resolvedPrice: usdResolvedPrice,
        accumulatedDividendsBRL: 110.0, // R$ 110,00 -> $ 20.00
        totalPortfolioValueBRL: 20000.0,
      });

      expect(holding.currency).toBe("USD");
      expect(holding.quantity).toBe(10);
      expect(holding.averageCost).toBe(150.0);
      expect(holding.totalCost).toBe(1500.0);

      // Conversão cambial BRL: 1500 * 5.50 = 8250.00
      expect(holding.totalCostBRL).toBe(8250.0);
      expect(holding.averageCostBRL).toBe(825.0);

      // Valor de mercado: 10 * 990 = 9900.00
      expect(holding.marketValueBRL).toBe(9900.0);

      // PnL: 9900 - 8250 = 1650.00 (20.00%)
      expect(holding.unrealizedPnl).toBe(1650.0);
      expect(holding.unrealizedPct).toBe(20.0);

      // Proventos
      expect(holding.accumulatedDividendsBRL).toBe(110.0);
      expect(holding.dividendsNative).toBe(20.0); // 110 / 5.50

      // Retorno Total: 1650 + 110 = 1760.00
      expect(holding.totalReturnPnl).toBe(1760.0);
      expect(holding.totalReturnPct).toBe(21.3333); // (1760 / 8250) * 100
    });
  });

  describe("createCanonicalAssetHolding — Renda Fixa e Diagnóstico Integral", () => {
    it("deve integrar os metadados de Renda Fixa, tributação e trava de vencimento", () => {
      const rfMetadata: FixedIncomeMetadata = {
        rate_type: "cdi",
        rate_value: 110,
        base_date: "2026-01-01",
        base_value: 10000.0,
        initial_investment_date: "2025-01-01",
        initial_investment_value: 10000.0,
        maturity_date: "2027-12-31",
        is_tax_exempt: false,
        issuer_type: "bancario_fgc",
      };

      const rfBalanceResult: FixedIncomeBalanceResult = {
        grossValue: 11250.0,
        netValue: 11031.25,
        totalAccruedInterest: 1250.0,
        totalProfit: 1250.0,
        taxAmount: 218.75,
        taxRatePct: 17.5,
        iofAmount: 0,
        iofRatePct: 0,
        businessDaysAccrued: 210,
        calendarDaysTotal: 670,
        isMatured: false,
        effectiveCutoffDate: "2026-10-31",
        taxCountdown: {
          currentRatePct: 17.5,
          nextRatePct: 15.0,
          daysRemaining: 60,
          nextBracketDate: "2026-12-31",
          estimatedTaxSavingsBRL: 31.25,
        },
        hasExplicitTaxInfo: true,
      };

      const rfResolvedPrice: CanonicalResolvedPrice = {
        ticker: "CDB-BANCO-110",
        priceQuote: 11250.0,
        priceBRL: 11250.0,
        usdRate: 1.0,
        source: "fixed_income",
        isEstimate: false,
      };

      const holding = createCanonicalAssetHolding({
        assetId: "asset-cdb-1",
        ticker: "CDB-BANCO-110",
        assetClass: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        averageCost: 10000.0,
        totalCost: 10000.0,
        resolvedPrice: rfResolvedPrice,
        fixedIncomeMetadata: rfMetadata,
        fixedIncomeResult: rfBalanceResult,
      });

      expect(holding.pricingMode).toBe("total_value");
      expect(holding.marketValueBRL).toBe(11250.0);
      expect(holding.unrealizedPnl).toBe(1250.0);
      expect(holding.unrealizedPct).toBe(12.5);

      // Diagnóstico detalhado de RF
      expect(holding.fixedIncomeDiagnostic).not.toBeNull();
      const diag = holding.fixedIncomeDiagnostic!;
      expect(diag.isFixedIncome).toBe(true);
      expect(diag.rateType).toBe("cdi");
      expect(diag.rateValue).toBe(110);
      expect(diag.issuerType).toBe("bancario_fgc");
      expect(diag.grossValueBRL).toBe(11250.0);
      expect(diag.netValueBRL).toBe(11031.25);
      expect(diag.accruedInterestBRL).toBe(1250.0);
      expect(diag.totalProfitBRL).toBe(1250.0);
      expect(diag.estimatedTaxBRL).toBe(218.75);
      expect(diag.effectiveTaxRatePct).toBe(17.5);
      expect(diag.businessDaysAccrued).toBe(210);
      expect(diag.calendarDaysTotal).toBe(670);
      expect(diag.isMatured).toBe(false);
      expect(diag.taxCountdown?.nextRatePct).toBe(15.0);
      expect(diag.taxCountdown?.daysRemaining).toBe(60);

      // Atalhos no nível do holding
      expect(holding.netValueBRL).toBe(11031.25);
      expect(holding.taxAmountBRL).toBe(218.75);
      expect(holding.taxRatePct).toBe(17.5);
      expect(holding.isMatured).toBe(false);
      expect(holding.maturityDate).toBe("2027-12-31");
    });
  });

  describe("createCanonicalAssetHolding — Caixa e Reserva Financeira", () => {
    it("deve tratar ativos de caixa com paridade 1:1 e PnL não realizado nulo", () => {
      const cashResolvedPrice: CanonicalResolvedPrice = {
        ticker: "CAIXA",
        priceQuote: 1.0,
        priceBRL: 1.0,
        usdRate: 1.0,
        source: "cash",
        isEstimate: false,
      };

      const holding = createCanonicalAssetHolding({
        assetId: "asset-caixa",
        ticker: "CAIXA",
        assetClass: "Caixa / Reserva",
        currency: "BRL",
        quantity: 5000.0,
        resolvedPrice: cashResolvedPrice,
      });

      expect(holding.isCash).toBe(true);
      expect(holding.pricingMode).toBe("cash");
      expect(holding.marketValueBRL).toBe(5000.0);
      expect(holding.valueBRL).toBe(5000.0);
      expect(holding.unrealizedPnl).toBe(0);
      expect(holding.unrealizedPct).toBeNull();
      expect(holding.totalReturnPnl).toBe(0);
      expect(holding.totalReturnPct).toBeNull();
    });
  });

  describe("createCanonicalAssetHolding — Salvaguardas e Invariantes Matemáticas", () => {
    it("deve retornar null em percentuais quando o custo total for zero (blindagem contra divisão por zero)", () => {
      const holding = createCanonicalAssetHolding({
        assetId: "asset-bonus",
        ticker: "BONS4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 10,
        averageCost: 0,
        totalCost: 0,
        resolvedPrice: baseResolvedPrice,
      });

      expect(holding.totalCostBRL).toBe(0);
      expect(holding.unrealizedPnl).toBe(355.0);
      expect(holding.unrealizedPct).toBeNull();
      expect(holding.totalReturnPct).toBeNull();
    });

    it("deve zerar custo médio e valor de mercado para quantidade zero", () => {
      const holding = createCanonicalAssetHolding({
        assetId: "asset-closed",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 0,
        averageCost: 30.0,
        totalCost: 3000.0,
        resolvedPrice: baseResolvedPrice,
      });

      expect(holding.quantity).toBe(0);
      expect(holding.averageCost).toBe(0);
      expect(holding.totalCost).toBe(0);
      expect(holding.averageCostBRL).toBe(0);
      expect(holding.totalCostBRL).toBe(0);
      expect(holding.marketValueBRL).toBe(0);
    });
  });

  describe("createFixedIncomeDiagnostic", () => {
    it("deve retornar null se os metadados forem nulos ou indefinidos", () => {
      expect(createFixedIncomeDiagnostic(null, null)).toBeNull();
      expect(createFixedIncomeDiagnostic(undefined, undefined)).toBeNull();
    });
  });

  describe("isCanonicalAssetHolding", () => {
    it("deve validar corretamente instâncias legítimas de CanonicalAssetHolding", () => {
      const holding = createCanonicalAssetHolding({
        assetId: "asset-1",
        ticker: "VALE3",
        currency: "BRL",
        quantity: 50,
        resolvedPrice: baseResolvedPrice,
      });

      expect(isCanonicalAssetHolding(holding)).toBe(true);
      expect(isCanonicalAssetHolding(null)).toBe(false);
      expect(isCanonicalAssetHolding({})).toBe(false);
      expect(isCanonicalAssetHolding({ ticker: "VALE3" })).toBe(false);
      expect(isCanonicalAssetHolding("not-an-object")).toBe(false);
    });
  });

  describe("createCanonicalPortfolioState — Carteira Multiativos Consolidada", () => {
    it("deve consolidar o estado patrimonial, caixas segregados BRL/USD, PnL e pesos proporcionais", () => {
      const petr4Holding = createCanonicalAssetHolding({
        assetId: "asset-petr4",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 30.0,
        totalCost: 3000.0,
        resolvedPrice: {
          ticker: "PETR4",
          priceQuote: 35.5,
          priceBRL: 35.5,
          usdRate: 1.0,
          source: "api",
          isEstimate: false,
        },
        accumulatedDividendsBRL: 250.0,
      });

      const aaplHolding = createCanonicalAssetHolding({
        assetId: "asset-aapl",
        ticker: "AAPL",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 10,
        averageCost: 150.0,
        totalCost: 1500.0,
        resolvedPrice: {
          ticker: "AAPL",
          priceQuote: 180.0,
          priceBRL: 990.0, // 180 * 5.50
          usdRate: 5.5,
          source: "api",
          isEstimate: false,
        },
        accumulatedDividendsBRL: 110.0,
      });

      const cdbHolding = createCanonicalAssetHolding({
        assetId: "asset-cdb",
        ticker: "CDB-110",
        assetClass: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        averageCost: 10000.0,
        totalCost: 10000.0,
        resolvedPrice: {
          ticker: "CDB-110",
          priceQuote: 11250.0,
          priceBRL: 11250.0,
          usdRate: 1.0,
          source: "fixed_income",
          isEstimate: false,
        },
        fixedIncomeDiagnostic: {
          isFixedIncome: true,
          rateType: "cdi",
          rateValue: 110,
          issuerType: "bancario_fgc",
          baseDate: "2026-01-01",
          baseValue: 10000.0,
          initialInvestmentDate: "2026-01-01",
          initialInvestmentValue: 10000.0,
          maturityDate: "2028-12-31",
          isMatured: false,
          isTaxExempt: false,
          manualTaxRatePct: null,
          grossValueBRL: 11250.0,
          netValueBRL: 11031.25,
          accruedInterestBRL: 1250.0,
          totalProfitBRL: 1250.0,
          estimatedTaxBRL: 218.75,
          effectiveTaxRatePct: 17.5,
          estimatedIofBRL: 0,
          iofRatePct: 0,
          businessDaysAccrued: 210,
          calendarDaysTotal: 300,
          taxCountdown: null,
          hasExplicitTaxInfo: true,
        },
      });

      const cashBrlHolding = createCanonicalAssetHolding({
        assetId: "asset-cash-brl",
        ticker: "CAIXA",
        assetClass: "Caixa / Reserva",
        currency: "BRL",
        quantity: 5000.0,
        resolvedPrice: {
          ticker: "CAIXA",
          priceQuote: 1.0,
          priceBRL: 1.0,
          usdRate: 1.0,
          source: "cash",
          isEstimate: false,
        },
      });

      const cashUsdHolding = createCanonicalAssetHolding({
        assetId: "asset-cash-usd",
        ticker: "CASH_USD",
        assetClass: "Caixa / Reserva",
        currency: "USD",
        quantity: 1000.0,
        resolvedPrice: {
          ticker: "CASH_USD",
          priceQuote: 1.0,
          priceBRL: 5.5,
          usdRate: 5.5,
          source: "cash",
          isEstimate: false,
        },
      });

      const customTwr: TwrConsolidatedResult = {
        accumulatedRatePct: 14.5,
        annualizedRatePct: 12.2,
        monthsElapsed: 10,
        currentSharePrice: 114.5,
        status: "ok",
        series: [],
      };

      const customIrr: XIRRResult = {
        annualizedRatePct: 15.8,
        rawAnnualizedRatePct: 15.8,
        periodRatePct: 14.2,
        daysElapsed: 300,
        isEligible: true,
        capitalCoveragePct: 100,
        status: "ok",
      };

      const state: CanonicalPortfolioState = createCanonicalPortfolioState({
        asOfDate: "2026-10-31",
        mode: "point_in_time",
        usdRate: 5.5,
        holdings: [petr4Holding, aaplHolding, cdbHolding, cashBrlHolding, cashUsdHolding],
        closedDividendsBRL: 140.0,
        realizedPnlBRL: 500.0,
        twr: customTwr,
        irr: customIrr,
        closedSnapshotsCount: 8,
        monthlyContributionCents: 150000,
        hasMarcoZeroContribution: true,
        marcoZeroMonth: "2026-01",
      });

      // Validação de Identificação e Câmbio
      expect(state.asOfDate).toBe("2026-10-31");
      expect(state.mode).toBe("point_in_time");
      expect(state.usdRate).toBe(5.5);

      // Caixa Segregado Multimoeda (Salvaguarda S15)
      expect(state.cashBRL).toBe(5000.0);
      expect(state.cashUSD).toBe(1000.0);
      expect(state.cashUSDBRL).toBe(5500.0); // 1000 * 5.50
      expect(state.totalCashBRL).toBe(10500.0); // 5000 + 5500

      // Patrimônio Total (Salvaguarda S14 — Fechamento ao Centavo)
      // Ativos: 3550 + 9900 + 11250 = 24700.00
      // Total: 24700 + 10500 = 35200.00
      expect(state.totalBRL).toBe(35200.0);
      expect(state.totalValueBRL).toBe(35200.0);

      // Custo Total dos Ativos em Custódia (sem caixa)
      // PETR4 (3000) + AAPL (1500 * 5.5 = 8250) + CDB (10000) = 21250.00
      expect(state.assetsTotalCostBRL).toBe(21250.0);
      expect(state.totalAppliedCostBRL).toBe(31750.0);
      expect(state.totalCostBRL).toBe(31750.0);

      // Ganho de Capital Não Realizado (unrealizedPnlBRL = 24700 - 21250 = 3450.00)
      expect(state.unrealizedPnlBRL).toBe(3450.0);
      expect(state.capitalGainPnl).toBe(3450.0);
      expect(state.unrealizedPct).toBe(16.2353); // (3450 / 21250) * 100
      expect(state.capitalGainPct).toBe(16.2353);

      // Proventos da Carteira
      expect(state.activeDividendsBRL).toBe(360.0); // 250 (PETR4) + 110 (AAPL)
      expect(state.closedDividendsBRL).toBe(140.0);
      expect(state.totalDividendsBRL).toBe(500.0); // 360 + 140

      // Retorno Total da Custódia Viva (3450 + 360 = 3810.00)
      expect(state.totalReturnPnlBRL).toBe(3810.0);
      expect(state.totalReturnPnl).toBe(3810.0);
      expect(state.totalReturnPct).toBe(17.9294); // (3810 / 21250) * 100

      // P&L Histórico Econômico Acumulado (3450 + 500 + 500 = 4450.00)
      expect(state.realizedPnlBRL).toBe(500.0);
      expect(state.realizedPnl).toBe(500.0);
      expect(state.allTimeEconomicPnlBRL).toBe(4450.0);
      expect(state.allTimeEconomicPnl).toBe(4450.0);

      // Fluxos do Bolso e Ganho Líquido
      expect(state.netInjectedCapitalBRL).toBe(31750.0); // 21250 custo + 10500 caixa
      expect(state.netPocketGainBRL).toBe(3450.0); // 35200 - 31750

      // TWR e IRR
      expect(state.twr).toEqual(customTwr);
      expect(state.portfolioTwr).toEqual(customTwr);
      expect(state.irr).toEqual(customIrr);
      expect(state.portfolioIrr).toEqual(customIrr);

      // Metadados
      expect(state.closedSnapshotsCount).toBe(8);
      expect(state.monthlyContributionCents).toBe(150000);
      expect(state.hasMarcoZeroContribution).toBe(true);
      expect(state.marcoZeroMonth).toBe("2026-01");

      // Verificação dos Pesos Proporcionais dos Holdings Atualizados (soma = 100%)
      const weights = state.holdings.map((h) => h.weightPct);
      expect(weights[0]).toBe(10.0852); // (3550 / 35200) * 100
      expect(weights[1]).toBe(28.125); // (9900 / 35200) * 100
      expect(weights[2]).toBe(31.9602); // (11250 / 35200) * 100
      expect(weights[3]).toBe(14.2045); // (5000 / 35200) * 100
      expect(weights[4]).toBe(15.625); // (5500 / 35200) * 100
      const totalWeight = weights.reduce((acc, w) => acc + w, 0);
      expect(Math.round(totalWeight * 100) / 100).toBe(100.0);
    });
  });

  describe("createCanonicalPortfolioState — Salvaguardas e Invariantes Matemáticas", () => {
    it("deve retornar null em percentuais e valores neutros para carteira vazia (blindagem divisão por zero)", () => {
      const state = createCanonicalPortfolioState({
        asOfDate: "2026-10-31",
      });

      expect(state.totalBRL).toBe(0);
      expect(state.totalCostBRL).toBe(0);
      expect(state.cashBRL).toBe(0);
      expect(state.cashUSD).toBe(0);
      expect(state.cashUSDBRL).toBe(0);
      expect(state.totalCashBRL).toBe(0);
      expect(state.unrealizedPnlBRL).toBe(0);
      expect(state.unrealizedPct).toBeNull();
      expect(state.totalReturnPnlBRL).toBe(0);
      expect(state.totalReturnPct).toBeNull();
      expect(state.allTimeEconomicPnlBRL).toBe(0);
      expect(state.netInjectedCapitalBRL).toBe(0);
      expect(state.netPocketGainBRL).toBe(0);

      // Defaults de TWR e IRR
      expect(state.twr).toEqual(DEFAULT_CANONICAL_TWR);
      expect(state.irr).toEqual(DEFAULT_CANONICAL_IRR);
      expect(state.holdings).toHaveLength(0);
    });

    it("deve tratar carteira contendo exclusivamente caixa sem distorcer taxas", () => {
      const state = createCanonicalPortfolioState({
        asOfDate: "2026-10-31",
        cashBRL: 20000.0,
      });

      expect(state.totalBRL).toBe(20000.0);
      expect(state.totalCostBRL).toBe(20000.0);
      expect(state.assetsTotalCostBRL).toBe(0);
      expect(state.totalAppliedCostBRL).toBe(20000.0);
      expect(state.totalCashBRL).toBe(20000.0);
      expect(state.unrealizedPnlBRL).toBe(0);
      expect(state.unrealizedPct).toBeNull();
      expect(state.totalReturnPnlBRL).toBe(0);
      expect(state.totalReturnPct).toBeNull();
      expect(state.netInjectedCapitalBRL).toBe(20000.0);
      expect(state.netPocketGainBRL).toBe(0);
    });
  });

  describe("isCanonicalPortfolioState", () => {
    it("deve validar corretamente instâncias legítimas de CanonicalPortfolioState", () => {
      const state = createCanonicalPortfolioState({
        asOfDate: "2026-10-31",
        cashBRL: 1000.0,
      });

      expect(isCanonicalPortfolioState(state)).toBe(true);
      expect(isCanonicalPortfolioState(null)).toBe(false);
      expect(isCanonicalPortfolioState(undefined)).toBe(false);
      expect(isCanonicalPortfolioState({})).toBe(false);
      expect(isCanonicalPortfolioState({ asOfDate: "2026-10-31" })).toBe(false);
    });
  });

  describe("createCanonicalMonthlyStatement — Fechamento Homogêneo na Base Snapshot (Caso Outubro/2026 Auditado)", () => {
    it("deve reproduzir a apuração canônica homogênea do caso auditado de Outubro/2026 (-3,6% e P&L -R$ 3.832,16)", () => {
      // Caso auditado do PLANO 40:
      // Saldo Inicial Set/2026: R$ 106.937,10 (Base Snapshot)
      // Saldo Final Out/2026: R$ 104.740,27 (Base Snapshot)
      // Aporte Líquido Out/2026: +R$ 1.635,33
      const statement: CanonicalMonthlyStatement = createCanonicalMonthlyStatement({
        month: "2026-10",
        startBalanceBRL: 106937.1,
        endBalanceBRL: 104740.27,
        startBalanceBase: "snapshot",
        endBalanceBase: "snapshot",
        netExternalCashFlowBRL: 1635.33,
      });

      // Homogeneidade Temporal de Bases (Salvaguarda S9)
      expect(statement.isHomogeneous).toBe(true);
      expect(statement.accountingBase).toBe("snapshot");
      expect(statement.startBalanceBase).toBe("snapshot");
      expect(statement.endBalanceBase).toBe("snapshot");
      expect(statement.heterogeneityWarning).toBeNull();

      // Métricas Financeiras Oficiais
      expect(statement.startBalanceBRL).toBe(106937.1);
      expect(statement.endBalanceBRL).toBe(104740.27);
      expect(statement.netExternalCashFlowBRL).toBe(1635.33);

      // P&L do Mês: 104.740,27 - 106.937,10 - 1.635,33 = -3.832,16
      expect(statement.monthNetPnlBRL).toBe(-3832.16);

      // Rentabilidade Modified Dietz ANBIMA/GIPS:
      // Denominador: 106.937,10 + (0,5 * 1.635,33) = 107.754,77
      // Taxa: -3.832,16 / 107.754,77 = -3,5563...% -> -3,56% (compatível com -3,6% exibido no card)
      expect(statement.monthRatePct).toBe(-3.56);
      expect(statement.isDenomCollapsed).toBe(false);

      // Decomposição Patrimonial:
      // deltaBalance = endBalance - startBalance = 104.740,27 - 106.937,10 = -2.196,83
      // Invariante: deltaBalance === monthNetPnlBRL + netExternalCashFlowBRL
      expect(statement.deltaBalanceBRL).toBe(-2196.83);
      expect(
        Math.round((statement.monthNetPnlBRL + statement.netExternalCashFlowBRL) * 100) / 100,
      ).toBe(statement.deltaBalanceBRL);
    });
  });

  describe("createCanonicalMonthlyStatement — Detecção e Blindagem contra Mistura de Bases Heterogêneas (Salvaguarda S9)", () => {
    it("deve detectar e sinalizar a mistura de bases heterogêneas que gerou a anomalia dos -13,9%", () => {
      // Reprodução exata do desvio auditado no código legado:
      // Início vindo de snapshot: R$ 106.937,10
      // Fim vindo de custódia reconstruída: R$ 93.623,83
      // Aporte líquido: +R$ 1.635,33
      const statement = createCanonicalMonthlyStatement({
        month: "2026-10",
        startBalanceBRL: 106937.1,
        endBalanceBRL: 93623.83,
        startBalanceBase: "snapshot",
        endBalanceBase: "reconstructed_custody",
        netExternalCashFlowBRL: 1635.33,
      });

      // Salvaguarda S9: flag de homogeneidade violada e aviso de auditoria
      expect(statement.isHomogeneous).toBe(false);
      expect(statement.heterogeneityWarning).not.toBeNull();
      expect(statement.heterogeneityWarning).toContain("[Salvaguarda S9]");
      expect(statement.heterogeneityWarning).toContain("snapshot");
      expect(statement.heterogeneityWarning).toContain("reconstructed_custody");

      // Demonstração do erro matemático provocado pela mistura de bases:
      // P&L artificial: 93.623,83 - 106.937,10 - 1.635,33 = -14.948,60
      expect(statement.monthNetPnlBRL).toBe(-14948.6);
      // Taxa distorcida em quase 4x (-13,87% ~ -13,9%)
      expect(statement.monthRatePct).toBe(-13.87);
    });
  });

  describe("createCanonicalMonthlyStatement — Fechamento Homogêneo na Base Reconstruída Analítica", () => {
    it("deve manter homogeneidade estrita quando ambas as pontas provêm da reconstrução de ativos", () => {
      const statement = createCanonicalMonthlyStatement({
        month: "2026-08",
        startBalanceBRL: 95000.0,
        endBalanceBRL: 98000.0,
        startBalanceBase: "reconstructed_custody",
        endBalanceBase: "reconstructed_custody",
        netExternalCashFlowBRL: 1000.0,
      });

      expect(statement.isHomogeneous).toBe(true);
      expect(statement.accountingBase).toBe("reconstructed_custody");
      expect(statement.startBalanceBase).toBe("reconstructed_custody");
      expect(statement.endBalanceBase).toBe("reconstructed_custody");
      expect(statement.heterogeneityWarning).toBeNull();

      // P&L: 98.000 - 95.000 - 1.000 = 2.000,00
      expect(statement.monthNetPnlBRL).toBe(2000.0);
      expect(statement.monthRatePct).toBeGreaterThan(0);
    });
  });

  describe("createCanonicalMonthlyStatement — Marco Zero / Mês Inaugural da Carteira", () => {
    it("deve tratar o mês inaugural com saldo inicial zero como base inaugural homogênea", () => {
      const statement = createCanonicalMonthlyStatement({
        month: "2026-01",
        startBalanceBRL: 0,
        endBalanceBRL: 10500.0,
        startBalanceBase: "zero",
        endBalanceBase: "snapshot",
        externalFlows: [
          {
            date: "2026-01-01",
            amount: 10000.0,
          },
        ],
      });

      expect(statement.isHomogeneous).toBe(true);
      expect(statement.accountingBase).toBe("inaugural");
      expect(statement.startBalanceBase).toBe("zero");
      expect(statement.heterogeneityWarning).toBeNull();

      // P&L: 10.500 - 0 - 10.000 = +500,00
      expect(statement.monthNetPnlBRL).toBe(500.0);
      expect(statement.monthRatePct).toBeGreaterThan(0);
      expect(statement.isDenomCollapsed).toBe(false);
    });
  });

  describe("createCanonicalMonthlyStatement — Salvaguarda de Colapso de Denominador", () => {
    it("deve neutralizar a taxa (null) quando resgates massivos colapsarem o capital base para < R$ 10,00", () => {
      // Início: 1.000,00; Resgate no dia 1: -995,00
      // Denominador cai abaixo de R$ 10,00
      const statement = createCanonicalMonthlyStatement({
        month: "2026-03",
        startBalanceBRL: 100.0,
        endBalanceBRL: 5.0,
        externalFlows: [
          {
            date: "2026-03-01",
            amount: -95.0,
          },
        ],
      });

      expect(statement.isDenomCollapsed).toBe(true);
      expect(statement.monthRatePct).toBeNull();
      // P&L financeiro em reais permanece preservado sem NaN ou Infinity
      expect(statement.monthNetPnlBRL).toBe(0);
    });
  });

  describe("createCanonicalMonthlyStatement — Precedência Soberana de explicitRatePct", () => {
    it("deve adotar a taxa oficial da corretora quando explicitRatePct for informada", () => {
      const statement = createCanonicalMonthlyStatement({
        month: "2026-05",
        startBalanceBRL: 50000.0,
        endBalanceBRL: 52000.0,
        explicitRatePct: 3.14,
      });

      expect(statement.monthRatePct).toBe(3.14);
      expect(statement.explicitRatePct).toBe(3.14);
    });
  });

  describe("createCanonicalMonthlyStatement — Decomposição Patrimonial e Interoperabilidade", () => {
    it("deve decompor corretamente P&L em ganho de mercado e proventos, mantendo aliases legados", () => {
      const statement = createCanonicalMonthlyStatement({
        month: "2026-07",
        startBalanceBRL: 80000.0,
        endBalanceBRL: 83000.0,
        monthDividendsBRL: 600.0,
        monthBuysBRL: 4000.0,
        monthSellsBRL: 1500.0,
        transactionsCount: 3,
        dividendsCount: 2,
        netExternalCashFlowBRL: 1000.0,
      });

      // P&L Total: 83.000 - 80.000 - 1.000 = 2.000,00
      expect(statement.monthNetPnlBRL).toBe(2000.0);
      expect(statement.monthDividendsBRL).toBe(600.0);

      // Decomposição: Ganho de Mercado = P&L - Proventos = 2.000 - 600 = 1.400,00
      expect(statement.marketGainBRL).toBe(1400.0);
      expect(statement.marketGainBRL + statement.monthDividendsBRL).toBe(statement.monthNetPnlBRL);

      // Turnover e contagens
      expect(statement.monthBuysBRL).toBe(4000.0);
      expect(statement.monthSellsBRL).toBe(1500.0);
      expect(statement.transactionsCount).toBe(3);
      expect(statement.dividendsCount).toBe(2);

      // Aliases de interoperabilidade com MonthlyStatementResult
      expect(statement.monthNetContributionBRL).toBe(1000.0);
      expect(statement.monthGrossContributionsBRL).toBe(1000.0);
      expect(statement.monthGrossWithdrawalsBRL).toBe(0);
    });
  });

  describe("isCanonicalMonthlyStatement", () => {
    it("deve validar corretamente instâncias legítimas de CanonicalMonthlyStatement", () => {
      const statement = createCanonicalMonthlyStatement({
        month: "2026-10",
        startBalanceBRL: 100000.0,
        endBalanceBRL: 102000.0,
      });

      expect(isCanonicalMonthlyStatement(statement)).toBe(true);
      expect(isCanonicalMonthlyStatement(null)).toBe(false);
      expect(isCanonicalMonthlyStatement(undefined)).toBe(false);
      expect(isCanonicalMonthlyStatement({})).toBe(false);
      expect(isCanonicalMonthlyStatement({ month: "2026-10" })).toBe(false);
    });
  });

  describe("createCanonicalFidelityReport — Diagnóstico de Fidelidade (Salvaguarda S10)", () => {
    it("deve detectar discrepância de -10,61% no caso auditado de Outubro/2026 e adotar o saldo oficial soberano", () => {
      // Caso auditado de Outubro/2026:
      // Snapshot Oficial: R$ 104.740,27 (Custo: R$ 99.381,85)
      // Custódia Reconstruída: R$ 93.623,83 (Custo: R$ 89.156,73)
      // Discrepância: -R$ 11.116,44 (-10,61%)
      const report: CanonicalFidelityReport = createCanonicalFidelityReport({
        snapshotTotalValueBRL: 104740.27,
        snapshotTotalCostBRL: 99381.85,
        reconstructedTotalValueBRL: 93623.83,
        reconstructedTotalCostBRL: 89156.73,
        totalAssetsCount: 25,
        calibratedQuotesCount: 15, // Cotações gravadas não podem dar bypass na discrepância (> 3%)
        apiQuotesCount: 10,
        fallbackQuotesCount: 0,
      });

      const status: CanonicalFidelityStatus = report.status;
      expect(status).toBe("discrepant");
      expect(report.toleranceThresholdPct).toBe(CANONICAL_FIDELITY_TOLERANCE_PCT); // 3.0%
      expect(report.legacyStatus).toBe("balance_only");
      expect(report.isTolerant).toBe(false);
      expect(report.isConciliated).toBe(false);
      expect(report.requiresCalibration).toBe(true);

      // Relatório analítico pode ser gerado, mas sua síntese executiva DEVE adotar soberanamente o snapshot
      expect(report.canGenerateExecutiveReport).toBe(true);
      expect(report.isDerivedFromSnapshot).toBe(true);
      expect(report.sovereignExecutiveBalanceBRL).toBe(104740.27);

      // Grandezas numéricas
      expect(report.snapshotTotalValueBRL).toBe(104740.27);
      expect(report.snapshotTotalCostBRL).toBe(99381.85);
      expect(report.reconstructedTotalValueBRL).toBe(93623.83);
      expect(report.reconstructedTotalCostBRL).toBe(89156.73);
      expect(report.discrepancyBRL).toBe(-11116.44);
      expect(report.discrepancyPct).toBe(-10.6133); // round4: -10.6133%

      // Custos
      expect(report.costDiscrepancyBRL).toBe(-10225.12);
      expect(report.costDiscrepancyPct).toBeCloseTo(-10.2887, 3);

      // UI e Auditoria
      expect(report.badgeVariant).toBe("warning");
      expect(report.badgeLabel).toBe("Conciliação Sugerida");
      expect(report.reasons.some((r) => r.includes("[Salvaguarda S10]"))).toBe(true);
      expect(report.reasons.some((r) => r.includes("-10.61%"))).toBe(true);
    });

    it("deve validar incondicionalmente a Salvaguarda S10 mesmo quando todas as cotações estiverem salvas", () => {
      // Defeito corrigido do código legado (point-in-time.ts:521):
      // No legado, savedPricesInMonthCount > 0 forçava fidelity = "complete", mesmo com discrepância massiva.
      // Na Salvaguarda S10, a tolerância de 3% é soberana e incondicional.
      const report = createCanonicalFidelityReport({
        snapshotTotalValueBRL: 50000.0,
        reconstructedTotalValueBRL: 45000.0, // -10.0% de discrepância
        totalAssetsCount: 10,
        calibratedQuotesCount: 10, // 100% salvas em portfolio_monthly_prices
        fallbackQuotesCount: 0,
      });

      expect(report.discrepancyPct).toBe(-10.0);
      expect(report.status).toBe("discrepant");
      expect(report.isTolerant).toBe(false);
      expect(report.requiresCalibration).toBe(true);
      expect(report.isDerivedFromSnapshot).toBe(true);
      expect(report.sovereignExecutiveBalanceBRL).toBe(50000.0);
      expect(report.badgeVariant).toBe("warning");
    });

    it("deve atestar alta fidelidade (100% conciliado) quando a discrepância estiver dentro da tolerância de 3%", () => {
      // Snapshot: R$ 100.000,00; Reconstruído: R$ 101.500,00 (+1,50% <= 3,0%)
      const report = createCanonicalFidelityReport({
        snapshotTotalValueBRL: 100000.0,
        snapshotTotalCostBRL: 80000.0,
        reconstructedTotalValueBRL: 101500.0,
        reconstructedTotalCostBRL: 80000.0,
        totalAssetsCount: 8,
        calibratedQuotesCount: 4,
        apiQuotesCount: 4,
        fallbackQuotesCount: 0,
      });

      expect(report.status).toBe("complete");
      expect(report.legacyStatus).toBe("complete");
      expect(report.isTolerant).toBe(true);
      expect(report.isConciliated).toBe(true);
      expect(report.requiresCalibration).toBe(false);
      expect(report.canGenerateExecutiveReport).toBe(true);
      expect(report.isDerivedFromSnapshot).toBe(false);
      expect(report.sovereignExecutiveBalanceBRL).toBe(101500.0); // Custódia analítica rigorosa
      expect(report.discrepancyBRL).toBe(1500.0);
      expect(report.discrepancyPct).toBe(1.5);
      expect(report.badgeVariant).toBe("positive");
      expect(report.badgeLabel).toBe("Fidelidade Alta (100% Conciliado)");
    });

    it("deve sinalizar status balance_only quando a competência possuir saldo de snapshot mas nenhum ativo (Marco Zero / TWA)", () => {
      const report = createCanonicalFidelityReport({
        snapshotTotalValueBRL: 75000.0,
        reconstructedTotalValueBRL: 0,
        totalAssetsCount: 0,
      });

      expect(report.status).toBe("balance_only");
      expect(report.legacyStatus).toBe("balance_only");
      expect(report.canGenerateExecutiveReport).toBe(false);
      expect(report.isDerivedFromSnapshot).toBe(true);
      expect(report.sovereignExecutiveBalanceBRL).toBe(75000.0);
      expect(report.badgeVariant).toBe("neutral");
      expect(report.badgeLabel).toBe("Saldo Consolidado");
      expect(report.reasons[0]).toContain("TWA/Marco Zero");
    });

    it("deve sinalizar cotações insuficientes quando fallbacks excederem 40% das posições", () => {
      const report = createCanonicalFidelityReport({
        snapshotTotalValueBRL: 100000.0,
        reconstructedTotalValueBRL: 100500.0, // Discrepância baixa (0,5%)
        totalAssetsCount: 10,
        fallbackQuotesCount: 5, // 5 / 10 = 50% (> 40%)
      });

      expect(report.status).toBe("insufficient");
      expect(report.legacyStatus).toBe("insufficient");
      expect(report.isTolerant).toBe(true);
      expect(report.isConciliated).toBe(false);
      expect(report.canGenerateExecutiveReport).toBe(false);
      expect(report.badgeVariant).toBe("critical");
      expect(report.badgeLabel).toBe("Cotações Insuficientes");
      expect(report.reasons[0]).toContain("> 40% em fallback");
    });

    it("deve lidar corretamente com competência sem snapshot gravado (apuração estritamente analítica)", () => {
      const report = createCanonicalFidelityReport({
        reconstructedTotalValueBRL: 32000.0,
        reconstructedTotalCostBRL: 28000.0,
        totalAssetsCount: 6,
        apiQuotesCount: 6,
        fallbackQuotesCount: 0,
      });

      expect(report.snapshotTotalValueBRL).toBeNull();
      expect(report.snapshotTotalCostBRL).toBeNull();
      expect(report.discrepancyBRL).toBe(0);
      expect(report.discrepancyPct).toBeNull();
      expect(report.status).toBe("complete");
      expect(report.canGenerateExecutiveReport).toBe(true);
      expect(report.isDerivedFromSnapshot).toBe(false);
      expect(report.sovereignExecutiveBalanceBRL).toBe(32000.0);
      expect(report.badgeVariant).toBe("positive");
    });

    it("deve sinalizar dados insuficientes quando não houver snapshot nem ativos", () => {
      const report = createCanonicalFidelityReport({
        reconstructedTotalValueBRL: 0,
        totalAssetsCount: 0,
      });

      expect(report.status).toBe("insufficient");
      expect(report.canGenerateExecutiveReport).toBe(false);
      expect(report.badgeVariant).toBe("critical");
      expect(report.badgeLabel).toBe("Dados Insuficientes");
    });
  });

  describe("isCanonicalFidelityReport", () => {
    it("deve validar corretamente instâncias legítimas de CanonicalFidelityReport", () => {
      const report = createCanonicalFidelityReport({
        snapshotTotalValueBRL: 10000.0,
        reconstructedTotalValueBRL: 10000.0,
        totalAssetsCount: 2,
      });

      expect(isCanonicalFidelityReport(report)).toBe(true);
      expect(isCanonicalFidelityReport(null)).toBe(false);
      expect(isCanonicalFidelityReport(undefined)).toBe(false);
      expect(isCanonicalFidelityReport({})).toBe(false);
      expect(isCanonicalFidelityReport({ status: "complete" })).toBe(false);
    });
  });
});
