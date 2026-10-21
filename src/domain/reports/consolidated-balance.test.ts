import { describe, expect, it } from "vitest";
import { computeConsolidatedBalanceSheet } from "./consolidated-balance";

describe("computeConsolidatedBalanceSheet", () => {
  it("deve calcular ativos, passivos, patrimônio líquido e DRE pessoal corretamente", () => {
    const result = computeConsolidatedBalanceSheet({
      investmentsMarketValueBRL: 80000,
      investmentsTotalCostBRL: 70000, // PnL = +10.000 (14.28%)
      cashBalanceBRL: 15000,
      debts: [
        { id: "1", type: "receivable", remainingAmountBRL: 5000, description: "Empréstimo a amigo" },
        { id: "2", type: "payable", remainingAmountBRL: 20000, description: "Financiamento de Carro" },
      ],
      monthlyIncomesBRL: 12000,
      monthlyExpensesBRL: 7000,
      monthlyContributionsBRL: 3000,
    });

    // Ativos = 80k (investimentos) + 15k (caixa) + 5k (recebíveis) = 100.000 BRL
    expect(result.totalAssetsBRL).toBe(100000);
    // Passivos = 20.000 BRL
    expect(result.totalLiabilitiesBRL).toBe(20000);
    // Patrimônio Líquido = 100k - 20k = 80.000 BRL
    expect(result.netWorthBRL).toBe(80000);
    // Alavancagem = 20k / 100k = 20%
    expect(result.debtToAssetRatioPct).toBe(20);

    // PnL Não Realizado = 10k (14.28%)
    expect(result.unrealizedPnlBRL).toBe(10000);
    expect(result.unrealizedPnlPct).toBeCloseTo(14.28, 1);

    // DRE Pessoal:
    // Poupança Operacional = 12k - 7k = 5.000 BRL (41.67%)
    expect(result.dre.operationalSavingsBRL).toBe(5000);
    expect(result.dre.savingsRatePct).toBeCloseTo(41.67, 1);
    // Fluxo Líquido = 5k poupança - 3k aporte = +2.000 BRL no caixa
    expect(result.dre.netCashFlowBRL).toBe(2000);
  });

  it("deve lidar com dados zerados sem falhas", () => {
    const result = computeConsolidatedBalanceSheet({
      investmentsMarketValueBRL: 0,
      investmentsTotalCostBRL: 0,
      cashBalanceBRL: 0,
      debts: [],
      monthlyIncomesBRL: 0,
      monthlyExpensesBRL: 0,
      monthlyContributionsBRL: 0,
    });

    expect(result.totalAssetsBRL).toBe(0);
    expect(result.netWorthBRL).toBe(0);
    expect(result.debtToAssetRatioPct).toBe(0);
    expect(result.dre.savingsRatePct).toBe(0);
  });

  it("elimina resíduos infinitesimais de ponto flutuante IEEE 754 em subtrações e somas decimais", () => {
    // 1000.1 - 800.05 em JS puro resulta em 200.04999999999995
    const result = computeConsolidatedBalanceSheet({
      investmentsMarketValueBRL: 1000.1,
      investmentsTotalCostBRL: 800.05,
      cashBalanceBRL: 0.1,
      debts: [
        { id: "1", type: "receivable", remainingAmountBRL: 0.2, description: "Recebível" },
        { id: "2", type: "payable", remainingAmountBRL: 100.05, description: "Dívida" },
      ],
      monthlyIncomesBRL: 500.1,
      monthlyExpensesBRL: 300.05,
      monthlyContributionsBRL: 100.02,
    });

    expect(result.unrealizedPnlBRL).toBe(200.05); // sem dízima
    expect(result.totalAssetsBRL).toBe(1000.4); // 1000.1 + 0.1 + 0.2
    expect(result.netWorthBRL).toBe(900.35); // 1000.4 - 100.05
    expect(result.dre.operationalSavingsBRL).toBe(200.05); // 500.1 - 300.05
    expect(result.dre.netCashFlowBRL).toBe(100.03); // 200.05 - 100.02
  });

  describe("Auditoria de Congruência Patrimonial e Classes de Passivos (§6.2)", () => {
    it("garante congruência estrita entre Ativos (Investimentos + Caixa + Recebíveis) e Passivos (Dívidas + Faturas)", () => {
      const result = computeConsolidatedBalanceSheet({
        investmentsMarketValueBRL: 150000,
        investmentsTotalCostBRL: 120000,
        cashBalanceBRL: 25000,
        debts: [
          { id: "d1", type: "payable", remainingAmountBRL: 30000, description: "Financiamento Imobiliário", category: "financing" },
          { id: "d2", type: "payable", remainingAmountBRL: 5000, description: "Empréstimo Pessoal", category: "loan" },
          { id: "d3", type: "payable", remainingAmountBRL: 2500, description: "Fatura Nubank", category: "invoice" },
          { id: "d4", type: "receivable", remainingAmountBRL: 10000, description: "Venda a prazo", category: "other" },
        ],
        creditCardInvoicesBRL: 3500, // Faturas diretas adicionais
        monthlyIncomesBRL: 18000,
        monthlyExpensesBRL: 11000,
        monthlyContributionsBRL: 5000,
      });

      // Ativos: 150k + 25k + 10k = 185.000 BRL
      expect(result.totalAssetsBRL).toBe(185000);
      expect(result.totalAssetsBRL).toBe(
        result.totalInvestmentsBRL + result.cashBalanceBRL + result.receivablesBRL,
      );

      // Passivos segregados:
      // Dívidas (Financiamento 30k + Empréstimo 5k) = 35.000 BRL
      expect(result.debtsPayableBRL).toBe(35000);
      // Faturas de Cartão (Fatura d3 2.5k + Faturas diretas 3.5k) = 6.000 BRL
      expect(result.creditCardInvoicesBRL).toBe(6000);
      // Passivo Total = 35k + 6k = 41.000 BRL
      expect(result.totalLiabilitiesBRL).toBe(41000);
      expect(result.totalLiabilitiesBRL).toBe(
        result.debtsPayableBRL + result.creditCardInvoicesBRL,
      );

      // Invariante Fundamental: Patrimônio Líquido = Ativos - Passivos
      expect(result.netWorthBRL).toBe(144000); // 185k - 41k
      expect(result.netWorthBRL).toBe(result.totalAssetsBRL - result.totalLiabilitiesBRL);

      // Alavancagem: 41k / 185k = 22.16%
      expect(result.debtToAssetRatioPct).toBeCloseTo(22.16, 2);
    });

    it("mantém congruência matemática em caso de passivo a descoberto (patrimônio líquido negativo)", () => {
      const result = computeConsolidatedBalanceSheet({
        investmentsMarketValueBRL: 10000,
        investmentsTotalCostBRL: 10000,
        cashBalanceBRL: 2000,
        debts: [
          { id: "d1", type: "payable", remainingAmountBRL: 40000, description: "Financiamento Estudantil" },
        ],
        creditCardInvoicesBRL: 5000,
        monthlyIncomesBRL: 4000,
        monthlyExpensesBRL: 3500,
        monthlyContributionsBRL: 0,
      });

      // Ativos: 10k + 2k = 12.000 BRL
      expect(result.totalAssetsBRL).toBe(12000);
      // Passivos: 40k dívida + 5k cartão = 45.000 BRL
      expect(result.totalLiabilitiesBRL).toBe(45000);
      // Patrimônio Líquido Real: 12k - 45k = -33.000 BRL (passivo a descoberto)
      expect(result.netWorthBRL).toBe(-33000);
      expect(result.netWorthBRL).toBe(result.totalAssetsBRL - result.totalLiabilitiesBRL);
      // Alavancagem > 100%: 45k / 12k = 375%
      expect(result.debtToAssetRatioPct).toBe(375);
    });

    it("audita DRE pessoal cobrindo superávit com sobra, consumo de caixa e déficit operacional", () => {
      // Caso 1: Superávit operacional com sobra de caixa
      const res1 = computeConsolidatedBalanceSheet({
        investmentsMarketValueBRL: 50000,
        investmentsTotalCostBRL: 50000,
        cashBalanceBRL: 10000,
        debts: [],
        monthlyIncomesBRL: 10000,
        monthlyExpensesBRL: 6000,
        monthlyContributionsBRL: 3000,
      });
      expect(res1.dre.operationalSavingsBRL).toBe(4000);
      expect(res1.dre.savingsRatePct).toBe(40);
      expect(res1.dre.netCashFlowBRL).toBe(1000); // Sobra 1k no caixa

      // Caso 2: Consumo de reserva de caixa quando aportes superam a poupança do mês
      const res2 = computeConsolidatedBalanceSheet({
        investmentsMarketValueBRL: 50000,
        investmentsTotalCostBRL: 50000,
        cashBalanceBRL: 10000,
        debts: [],
        monthlyIncomesBRL: 10000,
        monthlyExpensesBRL: 6000,
        monthlyContributionsBRL: 5000,
      });
      expect(res2.dre.operationalSavingsBRL).toBe(4000);
      expect(res2.dre.netCashFlowBRL).toBe(-1000); // Consumiu 1k do caixa acumulado

      // Caso 3: Déficit operacional (despesas > receitas)
      const res3 = computeConsolidatedBalanceSheet({
        investmentsMarketValueBRL: 50000,
        investmentsTotalCostBRL: 50000,
        cashBalanceBRL: 10000,
        debts: [],
        monthlyIncomesBRL: 5000,
        monthlyExpensesBRL: 7000,
        monthlyContributionsBRL: 0,
      });
      expect(res3.dre.operationalSavingsBRL).toBe(-2000);
      expect(res3.dre.savingsRatePct).toBe(-40);
      expect(res3.dre.netCashFlowBRL).toBe(-2000);
    });

    it("sanitiza valores espúrios e não-finitos (NaN, Infinity, negativos acidentais) preservando a integridade", () => {
      const result = computeConsolidatedBalanceSheet({
        investmentsMarketValueBRL: Number.NaN,
        investmentsTotalCostBRL: -500,
        cashBalanceBRL: 1000,
        debts: [
          { id: "d1", type: "payable", remainingAmountBRL: Number.POSITIVE_INFINITY, description: "Inválida" },
          { id: "d2", type: "payable", remainingAmountBRL: 500, description: "Válida" },
        ],
        creditCardInvoicesBRL: -200,
        monthlyIncomesBRL: Number.NaN,
        monthlyExpensesBRL: -100,
        monthlyContributionsBRL: Number.NaN,
      });

      expect(result.totalInvestmentsBRL).toBe(0);
      expect(result.totalCostBRL).toBe(0);
      expect(result.cashBalanceBRL).toBe(1000);
      expect(result.totalAssetsBRL).toBe(1000);
      expect(result.debtsPayableBRL).toBe(500);
      expect(result.creditCardInvoicesBRL).toBe(0);
      expect(result.totalLiabilitiesBRL).toBe(500);
      expect(result.netWorthBRL).toBe(500);
      expect(result.dre.grossIncomeBRL).toBe(0);
      expect(result.dre.totalExpensesBRL).toBe(0);
      expect(result.dre.operationalSavingsBRL).toBe(0);
      expect(result.dre.netCashFlowBRL).toBe(0);
    });
  });
});
