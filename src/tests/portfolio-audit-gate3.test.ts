import { describe, expect, it } from "vitest";
import {
  calculateTwrSeries,
  type TwrMonthlyInputPoint,
} from "@/domain/portfolio/twr";
import {
  buildPortfolioMonthlySeries,
} from "@/domain/portfolio/summary";
import {
  evaluatePortfolioCanonicalState,
} from "@/domain/portfolio/canonical-engine";
import {
  buildPortfolioCashFlows,
  calculateNetInjectedCapital,
  calculateXIRR,
  isDividendReinvestment,
} from "@/domain/portfolio/irr";
import {
  calculateConsolidatedBenchmarks,
} from "@/domain/portfolio/benchmarks";
import {
  GOLDEN_AS_OF_DATE,
  GOLDEN_ASSETS_FIXTURE,
  GOLDEN_EXPECTED,
  GOLDEN_PTAX_RATE,
  GOLDEN_TRANSACTIONS_FIXTURE,
} from "./fixtures/golden_portfolio_6445";

describe("Portão de Qualidade 3 (Gate 3) — Unificação do Motor de Rentabilidade (TWR / Cotas, TIR/XIRR e Proventos)", () => {
  describe("Critério 1: Teste de Invariância de Aporte (Time-Weighted Return Invariance)", () => {
    it("prova que um aporte de +R$ 10.000,00 sem variação de cotação produz exatamente 0,0000% de TWR e mantém a cota inalterada", () => {
      // Mês 1: Saldo inicial R$ 10.000,00, Custo R$ 10.000,00
      // Mês 2: Saldo R$ 20.000,00 após aporte de R$ 10.000,00 no bolso (nenhum ativo subiu ou caiu)
      const pointsWithFlow: TwrMonthlyInputPoint[] = [
        { month: "2026-01", totalValueBRL: 10000, totalCostBRL: 10000 },
        {
          month: "2026-02",
          totalValueBRL: 20000,
          totalCostBRL: 20000,
          netExternalCashFlowBRL: 10000,
        },
      ];

      const resWithFlow = calculateTwrSeries(pointsWithFlow);
      expect(resWithFlow.status).toBe("ok");
      // Retorno do Mês 2 deve ser rigorosamente 0.00%
      expect(resWithFlow.series[1]?.monthRatePct).toBe(0);
      expect(resWithFlow.series[1]?.accumulatedRatePct).toBe(0);
      expect(resWithFlow.series[1]?.sharePrice).toBe(100.0);
      // Cotas emitidas: 100 cotas velhas + 100 cotas novas pelo aporte = 200 cotas
      expect(resWithFlow.series[1]?.totalShares).toBe(200.0);

      // Modalidade B: Quando o fluxo externo não é informado explicitamente em netExternalCashFlowBRL,
      // mas o custo variou de 10k para 20k (F_t = C_t - C_{t-1} = 10.000)
      const pointsInferred: TwrMonthlyInputPoint[] = [
        { month: "2026-01", totalValueBRL: 10000, totalCostBRL: 10000 },
        { month: "2026-02", totalValueBRL: 20000, totalCostBRL: 20000 },
      ];

      const resInferred = calculateTwrSeries(pointsInferred);
      expect(resInferred.series[1]?.monthRatePct).toBe(0);
      expect(resInferred.series[1]?.accumulatedRatePct).toBe(0);
      expect(resInferred.series[1]?.sharePrice).toBe(100.0);
      expect(resInferred.series[1]?.totalShares).toBe(200.0);
    });
  });

  describe("Critério 2: Expurgo de Fluxo nos Meses Críticos do Golden Dataset (BUG-02)", () => {
    it("calcula o TWR de Set/2026 como +2,61% (expurgando aporte de R$ 368,80) em vez do distorcido +4,69%", () => {
      // Dados reais do caso BR-20261118-6445:
      // Ago/2026: Saldo R$ 17.730,77, Custo R$ 16.802,03
      // Set/2026: Saldo R$ 18.562,39, Custo R$ 17.170,83 (Aporte = +R$ 368,80)
      // Variação bruta sem expurgo = (18562.39 - 17730.77) / 17730.77 = +4.69% (ERRADO)
      // Variação com expurgo do fluxo = (18562.39 - 17730.77 - 368.80) / 17730.77 = 462.82 / 17730.77 = +2.61% (CORRETO)
      const points: TwrMonthlyInputPoint[] = [
        { month: "2026-08", totalValueBRL: 17730.77, totalCostBRL: 16802.03 },
        {
          month: "2026-09",
          totalValueBRL: 18562.39,
          totalCostBRL: 17170.83,
          netExternalCashFlowBRL: 368.8,
        },
      ];

      const res = calculateTwrSeries(points, { inferredFlowWeight: 0 });
      expect(res.series[1]?.monthRatePct).toBe(2.61);
    });

    it("calcula o TWR de Out/2026 como -3,13% (expurgando aporte de R$ 338,18) em vez do distorcido -1,31%", () => {
      // Set/2026: Saldo R$ 18.562,39, Custo R$ 17.170,83
      // Out/2026: Saldo R$ 18.318,48, Custo R$ 17.509,01 (Aporte = +R$ 338,18)
      // Variação bruta sem expurgo = (18318.48 - 18562.39) / 18562.39 = -1.31% (ERRADO)
      // Variação com expurgo = (18318.48 - 18562.39 - 338.18) / 18562.39 = -582.09 / 18562.39 = -3.136% -> -3.13% (CORRETO)
      const points: TwrMonthlyInputPoint[] = [
        { month: "2026-09", totalValueBRL: 18562.39, totalCostBRL: 17170.83 },
        {
          month: "2026-10",
          totalValueBRL: 18318.48,
          totalCostBRL: 17509.01,
          netExternalCashFlowBRL: 338.18,
        },
      ];

      const res = calculateTwrSeries(points, { inferredFlowWeight: 0 });
      expect(res.series[1]?.monthRatePct).toBe(-3.14); // -3.136% arredondado para -3.14%
      expect(res.series[1]?.monthRatePct).toBeLessThan(-3.0);
    });
  });

  describe("Critério 3: Espinha Dorsal Contínua do Calendário e Resgate de Ago/2026 (BUG-04 e BUG-05)", () => {
    it("gera exatamente 26 competências contínuas de Out/2024 a Nov/2026 interpolando Ago/2026 omitido", () => {
      // Simulação do banco de dados onde Ago/2026 (2026-08) não foi salvo por job falho
      const rawSnapshotsWithoutAugust = [
        { month: "2024-10", total_value: 3000, total_cost: 3000 },
        { month: "2024-11", total_value: 3100, total_cost: 3000 },
        { month: "2024-12", total_value: 3200, total_cost: 3000 },
        { month: "2025-01", total_value: 4000, total_cost: 4000 },
        { month: "2025-02", total_value: 4100, total_cost: 4000 },
        { month: "2025-03", total_value: 4200, total_cost: 4000 },
        { month: "2025-04", total_value: 5000, total_cost: 5000 },
        { month: "2025-05", total_value: 5100, total_cost: 5000 },
        { month: "2025-06", total_value: 6000, total_cost: 6000 },
        { month: "2025-07", total_value: 7000, total_cost: 7000 },
        { month: "2025-08", total_value: 8000, total_cost: 8000 },
        { month: "2025-09", total_value: 9000, total_cost: 9000 },
        { month: "2025-10", total_value: 10000, total_cost: 10000 },
        { month: "2025-11", total_value: 11000, total_cost: 11000 },
        { month: "2025-12", total_value: 12000, total_cost: 12000 },
        { month: "2026-01", total_value: 13000, total_cost: 13000 },
        { month: "2026-02", total_value: 14000, total_cost: 14000 },
        { month: "2026-03", total_value: 15000, total_cost: 15000 },
        { month: "2026-04", total_value: 16000, total_cost: 16000 },
        { month: "2026-05", total_value: 16500, total_cost: 16000 },
        { month: "2026-06", total_value: 17000, total_cost: 16500 },
        { month: "2026-07", total_value: 17500, total_cost: 16800 },
        // 2026-08 OMITIDO INTENCIONALMENTE NO BANCO!
        { month: "2026-09", total_value: 18562.39, total_cost: 17170.83 },
        { month: "2026-10", total_value: 18318.48, total_cost: 17509.01 },
      ];

      const currentMonthPoint = {
        month: "2026-11",
        total_value: GOLDEN_EXPECTED.totalPatrimonyBRL,
        total_cost: GOLDEN_EXPECTED.totalConsolidatedCostBRL,
      };

      const fullSeries = buildPortfolioMonthlySeries({
        rawSnapshots: rawSnapshotsWithoutAugust,
        currentMonthPoint,
        dividends: [],
        limit: 0,
      });

      // Total de competências deve ser rigorosamente 26 (e não 25)
      expect(fullSeries).toHaveLength(GOLDEN_EXPECTED.totalCompetenciesCount); // 26
      expect(fullSeries[0]?.month).toBe("2024-10");
      expect(fullSeries[fullSeries.length - 1]?.month).toBe("2026-11");

      // Ago/2026 deve existir na série com interpolação conservadora de Jul/2026
      const augustPoint = fullSeries.find((pt) => pt.month === "2026-08");
      expect(augustPoint).toBeDefined();
      expect(augustPoint?.month).toBe("2026-08");
      expect(augustPoint?.status).toBe("closed");
      expect(augustPoint?.valueBRL).toBe(17500);
      expect(augustPoint?.costBRL).toBe(16800);

      // Quantidade de meses fechados anteriores ao mês atual (2026-11)
      const closedCount = fullSeries.filter((pt) => pt.month < "2026-11").length;
      expect(closedCount).toBe(25);
    });
  });

  describe("Critério 4: Unificação da Fonte Única da Verdade (SSOT) entre Dossiê e Extrato (BUG-03)", () => {
    it("garante que Dossiê (portfolioTwr) e Extrato (allMonthlySeries) consomem a mesma cota e MTD idênticos", () => {
      const state = evaluatePortfolioCanonicalState({
        mode: "instant",
        asOfDate: GOLDEN_AS_OF_DATE,
        assets: GOLDEN_ASSETS_FIXTURE,
        transactions: GOLDEN_TRANSACTIONS_FIXTURE,
        cashBalance: GOLDEN_EXPECTED.cashBRL,
        usdRate: GOLDEN_PTAX_RATE,
        snapshots: [
          { id: "snap-09", user_id: "user-6445", month: "2026-09", total_value: 18562.39, total_cost: 17170.83 },
          { id: "snap-10", user_id: "user-6445", month: "2026-10", total_value: 18318.48, total_cost: 17509.01 },
        ],
      });

      // 1. TWR do Estado Consolidado (consumido pelo Dossiê)
      const dossieTwr = state.twr;
      const dossieAccumulated = dossieTwr.accumulatedRatePct;
      const dossieSharePrice = dossieTwr.currentSharePrice;

      // 2. Extrato Analítico (allMonthlySeries)
      const extratoSeries = state.allMonthlySeries;
      const latestExtratoPoint = extratoSeries[extratoSeries.length - 1];

      expect(latestExtratoPoint).toBeDefined();
      expect(latestExtratoPoint?.month).toBe("2026-11");

      // Congruência estrita SSOT:
      expect(latestExtratoPoint?.twrAccumulatedPct).toBe(dossieAccumulated);
      expect(latestExtratoPoint?.sharePrice).toBe(dossieSharePrice);

      // O MTD deve ser o retorno do último mês na série
      const mtdRate = latestExtratoPoint?.twrMonthPct;
      expect(mtdRate).toBeDefined();
      expect(dossieTwr.series[dossieTwr.series.length - 1]?.monthRatePct).toBe(mtdRate);

      // closedSnapshotsCount no baseState
      expect(state.closedSnapshotsCount).toBe(2);
    });
  });

  describe("Critério 5: Série Histórica de Proventos e Invariante de Acúmulo Progressivo (BUG-07, BUG-08 e BUG-09)", () => {
    it("respeita a invariante ∑ Proventos Mês ≡ Proventos Acum._T e não antecipa proventos retroativamente", () => {
      const rawSnapshots = [
        { month: "2026-01", total_value: 10000, total_cost: 10000 },
        { month: "2026-02", total_value: 10500, total_cost: 10000 },
        { month: "2026-03", total_value: 11000, total_cost: 10000 },
      ];

      // Proventos pingando mês a mês
      const dividends = [
        { date: "2026-01-15", amount: 50.0 },
        { date: "2026-02-15", amount: 100.0 },
        { date: "2026-03-15", amount: 150.0 },
      ];

      const series = buildPortfolioMonthlySeries({
        rawSnapshots,
        dividends,
        initialAccumulatedDividends: 0,
        limit: 0,
      });

      expect(series).toHaveLength(3);

      // Mês 1 (Jan/26): Proventos Mês = 50.00, Proventos Acum = 50.00
      expect(series[0]?.monthDividendsBRL).toBe(50.0);
      expect(series[0]?.accumulatedDividendsBRL).toBe(50.0);

      // Mês 2 (Fev/26): Proventos Mês = 100.00, Proventos Acum = 150.00
      expect(series[1]?.monthDividendsBRL).toBe(100.0);
      expect(series[1]?.accumulatedDividendsBRL).toBe(150.0);

      // Mês 3 (Mar/26): Proventos Mês = 150.00, Proventos Acum = 300.00
      expect(series[2]?.monthDividendsBRL).toBe(150.0);
      expect(series[2]?.accumulatedDividendsBRL).toBe(300.0);

      // Invariante Canônica: ∑(Proventos Mês) === Proventos Acum._T
      const sumMonthlyDividends = series.reduce((acc, pt) => acc + (pt.monthDividendsBRL ?? 0), 0);
      const finalAccumulated = series[series.length - 1]?.accumulatedDividendsBRL ?? 0;
      expect(sumMonthlyDividends).toBe(finalAccumulated);
      expect(finalAccumulated).toBe(300.0);

      // Prova de não-retroatividade: Mês 1 NUNCA pode ter o valor final de 300.00!
      expect(series[0]?.accumulatedDividendsBRL).not.toBe(finalAccumulated);
    });
  });

  describe("Critério 6: Neutralidade de Reinvestimento de Proventos no Solver XIRR (BUG-10)", () => {
    it("não trata compras feitas com saldo de dividendos como nova saída de caixa do bolso do usuário", () => {
      // Cenário:
      // Dia 1: Aporte inicial de R$ 10.000,00 (dinheiro saindo do bolso: CF = -10.000)
      // Dia 60: Recebe R$ 500,00 de proventos na conta e reinveste na carteira
      // Se a compra com dinheiro de dividendos for marcada com [Reinvestimento], ela NÃO deve gerar novo CF negativo de bolso!
      const contributions = [
        { date: "2026-01-01", amount: 10000, notes: "Aporte inicial do bolso" },
        { date: "2026-03-01", amount: 500, notes: "[Reinvestimento] de proventos FIIs" },
      ];

      expect(isDividendReinvestment(contributions[1]!)).toBe(true);

      const flows = buildPortfolioCashFlows({
        contributions,
        currentPortfolioValueBRL: 11000, // Patrimônio subiu para 11k
        today: "2027-01-01", // 1 ano de histórico para satisfazer salvaguarda CVM/ANBIMA >= 365 dias
      });

      // Deve ter apenas 2 fluxos no bolso:
      // 1. O aporte inicial de -10.000
      // 2. O saldo final de liquidação hipotética de +11.000
      // O reinvestimento de 500 NÃO deve aparecer como fluxo negativo de -500!
      expect(flows).toHaveLength(2);
      expect(flows[0]?.amount).toBe(-10000);
      expect(flows[1]?.amount).toBe(11000);

      // Capital líquido injetado do bolso deve ser R$ 10.000,00 (e não R$ 10.500,00)
      const netInjected = calculateNetInjectedCapital(contributions);
      expect(netInjected).toBe(10000);

      // Resolução da XIRR sobre o capital real do bolso
      const xirrRes = calculateXIRR(flows);
      expect(xirrRes.status).toBe("ok");
      expect(xirrRes.annualizedRatePct).toBeGreaterThan(0);
    });
  });

  describe("Critério 7: Comparativo de Mercado Ibovespa e Sharpe (BUG-15)", () => {
    it("assegura que o benchmark Ibovespa para horizonte plurianual (> 12m) não é rebaixado para 1,0%", () => {
      const benchmarks = calculateConsolidatedBenchmarks({
        portfolioRatePct: 11.5,
        monthsCount: 26,
        annualCdiRate: 10.5,
        annualSelicRate: 10.5,
        annualIpcaRate: 4.0,
      });

      const ibov = benchmarks.items.find((i) => i.key === "ibov");
      expect(ibov).toBeDefined();
      // O Ibovespa composto para 26 meses a 12% a.a. deve ser > 25% (e NUNCA 1,0% do BUG-15!)
      expect(ibov?.benchmarkRatePct).toBeGreaterThan(25.0);
      expect(ibov?.benchmarkRatePct).toBeLessThan(35.0);

      // O percentual do benchmark deve ser condizente (~40% a 50% do Ibov) e NÃO 1148%
      expect(ibov?.pctOfBenchmark).toBeLessThan(100.0);
      expect(ibov?.pctOfBenchmark).toBeGreaterThan(30.0);
    });
  });
});
