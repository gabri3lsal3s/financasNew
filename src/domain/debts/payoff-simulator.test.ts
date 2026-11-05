import { describe, expect, it } from "vitest";
import {
  simulateDebtPayoff,
  compareDebtStrategies,
  type SimulatorDebtInput,
} from "./payoff-simulator";

describe("domain/debts/payoff-simulator (Avalanche vs Bola de Neve)", () => {
  const sampleDebts: SimulatorDebtInput[] = [
    {
      id: "card-high-interest",
      name: "Cartão de Crédito Rotativo",
      balanceCents: 500000, // R$ 5.000,00
      monthlyRatePercent: 12.0, // 12% a.m. (maior taxa)
      minPaymentCents: 20000, // R$ 200,00
    },
    {
      id: "personal-loan-small",
      name: "Empréstimo Rápido Amigo",
      balanceCents: 150000, // R$ 1.500,00 (menor saldo)
      monthlyRatePercent: 2.0, // 2% a.m.
      minPaymentCents: 10000, // R$ 100,00
    },
    {
      id: "financing-medium",
      name: "Financiamento Bancário",
      balanceCents: 1000000, // R$ 10.000,00
      monthlyRatePercent: 4.0, // 4% a.m.
      minPaymentCents: 30000, // R$ 300,00
    },
  ];

  it("retorna resultado zerado quando não há dívidas ativas", () => {
    const res = simulateDebtPayoff([], 50000, "avalanche");
    expect(res.totalMonths).toBe(0);
    expect(res.totalInterestCents).toBe(0);
    expect(res.totalPaidCents).toBe(0);
    expect(res.isFullyPaid).toBe(true);
  });

  it("prioriza dívida de menor saldo primeiro no método Bola de Neve", () => {
    const res = simulateDebtPayoff(sampleDebts, 100000, "snowball");
    expect(res.milestones.length).toBe(3);
    // Empréstimo Amigo tem o menor saldo (R$ 1.500,00)
    expect(res.milestones[0]?.debtId).toBe("personal-loan-small");
    expect(res.isFullyPaid).toBe(true);
  });

  it("prioriza dívida com maior taxa de juros primeiro no método Avalanche", () => {
    // Com aporte extra expressivo, o cartão (maior taxa 12%) recebe o fluxo extra
    const res = simulateDebtPayoff(
      [
        {
          id: "debt-high-rate",
          name: "Alta Taxa",
          balanceCents: 300000,
          monthlyRatePercent: 10.0,
          minPaymentCents: 10000,
        },
        {
          id: "debt-low-rate",
          name: "Baixa Taxa",
          balanceCents: 300000,
          monthlyRatePercent: 1.0,
          minPaymentCents: 10000,
        },
      ],
      100000,
      "avalanche",
    );
    expect(res.milestones.length).toBe(2);
    expect(res.milestones[0]?.debtId).toBe("debt-high-rate");
    expect(res.isFullyPaid).toBe(true);
  });

  it("avalanche resulta em menor ou igual total de juros pagos que bola de neve", () => {
    const comparison = compareDebtStrategies(sampleDebts, 50000);
    expect(comparison.avalanche.totalInterestCents).toBeLessThanOrEqual(
      comparison.snowball.totalInterestCents,
    );
    expect(comparison.interestSavedWithAvalancheCents).toBeGreaterThan(0);
    expect(comparison.recommendedStrategy).toBe("avalanche");
  });

  it("lida corretamente com aporte extra zero", () => {
    const simpleDebts: SimulatorDebtInput[] = [
      {
        id: "d1",
        name: "Dívida Simples",
        balanceCents: 30000,
        monthlyRatePercent: 1.0,
        minPaymentCents: 15000,
      },
    ];
    const res = simulateDebtPayoff(simpleDebts, 0, "snowball");
    expect(res.isFullyPaid).toBe(true);
    expect(res.totalMonths).toBeLessThanOrEqual(3);
  });
});
