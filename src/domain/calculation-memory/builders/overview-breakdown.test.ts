import { describe, expect, it } from "vitest";
import {
  buildInvestmentsOverviewBreakdown,
  buildMonthlyExpensesBreakdown,
  buildMonthlyIncomeBreakdown,
  buildOperatingBalanceBreakdown,
  buildSavingsRateBreakdown,
} from "./overview-breakdown";

describe("buildMonthlyIncomeBreakdown", () => {
  it("constrói a memória de cálculo para receitas sem ponderação", () => {
    const breakdown = buildMonthlyIncomeBreakdown({
      month: "2026-08",
      grossIncomeCents: 500000,
      weightedIncomeCents: 500000,
    });

    expect(breakdown.id).toBe("overview-income-2026-08");
    expect(breakdown.title).toBe("Receitas do Mês");
    expect(breakdown.steps).toHaveLength(1);
    expect(breakdown.result.rawValue).toBe(500000);
    expect(breakdown.inclusions).toContain(
      "Salários, pró-labores, honorários e benefícios recebidos",
    );
    expect(breakdown.exclusions).toContain(
      "Transferências entre contas bancárias do mesmo titular (neutras)",
    );
  });

  it("inclui passo de ajuste quando há diferença de ponderação familiar", () => {
    const breakdown = buildMonthlyIncomeBreakdown({
      month: "2026-08",
      grossIncomeCents: 600000,
      weightedIncomeCents: 300000,
    });

    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.steps[1]?.label).toBe("Ajuste de Ponderação / Rateio");
    expect(breakdown.steps[1]?.operator).toBe("-");
    expect(breakdown.steps[1]?.rawValue).toBe(300000);
    expect(breakdown.result.rawValue).toBe(300000);
  });
});

describe("buildMonthlyExpensesBreakdown", () => {
  it("constrói a memória de cálculo de despesas do mês", () => {
    const breakdown = buildMonthlyExpensesBreakdown({
      month: "2026-08",
      grossExpenseCents: 320000,
      weightedExpenseCents: 320000,
    });

    expect(breakdown.title).toBe("Despesas do Mês");
    expect(breakdown.steps).toHaveLength(1);
    expect(breakdown.result.rawValue).toBe(320000);
    expect(breakdown.exclusions).toContain(
      "Aportes e compras de investimentos (alocações de capital na carteira)",
    );
  });
});

describe("buildOperatingBalanceBreakdown", () => {
  it("constrói o resultado do mês superavitário", () => {
    const breakdown = buildOperatingBalanceBreakdown({
      month: "2026-08",
      incomeCents: 500000,
      expenseCents: 300000,
      operatingBalanceCents: 200000,
      investmentCents: 50000,
    });

    expect(breakdown.title).toBe("Resultado do Mês (Saldo Operacional)");
    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.result.label).toBe("Superávit do Mês");
    expect(breakdown.result.rawValue).toBe(200000);
    expect(breakdown.result.tone).toBe("positive");
  });

  it("constrói o resultado do mês deficitário", () => {
    const breakdown = buildOperatingBalanceBreakdown({
      month: "2026-08",
      incomeCents: 200000,
      expenseCents: 250000,
      operatingBalanceCents: -50000,
    });

    expect(breakdown.result.label).toBe("Déficit do Mês");
    expect(breakdown.result.rawValue).toBe(-50000);
    expect(breakdown.result.tone).toBe("negative");
  });
});

describe("buildSavingsRateBreakdown (Tratamento AUD-09 e AUD-04)", () => {
  it("calcula a taxa percentual de poupança normalmente para renda positiva", () => {
    const breakdown = buildSavingsRateBreakdown({
      month: "2026-08",
      incomeCents: 500000,
      expenseCents: 300000,
      savingsRatePercent: 40,
    });

    expect(breakdown.unit).toBe("percent");
    expect(breakdown.result.rawValue).toBe(40);
    expect(breakdown.result.tone).toBe("positive");
    expect(breakdown.formulaExpression).toContain("((Receitas − Despesas) ÷ Receitas) × 100%");
  });

  it("trata AUD-09 com transparência quando a renda do mês é zero", () => {
    const breakdown = buildSavingsRateBreakdown({
      month: "2026-08",
      incomeCents: 0,
      expenseCents: 150000,
      savingsRatePercent: 0,
    });

    expect(breakdown.result.rawValue).toBe(0);
    expect(breakdown.result.hint).toContain("Receitas nulas no mês");
    expect(breakdown.formulaExpression).toBe("Não aplicável sem receitas (0%)");
    expect(breakdown.notes?.[0]).toContain("Auditoria AUD-09");
  });

  it("trata taxa de poupança negativa em cenário de déficit", () => {
    const breakdown = buildSavingsRateBreakdown({
      month: "2026-08",
      incomeCents: 100000,
      expenseCents: 150000,
      savingsRatePercent: -50,
    });

    expect(breakdown.result.rawValue).toBe(-50);
    expect(breakdown.result.tone).toBe("negative");
    expect(breakdown.result.hint).toContain("Déficit");
  });
});

describe("buildInvestmentsOverviewBreakdown", () => {
  it("constrói a memória de cálculo de investimentos do mês", () => {
    const breakdown = buildInvestmentsOverviewBreakdown({
      month: "2026-08",
      investmentCents: 85000,
    });

    expect(breakdown.title).toBe("Investimentos do Mês");
    expect(breakdown.steps[0]?.rawValue).toBe(85000);
    expect(breakdown.result.rawValue).toBe(85000);
  });
});
