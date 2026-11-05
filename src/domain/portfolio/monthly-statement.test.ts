import { describe, expect, it } from "vitest";
import { calculateMonthlyStatement } from "./monthly-statement";

describe("monthly-statement — Apuração da Competência Mensal", () => {
  describe("Quality Gate 1 (QG1) — Cenários Canônicos", () => {
    it("Cenário A: Queda no mês sem aportes (M-1 = 112.000; M = 110.000 -> monthRatePct = -1.79%, monthNetPnlBRL = -2000.00)", () => {
      const result = calculateMonthlyStatement({
        month: "2026-03",
        startBalanceBRL: 112000,
        endBalanceBRL: 110000,
      });

      expect(result.month).toBe("2026-03");
      expect(result.startBalanceBRL).toBe(112000);
      expect(result.endBalanceBRL).toBe(110000);
      expect(result.monthNetPnlBRL).toBe(-2000);
      expect(result.monthRatePct).toBe(-1.79);
      expect(result.monthNetContributionBRL).toBe(0);
      expect(result.weightedCapitalBaseBRL).toBe(112000);
    });

    it("Cenário B: Aporte no dia 15 com ganho no mês (M-1 = 100.000; Aporte dia 15 = 10.000; M = 115.000 -> Ganho de 5.000, taxa ponderada)", () => {
      // 2026-04 tem 30 dias. Dia 15: W = (30 - 15 + 1) / 30 = 16 / 30 = 0.5333...
      // Fluxo Ponderado = 10.000 * 16 / 30 = 5.333,33
      // Base de Capital = 100.000 + 5.333,33 = 105.333,33
      // Ganho Líquido = 115.000 - 100.000 - 10.000 = 5.000
      // Taxa = 5.000 / 105.333,33 = +4.75%
      const result = calculateMonthlyStatement({
        month: "2026-04",
        startBalanceBRL: 100000,
        endBalanceBRL: 115000,
        externalFlows: [
          {
            date: "2026-04-15",
            amount: 10000,
          },
        ],
      });

      expect(result.month).toBe("2026-04");
      expect(result.monthNetPnlBRL).toBe(5000);
      expect(result.monthNetContributionBRL).toBe(10000);
      expect(result.monthGrossContributionsBRL).toBe(10000);
      expect(result.monthGrossWithdrawalsBRL).toBe(0);
      expect(result.weightedCashFlowBRL).toBe(5333.33);
      expect(result.weightedCapitalBaseBRL).toBe(105333.33);
      expect(result.monthRatePct).toBe(4.75);
      expect(result.monthRatePct).toBeGreaterThan(0);
    });
  });

  describe("Imunidade Temporal Estrita a Anos e Meses Anteriores", () => {
    it("isola estritamente os fluxos, proventos e transações da competência solicitada", () => {
      const result = calculateMonthlyStatement({
        month: "2026-05",
        startBalanceBRL: 50000,
        endBalanceBRL: 52000,
        externalFlows: [
          // Mês anterior (deve ser ignorado)
          { date: "2026-04-20", amount: 15000 },
          // Mês corrente (deve ser incluído)
          { date: "2026-05-10", amount: 1000 },
          // Ano passado (deve ser ignorado)
          { date: "2025-05-10", amount: 50000 },
          // Mês futuro (deve ser ignorado)
          { date: "2026-06-01", amount: 20000 },
        ],
        dividends: [
          { date: "2025-12-15", amount: 1200 },
          { date: "2026-04-30", amount: 450 },
          { date: "2026-05-12", amount: 320.5 },
          { date: "2026-05-25", amount: 80.25 },
          { date: "2026-06-10", amount: 500 },
        ],
        transactions: [
          { date: "2025-01-10", type: "buy", total: 10000 },
          { date: "2026-04-15", type: "buy", total: 5000 },
          { date: "2026-05-05", type: "buy", total: 2000 },
          { date: "2026-05-20", type: "sell", total: 1500 },
          { date: "2026-06-12", type: "buy", total: 3000 },
        ],
      });

      expect(result.month).toBe("2026-05");
      // Fluxos externos: apenas 1.000 em 2026-05-10
      expect(result.monthNetContributionBRL).toBe(1000);
      expect(result.monthGrossContributionsBRL).toBe(1000);
      // P&L = (52.000 - 50.000) - 1.000 = 1.000
      expect(result.monthNetPnlBRL).toBe(1000);
      // Proventos: 320.50 + 80.25 = 400.75
      expect(result.monthDividendsBRL).toBe(400.75);
      expect(result.dividendsCount).toBe(2);
      // Movimentações: compra de 2.000 e venda de 1.500
      expect(result.monthBuysBRL).toBe(2000);
      expect(result.monthSellsBRL).toBe(1500);
      expect(result.transactionsCount).toBe(2);
    });
  });

  describe("Invariantes de Consistência e Regras de Negócio", () => {
    it("garante taxa estritamente negativa se o saldo recuou sem retiradas", () => {
      const result = calculateMonthlyStatement({
        month: "2026-01",
        startBalanceBRL: 80000,
        endBalanceBRL: 79000,
      });

      expect(result.monthNetPnlBRL).toBe(-1000);
      expect(result.monthRatePct).toBeLessThan(0);
      expect(result.monthRatePct).toBe(-1.25);
    });

    it("trata retiradas do bolso (resgates) identificadas por valor negativo ou notas descritivas", () => {
      // M-1 = 100.000, Resgate de 20.000 no dia 1, Saldo M = 82.000
      // 2026-05 (31 dias). Dia 1: W = (31 - 1 + 1) / 31 = 31/31 = 1.0
      // Fluxo Líquido = -20.000
      // Fluxo Ponderado = -20.000 * 1.0 = -20.000
      // Capital Base = 100.000 - 20.000 = 80.000
      // Ganho = 82.000 - 100.000 - (-20.000) = +2.000
      // Taxa = 2.000 / 80.000 = +2.5%
      const result = calculateMonthlyStatement({
        month: "2026-05",
        startBalanceBRL: 100000,
        endBalanceBRL: 82000,
        externalFlows: [
          {
            date: "2026-05-01",
            amount: 20000,
            notes: "Transferência para conta corrente [Resgate]",
          },
        ],
      });

      expect(result.monthGrossWithdrawalsBRL).toBe(20000);
      expect(result.monthGrossContributionsBRL).toBe(0);
      expect(result.monthNetContributionBRL).toBe(-20000);
      expect(result.monthNetPnlBRL).toBe(2000);
      expect(result.weightedCapitalBaseBRL).toBe(80000);
      expect(result.monthRatePct).toBe(2.5);
    });

    it("respeita explicitRatePct informado pelo usuário ou corretora", () => {
      const result = calculateMonthlyStatement({
        month: "2026-06",
        startBalanceBRL: 100000,
        endBalanceBRL: 102000,
        explicitRatePct: 1.85,
      });

      expect(result.monthRatePct).toBe(1.85);
      expect(result.monthNetPnlBRL).toBe(2000);
    });

    it("aplica fallback via netExternalCashFlowBRL com peso médio de meio de mês", () => {
      // 100.000 -> 106.000 com aporte líquido de 5.000 sem data exata (W = 0.5)
      // WeightedFlow = 2.500; Base = 102.500
      // Ganho = 106.000 - 100.000 - 5.000 = 1.000
      // Taxa = 1.000 / 102.500 = 0.9756... -> +0.98%
      const result = calculateMonthlyStatement({
        month: "2026-07",
        startBalanceBRL: 100000,
        endBalanceBRL: 106000,
        netExternalCashFlowBRL: 5000,
      });

      expect(result.monthNetContributionBRL).toBe(5000);
      expect(result.weightedCashFlowBRL).toBe(2500);
      expect(result.weightedCapitalBaseBRL).toBe(102500);
      expect(result.monthNetPnlBRL).toBe(1000);
      expect(result.monthRatePct).toBe(0.98);
    });

    it("recupera proventos das transações quando não houver tabela de dividendos separada", () => {
      const result = calculateMonthlyStatement({
        month: "2026-08",
        startBalanceBRL: 10000,
        endBalanceBRL: 10200,
        transactions: [
          { date: "2026-08-10", type: "dividend", total: 120 },
          { date: "2026-08-15", type: "jcp", total: 50 },
          { date: "2026-08-20", type: "fii_yield", total: 30 },
          { date: "2026-07-15", type: "dividend", total: 200 }, // outro mês
        ],
      });

      expect(result.monthDividendsBRL).toBe(200);
      expect(result.dividendsCount).toBe(3);
    });

    it("contabiliza compras e subscrições em monthBuysBRL e vendas em monthSellsBRL", () => {
      const result = calculateMonthlyStatement({
        month: "2026-09",
        startBalanceBRL: 50000,
        endBalanceBRL: 52000,
        transactions: [
          { date: "2026-09-02", type: "buy", quantity: 10, price: 50, total: 500 },
          { date: "2026-09-10", type: "subscription", quantity: 5, price: 100, total: 500 },
          { date: "2026-09-15", type: "sell", quantity: 8, price: 60, total: 480 },
          { date: "2026-09-20", type: "split", quantity: 2 },
        ],
      });

      expect(result.monthBuysBRL).toBe(1000);
      expect(result.monthSellsBRL).toBe(480);
      expect(result.transactionsCount).toBe(4);
    });

    it("protege contra colapso de denominador (resgates massivos que zeram o capital base)", () => {
      const result = calculateMonthlyStatement({
        month: "2026-10",
        startBalanceBRL: 10000,
        endBalanceBRL: 500,
        externalFlows: [
          { date: "2026-10-01", amount: -12000 },
        ],
      });

      // Capital base <= 0 -> taxa protegida em 0.00%
      expect(result.weightedCapitalBaseBRL).toBeLessThanOrEqual(0);
      expect(result.monthRatePct).toBe(0);
    });

    it("trata carteira recém-criada sem saldo anterior nem fluxos", () => {
      const result = calculateMonthlyStatement({
        month: "2026-01",
        startBalanceBRL: 0,
        endBalanceBRL: 0,
      });

      expect(result.monthRatePct).toBe(0);
      expect(result.monthNetPnlBRL).toBe(0);
      expect(result.monthNetContributionBRL).toBe(0);
      expect(result.monthDividendsBRL).toBe(0);
      expect(result.monthBuysBRL).toBe(0);
      expect(result.monthSellsBRL).toBe(0);
    });

    it("evita representação de zero negativo (-0 ou -0.00)", () => {
      const result = calculateMonthlyStatement({
        month: "2026-02",
        startBalanceBRL: 1000,
        endBalanceBRL: 1000,
      });

      expect(Object.is(result.monthRatePct, -0)).toBe(false);
      expect(Object.is(result.monthNetPnlBRL, -0)).toBe(false);
      expect(result.monthRatePct).toBe(0);
      expect(result.monthNetPnlBRL).toBe(0);
    });
  });
});
