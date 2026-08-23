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
});
