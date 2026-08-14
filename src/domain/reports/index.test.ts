import { describe, expect, it } from "vitest";
import {
  weightedCents,
  weightedSum,
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByWeekday,
  mondayFirstWeekday,
  mergePaidDebts,
  validateCustomPeriod,
  percentChange,
  MAX_CUSTOM_PERIOD_DAYS,
  type ReportEntry,
} from "./index";

const entries: ReportEntry[] = [
  {
    id: "e1",
    date: "2026-08-03", // segunda
    kind: "expense",
    categoryId: "c1",
    categoryName: "Alimentação",
    categoryIcon: "alimentacao",
    paymentMethod: "pix",
    baseCents: 10_000,
    weight: 1,
  },
  {
    id: "e2",
    date: "2026-08-04", // terça
    kind: "expense",
    categoryId: "c1",
    categoryName: "Alimentação",
    categoryIcon: "alimentacao",
    paymentMethod: "credit_card",
    baseCents: 20_000,
    weight: 0.5, // R$ 100 no relatório
  },
  {
    id: "e3",
    date: "2026-08-08", // sábado
    kind: "expense",
    categoryId: "c2",
    categoryName: "Lazer",
    categoryIcon: "lazer",
    paymentMethod: "credit_card",
    baseCents: 30_000,
    weight: 1,
  },
];

describe("weightedCents (peso de relatório 0–1)", () => {
  it("aplica o peso ao valor base", () => {
    expect(weightedCents(10000, 1)).toBe(10000);
    expect(weightedCents(10000, 0.5)).toBe(5000);
    expect(weightedCents(10000, 0)).toBe(0);
  });

  it("arredonda para o centavo mais próximo", () => {
    expect(weightedCents(100, 1 / 3)).toBe(33);
  });

  it("rejeita peso fora de 0–1", () => {
    expect(() => weightedCents(100, 1.1)).toThrow();
    expect(() => weightedCents(100, -0.1)).toThrow();
  });
});

describe("weightedSum", () => {
  it("soma os valores ponderados", () => {
    const sum = weightedSum([
      { baseCents: 10000, weight: 1 },
      { baseCents: 5000, weight: 0.5 },
    ]);
    expect(sum).toBe(12500);
  });
});

describe("aggregateByCategory (§3.6)", () => {
  it("soma ponderada por categoria, ordenada por total desc", () => {
    const totals = aggregateByCategory(entries);
    expect(totals).toHaveLength(2);
    expect(totals[0]).toEqual({
      categoryId: "c2",
      name: "Lazer",
      icon: "lazer",
      totalCents: 30_000,
    });
    expect(totals[1]).toEqual({
      categoryId: "c1",
      name: "Alimentação",
      icon: "alimentacao",
      totalCents: 20_000, // 10.000 + 10.000 (20.000 × 0,5)
    });
  });
});

describe("aggregateByPaymentMethod (§3.6)", () => {
  it("agrupa por forma de pagamento com peso aplicado", () => {
    const totals = aggregateByPaymentMethod(entries);
    expect(totals).toHaveLength(2);
    expect(totals[0]).toEqual({ method: "credit_card", totalCents: 40_000 }); // 10.000 + 30.000
    expect(totals[1]).toEqual({ method: "pix", totalCents: 10_000 });
  });

  it("sem forma declarada cai em 'other'", () => {
    const totals = aggregateByPaymentMethod([
      { ...entries[0]!, paymentMethod: null },
    ]);
    expect(totals).toEqual([{ method: "other", totalCents: 10_000 }]);
  });
});

describe("aggregateByWeekday (§3.6/§4.1 — Monday-first)", () => {
  it("2026-08-03 é segunda (0) e 2026-08-08 é sábado (5)", () => {
    expect(mondayFirstWeekday("2026-08-03")).toBe(0);
    expect(mondayFirstWeekday("2026-08-08")).toBe(5);
  });

  it("retorna os 7 dias sempre presentes, com totais ponderados", () => {
    const totals = aggregateByWeekday(entries);
    expect(totals).toHaveLength(7);
    expect(totals[0]?.label).toBe("Segunda");
    expect(totals[0]?.totalCents).toBe(10_000);
    expect(totals[1]?.totalCents).toBe(10_000); // terça (e2 com peso 0,5)
    expect(totals[5]?.totalCents).toBe(30_000); // sábado
    expect(totals[6]?.totalCents).toBe(0); // domingo sem movimento
  });
});

describe("mergePaidDebts (§4.3)", () => {
  it("recebíveis somam às rendas; pagáveis às despesas; saldo recalculado", () => {
    const merged = mergePaidDebts(
      300_000, // rendas
      150_000, // despesas
      50_000, // investimentos
      [
        { kind: "receivable", valueCents: 20_000 },
        { kind: "payable", valueCents: 10_000 },
      ],
    );
    expect(merged.incomeCents).toBe(320_000);
    expect(merged.expenseCents).toBe(160_000);
    expect(merged.balanceCents).toBe(110_000); // 320 − 160 − 50
  });

  it("sem dívidas pagas mantém os totais", () => {
    const merged = mergePaidDebts(300_000, 150_000, 50_000, []);
    expect(merged).toEqual({ incomeCents: 300_000, expenseCents: 150_000, balanceCents: 100_000 });
  });
});

describe("validateCustomPeriod (§3.6 — máx. 366 dias)", () => {
  it("período válido com contagem de dias inclusiva", () => {
    const result = validateCustomPeriod("2026-08-01", "2026-08-10");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.period.days).toBe(10);
  });

  it("rejeita início maior que o fim", () => {
    const result = validateCustomPeriod("2026-08-10", "2026-08-01");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Início");
  });

  it(`rejeita períodos acima de ${MAX_CUSTOM_PERIOD_DAYS} dias`, () => {
    const result = validateCustomPeriod("2025-01-01", "2026-12-31"); // 730 dias
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("366");
  });

  it("aceita exatamente 366 dias", () => {
    const result = validateCustomPeriod("2025-01-01", "2026-01-01"); // 366 dias inclusive
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.period.days).toBe(366);
  });

  it("rejeita datas inválidas", () => {
    const result = validateCustomPeriod("invalida", "2026-08-01");
    expect(result.ok).toBe(false);
  });
});

describe("percentChange (comparativo — reexportado do overview)", () => {
  it("variação percentual com sinal correto", () => {
    expect(percentChange(120_000, 100_000)).toBe(20);
    expect(percentChange(80_000, 100_000)).toBe(-20);
    expect(percentChange(5_000, 0)).toBeNull();
  });
});
