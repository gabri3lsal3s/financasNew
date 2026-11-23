import { describe, expect, it } from "vitest";
import type {
  PortfolioAsset,
  PortfolioContribution,
  PortfolioMonthlyPrice,
  PortfolioSnapshot,
  PortfolioTransaction,
} from "@/types";
import {
  clearCanonicalEngineCache,
  evaluatePortfolioCanonicalState,
} from "./canonical-engine";

describe("canonical-engine", () => {
  // Limpar cache de memoização entre testes
  clearCanonicalEngineCache();

  // -------------------------------------------------------------------------
  // 1. Caso Real Auditado de Outubro/2026 (Anomalia dos -13,9% vs. -3,6%)
  // -------------------------------------------------------------------------
  describe("auditoria matemática Out/2026: resolução da anomalia dos -13,9%", () => {
    it("adota base homogênea soberana apurando -3,6% de retorno e -R$ 3.832,16 de P&L líquido", () => {
      // 1. Snapshot consolidado de Set/2026 (M-1)
      const prevSnapshot: PortfolioSnapshot = {
        id: "snap-set-2026",
        user_id: "user-audited",
        month: "2026-09",
        total_value: 106937.1,
        total_cost: 99381.85,
        status: "closed",
      };

      // 2. Snapshot consolidado oficial gravado de Out/2026 (M)
      const currSnapshot: PortfolioSnapshot = {
        id: "snap-out-2026",
        user_id: "user-audited",
        month: "2026-10",
        total_value: 104740.27,
        total_cost: 99381.85,
        status: "closed",
      };

      // 3. Aporte líquido externo de Out/2026
      const contributionOut: PortfolioContribution = {
        id: "contrib-out-2026",
        user_id: "user-audited",
        asset_id: null,
        date: "2026-10-15",
        amount: 1635.33,
        notes: "Aporte mensal Outubro",
      };

      // 4. Ativos na custódia que somam R$ 93.623,83 na reconstrução analítica
      // (divergência de -10,61% frente aos R$ 104.740,27 oficiais do snapshot)
      const assetPetr: PortfolioAsset = {
        id: "asset-petr",
        user_id: "user-audited",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 1000,
        average_price: 35.0,
      };

      const assetItub: PortfolioAsset = {
        id: "asset-itub",
        user_id: "user-audited",
        ticker: "ITUB4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 1500,
        average_price: 32.0,
      };

      const monthlyPrices: PortfolioMonthlyPrice[] = [
        {
          id: "mp-petr",
          user_id: "user-audited",
          ticker: "PETR4",
          month: "2026-10",
          price: 40.0, // 1000 * 40 = 40.000,00
          currency: "BRL",
          source: "api",
        },
        {
          id: "mp-itub",
          user_id: "user-audited",
          ticker: "ITUB4",
          month: "2026-10",
          price: 35.74922, // 1500 * 35.74922 = 53.623,83
          currency: "BRL",
          source: "api",
        },
      ];
      // Soma reconstruída: 40.000 + 53.623,83 = 93.623,83

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-10-31",
        mode: "point_in_time",
        assets: [assetPetr, assetItub],
        contributions: [contributionOut],
        snapshots: [prevSnapshot, currSnapshot],
        monthlyPrices,
        disableMemoization: true,
      });

      // Auditoria de Fidelidade
      expect(result.fidelity).toBeDefined();
      expect(result.fidelity?.status).toBe("discrepant");
      expect(result.fidelity?.isDerivedFromSnapshot).toBe(true);
      expect(result.fidelity?.snapshotTotalValueBRL).toBe(104740.27);
      expect(result.fidelity?.reconstructedTotalValueBRL).toBeCloseTo(93623.83, 1);
      expect(result.fidelity?.sovereignExecutiveBalanceBRL).toBe(104740.27);

      // Patrimônio adotado para a síntese executiva deve ser o saldo oficial do snapshot
      expect(result.totalBRL).toBe(104740.27);
      expect(result.totalValueBRL).toBe(104740.27);

      // Extrato Mensal da Competência: Homogeneidade Temporal de Bases (§Salvaguarda S9)
      const stmt = result.monthlyStatement;
      expect(stmt).toBeDefined();
      expect(stmt?.isHomogeneous).toBe(true);
      expect(stmt?.accountingBase).toBe("snapshot");
      expect(stmt?.startBalanceBRL).toBe(106937.1);
      expect(stmt?.endBalanceBRL).toBe(104740.27);
      expect(stmt?.netExternalCashFlowBRL).toBe(1635.33);

      // P&L do Mês: (104.740,27 - 106.937,10) - 1.635,33 = -3.832,16 (NUNCA -14.948,60!)
      expect(stmt?.monthNetPnlBRL).toBe(-3832.16);

      // Modified Dietz: r_M = -3.832,16 / (106.937,10 + 0,5 * 1.635,33) = -3,556% => ~ -3,56% ou -3,6%
      expect(stmt?.monthRatePct).toBeCloseTo(-3.56, 1);
      expect(stmt?.monthRatePct).not.toBeCloseTo(-13.9, 0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Os 5 Perfis de Usuário & Universalidade Multiusuário (§Salvaguarda S11)
  // -------------------------------------------------------------------------
  describe("universalidade multiusuário (5 perfis de investidores)", () => {
    it("Perfil 1: Usuário Ledger-First Completo (ordens explicam 100% da custódia, fidelidade completa)", () => {
      const assetAbeve: PortfolioAsset = {
        id: "asset-abev",
        user_id: "user-p1",
        ticker: "ABEV3",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 200,
        average_price: 14.5,
      };

      const txBuy: PortfolioTransaction = {
        id: "tx-b1",
        user_id: "user-p1",
        asset_id: "asset-abev",
        type: "buy",
        date: "2026-05-10",
        quantity: 200,
        price: 14.5,
        total: 2900.0,
      };

      const snapshot: PortfolioSnapshot = {
        id: "snap-p1-mai",
        user_id: "user-p1",
        month: "2026-05",
        total_value: 3000.0, // 200 * 15.00
        total_cost: 2900.0,
        status: "closed",
      };

      const monthlyPrices: PortfolioMonthlyPrice[] = [
        {
          id: "mp-abev",
          user_id: "user-p1",
          ticker: "ABEV3",
          month: "2026-05",
          price: 15.0,
          currency: "BRL",
          source: "api",
        },
      ];

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-05-31",
        mode: "point_in_time",
        assets: [assetAbeve],
        transactions: [txBuy],
        snapshots: [snapshot],
        monthlyPrices,
        disableMemoization: true,
      });

      expect(result.fidelity?.status).toBe("complete");
      expect(result.fidelity?.isConciliated).toBe(true);
      expect(result.totalBRL).toBe(3000.0);
      expect(result.totalCostBRL).toBe(2900.0);
      expect(result.unrealizedPnlBRL).toBe(100.0);
    });

    it("Perfil 2: Usuário Custódia Direta (sem ordens antigas, baseline soberano retroativo)", () => {
      const assetWege: PortfolioAsset = {
        id: "asset-wege",
        user_id: "user-p2",
        ticker: "WEGE3",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 50.0,
      };

      // Sem nenhuma transação cadastrada em portfolio_transactions
      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-06-30",
        mode: "point_in_time",
        assets: [assetWege],
        transactions: [],
        monthlyPrices: [
          {
            id: "mp-wege",
            user_id: "user-p2",
            ticker: "WEGE3",
            month: "2026-06",
            price: 55.0,
            currency: "BRL",
            source: "api",
          },
        ],
        disableMemoization: true,
      });

      // Deve preservar a quantidade e custo do ativo via baseline soberano (Salvaguarda S2)
      expect(result.positions).toHaveLength(1);
      expect(result.positions[0]?.quantity).toBe(100);
      expect(result.positions[0]?.totalCostBRL).toBe(5000.0);
      expect(result.positions[0]?.valueBRL).toBe(5500.0);
      expect(result.totalBRL).toBe(5500.0);
    });

    it("Perfil 3: Usuário Histórico TWA (somente snapshots, sem ativos detalhados, status balance_only)", () => {
      const snapJan: PortfolioSnapshot = {
        id: "snap-jan",
        user_id: "user-p3",
        month: "2024-01",
        total_value: 50000.0,
        total_cost: 45000.0,
        status: "closed",
      };

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2024-01-31",
        mode: "point_in_time",
        assets: [],
        snapshots: [snapJan],
        disableMemoization: true,
      });

      expect(result.fidelity?.status).toBe("balance_only");
      expect(result.totalBRL).toBe(50000.0);
      expect(result.totalCostBRL).toBe(0);
    });

    it("Perfil 4: Usuário Misto (snapshots no passado e ledger ativo recente)", () => {
      const snapAntigo: PortfolioSnapshot = {
        id: "snap-antigo",
        user_id: "user-p4",
        month: "2025-12",
        total_value: 80000.0,
        total_cost: 70000.0,
        status: "closed",
      };

      const assetRecente: PortfolioAsset = {
        id: "asset-valee",
        user_id: "user-p4",
        ticker: "VALE3",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 500,
        average_price: 60.0,
      };

      const txCompra: PortfolioTransaction = {
        id: "tx-vale-1",
        user_id: "user-p4",
        asset_id: "asset-valee",
        type: "buy",
        date: "2026-01-15",
        quantity: 500,
        price: 60.0,
        total: 30000.0,
      };

      const snapRecente: PortfolioSnapshot = {
        id: "snap-recente",
        user_id: "user-p4",
        month: "2026-01",
        total_value: 112000.0,
        total_cost: 100000.0,
        status: "closed",
      };

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-01-31",
        mode: "point_in_time",
        assets: [assetRecente],
        transactions: [txCompra],
        snapshots: [snapAntigo, snapRecente],
        monthlyPrices: [
          {
            id: "mp-vale",
            user_id: "user-p4",
            ticker: "VALE3",
            month: "2026-01",
            price: 64.0,
            currency: "BRL",
            source: "api",
          },
        ],
        disableMemoization: true,
      });

      expect(result.twr.series.length).toBeGreaterThanOrEqual(1);
      expect(result.monthlyStatement?.isHomogeneous).toBe(true);
    });

    it("Perfil 5: Usuário com múltiplos aportes e retiradas picadas ao longo do mês", () => {
      const prevSnap: PortfolioSnapshot = {
        id: "snap-p5-prev",
        user_id: "user-p5",
        month: "2026-07",
        total_value: 20000.0,
        total_cost: 18000.0,
        status: "closed",
      };

      const currSnap: PortfolioSnapshot = {
        id: "snap-p5-curr",
        user_id: "user-p5",
        month: "2026-08",
        total_value: 26000.0,
        total_cost: 23000.0,
        status: "closed",
      };

      const contrib1: PortfolioContribution = {
        id: "c-p5-1",
        user_id: "user-p5",
        asset_id: null,
        date: "2026-08-05",
        amount: 3000.0,
        notes: "Aporte semana 1",
      };

      const contrib2: PortfolioContribution = {
        id: "c-p5-2",
        user_id: "user-p5",
        asset_id: null,
        date: "2026-08-20",
        amount: 2000.0,
        notes: "Aporte semana 3",
      };

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-08-31",
        mode: "point_in_time",
        assets: [],
        contributions: [contrib1, contrib2],
        snapshots: [prevSnap, currSnap],
        disableMemoization: true,
      });

      const stmt = result.monthlyStatement;
      expect(stmt).toBeDefined();
      expect(stmt?.netExternalCashFlowBRL).toBe(5000.0);
      expect(stmt?.deltaBalanceBRL).toBe(6000.0); // 26000 - 20000
      expect(stmt?.monthNetPnlBRL).toBe(1000.0); // 6000 - 5000
      expect(stmt?.weightedCashFlowBRL).toBeGreaterThan(0);
      expect(stmt?.monthRatePct).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Imunidade a Divisão por Zero e Carteiras Zeradas (§Salvaguarda S11)
  // -------------------------------------------------------------------------
  describe("imunidade a divisão por zero e colapso de capital", () => {
    it("retorna retorno nulo/neutro sem gerar NaN ou Infinity para carteira vazia", () => {
      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-10-31",
        mode: "instant",
        assets: [],
        disableMemoization: true,
      });

      expect(result.totalBRL).toBe(0);
      expect(result.totalCostBRL).toBe(0);
      expect(result.unrealizedPct).toBeNull();
      expect(result.totalReturnPct).toBeNull();
      expect(result.monthlyStatement?.monthRatePct).toBeNull();
      expect(result.monthlyStatement?.isDenomCollapsed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Ativos Internacionais em USD e Resolução Dinâmica PTAX (§Salvaguarda S12)
  // -------------------------------------------------------------------------
  describe("ativos em USD e câmbio dinâmico PTAX", () => {
    it("converte ativo em USD pela taxa gravada de USDBRL=X na competência", () => {
      const assetAapl: PortfolioAsset = {
        id: "asset-aapl",
        user_id: "user-usd",
        ticker: "AAPL",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 10,
        average_price: 150.0, // Custo USD 150,00
      };

      const monthlyPrices: PortfolioMonthlyPrice[] = [
        {
          id: "pmp-ptax",
          user_id: "user-usd",
          ticker: "USDBRL=X",
          month: "2026-10",
          price: 5.78, // PTAX oficial da competência
          currency: "BRL",
          source: "api",
        },
        {
          id: "pmp-aapl",
          user_id: "user-usd",
          ticker: "AAPL",
          month: "2026-10",
          price: 200.0, // Cotação USD 200,00
          currency: "USD",
          source: "api",
        },
      ];

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-10-31",
        mode: "point_in_time",
        assets: [assetAapl],
        monthlyPrices,
        disableMemoization: true,
      });

      expect(result.usdRate).toBe(5.78);
      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      expect(pos.ticker).toBe("AAPL");
      expect(pos.priceQuote).toBe(200.0);
      expect(pos.priceBRL).toBe(1156.0); // 200 * 5.78
      expect(pos.totalCostBRL).toBe(8670.0); // 10 * 150 * 5.78
      expect(pos.valueBRL).toBe(11560.0); // 10 * 200 * 5.78
      expect(pos.unrealizedPnl).toBe(2890.0); // 11560 - 8670
    });
  });

  // -------------------------------------------------------------------------
  // 5. Invariante de Desdobramentos e Grupamentos (§Salvaguarda S17)
  // -------------------------------------------------------------------------
  describe("desdobramentos e grupamentos (splits / reverse splits)", () => {
    it("ajusta quantidade e preço médio conservando estritamente inalterado o Custo Total", () => {
      const assetItub: PortfolioAsset = {
        id: "asset-itub",
        user_id: "user-split",
        ticker: "ITUB4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 200,
        average_price: 15.0,
      };

      const txBuy: PortfolioTransaction = {
        id: "tx-b-1",
        user_id: "user-split",
        asset_id: "asset-itub",
        type: "buy",
        date: "2026-03-01",
        quantity: 100,
        price: 30.0,
        total: 3000.0,
      };

      const txSplit: PortfolioTransaction = {
        id: "tx-sp-1",
        user_id: "user-split",
        asset_id: "asset-itub",
        type: "split",
        date: "2026-03-15",
        quantity: 2, // Desdobramento 1:2
        price: 0,
        total: 0,
      };

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-03-31",
        mode: "point_in_time",
        assets: [assetItub],
        transactions: [txBuy, txSplit],
        monthlyPrices: [
          {
            id: "mp-itub",
            user_id: "user-split",
            ticker: "ITUB4",
            month: "2026-03",
            price: 18.0,
            currency: "BRL",
            source: "api",
          },
        ],
        disableMemoization: true,
      });

      const pos = result.positions[0]!;
      expect(pos.quantity).toBe(200); // 100 * 2
      expect(pos.totalCostBRL).toBe(3000.0); // Custo total estritamente preservado!
      expect(pos.averageCostBRL).toBe(15.0); // 3000 / 200
      expect(pos.valueBRL).toBe(3600.0); // 200 * 18
      expect(pos.unrealizedPnl).toBe(600.0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Renda Fixa com Metadados e Capitalização Diária (§Salvaguarda S5)
  // -------------------------------------------------------------------------
  describe("renda fixa com metadados e juros diários", () => {
    it("projeta juros diários a partir do base_date respeitando o CDI", () => {
      const assetCdb: PortfolioAsset = {
        id: "asset-cdb",
        user_id: "user-rf",
        ticker: "CDB-BANCO",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        average_price: 10000.0,
        fixed_income_metadata: {
          rate_type: "cdi",
          rate_value: 100, // 100% CDI
          base_date: "2026-01-02",
          base_value: 10000.0,
          initial_investment_value: 10000.0,
          initial_investment_date: "2026-01-02",
          is_tax_exempt: false,
        },
      };

      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-01-30",
        mode: "instant",
        assets: [assetCdb],
        annualCdiRate: 10.5,
        disableMemoization: true,
      });

      expect(result.positions).toHaveLength(1);
      const pos = result.positions[0]!;
      expect(pos.pricingMode).toBe("total_value");
      expect(pos.fixedIncomeDiagnostic).toBeDefined();
      expect(pos.fixedIncomeDiagnostic?.grossValueBRL).toBeGreaterThan(10000.0);
      expect(pos.fixedIncomeDiagnostic?.accruedInterestBRL).toBeGreaterThan(0);
      expect(pos.marketValueBRL).toBe(pos.fixedIncomeDiagnostic!.grossValueBRL);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Desempenho O(1) do Modo Instantâneo
  // -------------------------------------------------------------------------
  describe("desempenho instantâneo O(1)", () => {
    it("avalia carteira com múltiplos ativos em tempo de execução constante", () => {
      const assets: PortfolioAsset[] = Array.from({ length: 50 }, (_, i) => ({
        id: `asset-${i}`,
        user_id: "user-speed",
        ticker: `TICK${i}`,
        asset_class: i % 2 === 0 ? "Ações" : "FIIs",
        currency: "BRL",
        quantity: 100,
        average_price: 20.0,
      }));

      const assetPrices: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        assetPrices[`TICK${i}`] = 22.0;
      }

      const t0 = performance.now();
      const result = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-17",
        mode: "instant",
        assets,
        assetPrices,
        disableMemoization: true,
      });
      const t1 = performance.now();

      expect(result.totalCostBRL).toBe(100000.0); // 50 * 100 * 20
      expect(result.totalBRL).toBe(110000.0); // 50 * 100 * 22
      expect(result.unrealizedPnlBRL).toBe(10000.0);
      expect(t1 - t0).toBeLessThan(50); // Execução O(1) em menos de 50ms
    });
  });

  // -------------------------------------------------------------------------
  // 8. Preservação de Metadados, Estimativas e SSOT de Câmbio (Bloco A)
  // -------------------------------------------------------------------------
  describe("metadados de cotações, estimativas e SSOT de câmbio", () => {
    it("preserva source manual, api com metadados e nunca mascara fallback como Oficial API", () => {
      const assets: PortfolioAsset[] = [
        {
          id: "a-manual",
          user_id: "u1",
          ticker: "VALE3",
          asset_class: "Ações",
          currency: "BRL",
          quantity: 10,
          average_price: 58,
        },
        {
          id: "a-api",
          user_id: "u1",
          ticker: "PETR4",
          asset_class: "Ações",
          currency: "BRL",
          quantity: 10,
          average_price: 35,
        },
        {
          id: "a-miss",
          user_id: "u1",
          ticker: "WEGE3",
          asset_class: "Ações",
          currency: "BRL",
          quantity: 10,
          average_price: 42,
        },
      ];

      const res = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-17",
        mode: "instant",
        assets,
        assetPrices: [
          {
            ticker: "VALE3",
            price: 60,
            manual_price: 65,
            source: "manual",
            market_price_at: "2026-11-17T12:00:00.000Z",
          },
          {
            ticker: "PETR4",
            price: 39.5,
            source: "api",
            provider: "yahoo",
            market_price_at: "2026-11-17T18:55:00.000Z",
            fetched_at: "2026-11-17T19:00:00.000Z",
          },
        ],
        disableMemoization: true,
      });

      const vale = res.holdings.find((h) => h.ticker === "VALE3");
      const petr = res.holdings.find((h) => h.ticker === "PETR4");
      const wege = res.holdings.find((h) => h.ticker === "WEGE3");

      expect(vale?.quoteSource).toBe("manual");
      expect(vale?.resolvedPrice.isEstimate).toBe(false);
      expect(vale?.resolvedPrice.provider).toBe("manual");
      expect(vale?.resolvedPrice.badgeLabel).toBe("Manual");

      expect(petr?.quoteSource).toBe("api");
      expect(petr?.resolvedPrice.isEstimate).toBe(false);
      expect(petr?.resolvedPrice.provider).toBe("yahoo");
      expect(petr?.resolvedPrice.marketPriceAt).toBe("2026-11-17T18:55:00.000Z");
      expect(petr?.resolvedPrice.fetchedAt).toBe("2026-11-17T19:00:00.000Z");
      expect(petr?.resolvedPrice.badgeLabel).toBe("Oficial API");

      expect(wege?.quoteSource).toBe("fallback");
      expect(wege?.resolvedPrice.isEstimate).toBe(true);
      expect(wege?.resolvedPrice.provider).toBeNull();
      expect(wege?.resolvedPrice.badgeLabel).not.toBe("Oficial API");
    });

    it("expõe fxMetadata SSOT distinguindo PTAX real igual a 5.25 de fallback estático 5.25", () => {
      const assets: PortfolioAsset[] = [
        {
          id: "a-usd",
          user_id: "u1",
          ticker: "AAPL",
          asset_class: "Ações EUA",
          currency: "USD",
          quantity: 5,
          average_price: 200,
        },
      ];

      // Caso 1: PTAX oficial realmente vale 5.25 em assetPrices (`source: "api"`)
      const withOfficialFxAt525 = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-17",
        mode: "instant",
        assets,
        usdRate: 5.25,
        assetPrices: [
          {
            ticker: "USDBRL=X",
            price: 5.25,
            source: "api",
            provider: "bcb_ptax",
            market_price_at: "2026-11-17T16:11:00.000Z",
            fetched_at: "2026-11-17T16:12:00.000Z",
          },
          {
            ticker: "AAPL",
            price: 220,
            source: "api",
            provider: "yahoo",
          },
        ],
        disableMemoization: true,
      });

      expect(withOfficialFxAt525.fxMetadata).toEqual({
        rate: 5.25,
        source: "api",
        provider: "bcb_ptax",
        fxRateAt: "2026-11-17T16:11:00.000Z",
        fetchedAt: "2026-11-17T16:12:00.000Z",
        isFallback: false,
      });

      // Caso 2: Sem USDBRL=X e sem usdRate explícito → fallback estático explícito
      const withFallback = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-17",
        mode: "instant",
        assets,
        assetPrices: [{ ticker: "AAPL", price: 220, source: "api" }],
        disableMemoization: true,
      });

      expect(withFallback.fxMetadata).toEqual({
        rate: 5.25,
        source: "fallback",
        provider: null,
        fxRateAt: null,
        fetchedAt: null,
        isFallback: true,
      });
    });
  });
});
