import { describe, expect, it } from "vitest";
import {
  dailyBudget,
  spendingPace,
  endOfMonthProjection,
  pendingProjection,
  PACE_MIN_DAY,
  PROJECTION_MIN_DAY,
} from "./index";

describe("gasto disponível diário (§3.8)", () => {
  it("mês atual: diário = max(0, líquido ÷ diasRestantes incluindo hoje)", () => {
    // Rendas 5.000, invest 500, despesas 1.500 → líquido 3.000.
    // Dia 20 de 30 → diasRestantes 11 → diário = 3.000 ÷ 11 = 272 (floor).
    const result = dailyBudget({
      phase: "current",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 150_000,
      dayOfMonth: 20,
      daysInMonth: 30,
    });
    expect(result.monthlyNetCents).toBe(300_000);
    expect(result.daysRemaining).toBe(11);
    expect(result.dailyCents).toBe(Math.floor(300_000 / 11));
  });

  it("mês atual: último dia → diasRestantes = 1 (hoje incluído)", () => {
    const result = dailyBudget({
      phase: "current",
      incomesCents: 100_000,
      investmentsCents: 0,
      expensesCents: 90_000,
      dayOfMonth: 31,
      daysInMonth: 31,
    });
    expect(result.daysRemaining).toBe(1);
    expect(result.dailyCents).toBe(10_000);
  });

  it("mês atual: líquido negativo → diário zero", () => {
    const result = dailyBudget({
      phase: "current",
      incomesCents: 100_000,
      investmentsCents: 0,
      expensesCents: 200_000,
      dayOfMonth: 15,
      daysInMonth: 30,
    });
    expect(result.dailyCents).toBe(0);
  });

  it("mês futuro: diário = max(0, (rendas − invest) ÷ diasNoMês)", () => {
    const result = dailyBudget({
      phase: "future",
      incomesCents: 300_000,
      investmentsCents: 30_000,
      expensesCents: 0,
      daysInMonth: 30,
    });
    expect(result.dailyCents).toBe(9000); // 270.000 ÷ 30
    expect(result.daysRemaining).toBeNull();
  });

  it("mês encerrado: sem valor diário, apenas resultado real", () => {
    const result = dailyBudget({
      phase: "past",
      incomesCents: 300_000,
      investmentsCents: 30_000,
      expensesCents: 250_000,
      daysInMonth: 30,
    });
    expect(result.dailyCents).toBeNull();
    expect(result.daysRemaining).toBeNull();
    expect(result.monthlyNetCents).toBe(20_000);
  });
});

describe("ritmo de gastos (§3.8)", () => {
  it("inativo antes do 8º dia", () => {
    const pace = spendingPace({
      spentCents: 200_000,
      monthlyBudgetCents: 300_000,
      dayOfMonth: PACE_MIN_DAY - 1,
      daysInMonth: 30,
    });
    expect(pace.active).toBe(false);
  });

  it("inativo com fração decorrida < 30% mesmo após o 8º dia", () => {
    // Dia 8 de 31 → fração 25,8% < 30%.
    const pace = spendingPace({
      spentCents: 100_000,
      monthlyBudgetCents: 300_000,
      dayOfMonth: 8,
      daysInMonth: 31,
    });
    expect(pace.active).toBe(false);
  });

  it("ativo a partir do 8º dia com fração ≥ 30% e reporta gap", () => {
    // Dia 10 de 30 → 33,3%. Gasto 150.000 de 300.000 → 50% vs 33,3% → gap +16,67.
    const pace = spendingPace({
      spentCents: 150_000,
      monthlyBudgetCents: 300_000,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    expect(pace.active).toBe(true);
    expect(pace.spentPercent).toBeCloseTo(50, 2);
    expect(pace.elapsedPercent).toBeCloseTo(33.33, 1);
    expect(pace.ahead).toBe(true);
    expect(pace.gapPoints).toBeCloseTo(16.67, 1);
  });

  it("dentro do ritmo → ahead false", () => {
    const pace = spendingPace({
      spentCents: 90_000,
      monthlyBudgetCents: 300_000,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    expect(pace.active).toBe(true);
    expect(pace.ahead).toBe(false);
  });
});

describe("projeção de fim de mês (§3.8)", () => {
  it("mês atual: burnRate × diasNoMês, superávit e noTrilho", () => {
    // Dia 10, despesas 1.000 → burnRate 100/dia → projeção 3.000 (30 dias).
    // Rendas 5.000 − invest 500 − projeção 3.000 = superávit 1.500 → noTrilho.
    const result = endOfMonthProjection({
      phase: "current",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 100_000,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    expect(result.burnRateCents).toBe(10_000);
    expect(result.projectedExpensesCents).toBe(300_000);
    expect(result.surplusCents).toBe(150_000);
    expect(result.onTrack).toBe(true);
  });

  it("mês atual com dia < 3 → não aplicável", () => {
    const result = endOfMonthProjection({
      phase: "current",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 20_000,
      dayOfMonth: PROJECTION_MIN_DAY - 1,
      daysInMonth: 30,
    });
    expect(result.projectedExpensesCents).toBeNull();
    expect(result.surplusCents).toBeNull();
    expect(result.onTrack).toBeNull();
    expect(result.burnRateCents).toBeNull();
  });

  it("mês atual: ritmo alto → fora da trilha (superávit negativo)", () => {
    // Dia 10, despesas 2.000 → projeção 6.000 > disponível 4.500.
    const result = endOfMonthProjection({
      phase: "current",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 200_000,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    expect(result.projectedExpensesCents).toBe(600_000);
    expect(result.surplusCents).toBe(-150_000);
    expect(result.onTrack).toBe(false);
  });

  it("mês passado: valores reais, noTrilho = saldo real ≥ 0", () => {
    const ok = endOfMonthProjection({
      phase: "past",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 400_000,
      dayOfMonth: 30,
      daysInMonth: 30,
    });
    expect(ok.projectedExpensesCents).toBe(400_000);
    expect(ok.surplusCents).toBe(50_000);
    expect(ok.onTrack).toBe(true);
    expect(ok.burnRateCents).toBeNull();

    const bad = endOfMonthProjection({
      phase: "past",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 500_000,
      dayOfMonth: 30,
      daysInMonth: 30,
    });
    expect(bad.onTrack).toBe(false);
  });

  it("mês futuro: não aplicável", () => {
    const result = endOfMonthProjection({
      phase: "future",
      incomesCents: 500_000,
      investmentsCents: 50_000,
      expensesCents: 0,
      dayOfMonth: 1,
      daysInMonth: 30,
    });
    expect(result).toEqual({
      projectedExpensesCents: null,
      surplusCents: null,
      onTrack: null,
      burnRateCents: null,
    });
  });
});

describe("projeção de pendências (§3.8)", () => {
  it("saldo = recebíveis − pagáveis pendentes", () => {
    const result = pendingProjection([
      { id: "d1", kind: "payable", remainingCents: 100_000 },
      { id: "d2", kind: "receivable", remainingCents: 250_000 },
      { id: "d3", kind: "receivable", remainingCents: 50_000 },
    ]);
    expect(result.receivablesCents).toBe(300_000);
    expect(result.payablesCents).toBe(100_000);
    expect(result.balanceCents).toBe(200_000);
  });

  it("sem dívidas → tudo zero", () => {
    expect(pendingProjection([])).toEqual({
      receivablesCents: 0,
      payablesCents: 0,
      balanceCents: 0,
    });
  });
});
