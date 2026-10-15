import { describe, expect, it } from "vitest";
import {
  redistributeProportionalBudget,
  redistributeProportionalBudgetByPercent,
} from "./proportional";

describe("redistributeProportionalBudget — Ajuste Proporcional com Restos de Centavos", () => {
  it("redistribui proporcionalmente por percentual mantendo exatidão de centavos", () => {
    const categories = [
      { categoryId: "c1", name: "Moradia", currentLimitCents: 100000 }, // R$ 1.000,00
      { categoryId: "c2", name: "Alimentação", currentLimitCents: 50000 }, // R$ 500,00
      { categoryId: "c3", name: "Transporte", currentLimitCents: 50000 }, // R$ 500,00
    ];

    // +10% -> Total de R$ 2.000,00 (200000 cents) vai para R$ 2.200,00 (220000 cents)
    const result = redistributeProportionalBudgetByPercent(categories, 10);

    expect(result.totalCurrentCents).toBe(200000);
    expect(result.totalNewCents).toBe(220000);
    expect(result.diffCents).toBe(20000);
    expect(result.deltaPercent).toBe(10);

    expect(result.items).toHaveLength(3);
    expect(result.items[0]?.newLimitCents).toBe(110000); // R$ 1.100,00 (+100,00)
    expect(result.items[1]?.newLimitCents).toBe(55000); // R$ 550,00 (+50,00)
    expect(result.items[2]?.newLimitCents).toBe(55000); // R$ 550,00 (+50,00)

    const sum = result.items.reduce((acc, i) => acc + i.newLimitCents, 0);
    expect(sum).toBe(220000);
  });

  it("distribui centavos residuais sem perda ou ganho em divisões não exatas", () => {
    const categories = [
      { categoryId: "c1", name: "A", currentLimitCents: 3333 },
      { categoryId: "c2", name: "B", currentLimitCents: 3333 },
      { categoryId: "c3", name: "C", currentLimitCents: 3334 },
    ];
    // Total atual: 10000 centavos (R$ 100,00)
    // Novo total pretendido: 11000 centavos (+10%)
    const result = redistributeProportionalBudget(categories, 11000);

    expect(result.totalCurrentCents).toBe(10000);
    expect(result.totalNewCents).toBe(11000);

    const sum = result.items.reduce((acc, i) => acc + i.newLimitCents, 0);
    expect(sum).toBe(11000);

    const diffSum = result.items.reduce((acc, i) => acc + i.diffCents, 0);
    expect(diffSum).toBe(1000);
  });

  it("reduz limites proporcionalmente para percentuais negativos sem ficar negativo", () => {
    const categories = [
      { categoryId: "c1", name: "Lazer", currentLimitCents: 40000 }, // R$ 400,00
      { categoryId: "c2", name: "Compras", currentLimitCents: 60000 }, // R$ 600,00
    ];
    // -20% -> Total de R$ 1.000,00 vai para R$ 800,00 (80000 cents)
    const result = redistributeProportionalBudgetByPercent(categories, -20);

    expect(result.totalNewCents).toBe(80000);
    expect(result.items[0]?.newLimitCents).toBe(32000); // R$ 320,00
    expect(result.items[1]?.newLimitCents).toBe(48000); // R$ 480,00
    expect(result.diffCents).toBe(-20000);

    const sum = result.items.reduce((acc, i) => acc + i.newLimitCents, 0);
    expect(sum).toBe(80000);
  });

  it("divide igualmente quando todas as categorias atuais estão zeradas", () => {
    const categories = [
      { categoryId: "c1", name: "A", currentLimitCents: 0 },
      { categoryId: "c2", name: "B", currentLimitCents: 0 },
      { categoryId: "c3", name: "C", currentLimitCents: 0 },
    ];
    // Alvo: R$ 100,00 = 10000 centavos
    const result = redistributeProportionalBudget(categories, 10000);

    expect(result.totalCurrentCents).toBe(0);
    expect(result.totalNewCents).toBe(10000);

    const sum = result.items.reduce((acc, i) => acc + i.newLimitCents, 0);
    expect(sum).toBe(10000);
    // 10000 / 3 = 3333 + 1 resto -> 3334, 3333, 3333
    expect(result.items[0]?.newLimitCents).toBe(3334);
    expect(result.items[1]?.newLimitCents).toBe(3333);
    expect(result.items[2]?.newLimitCents).toBe(3333);
  });

  it("trata lista vazia de categorias graciosamente", () => {
    const result = redistributeProportionalBudget([], 50000);
    expect(result.items).toHaveLength(0);
    expect(result.totalCurrentCents).toBe(0);
    expect(result.totalNewCents).toBe(50000);
  });

  it("trata redução a zero (-100%)", () => {
    const categories = [
      { categoryId: "c1", name: "A", currentLimitCents: 20000 },
      { categoryId: "c2", name: "B", currentLimitCents: 30000 },
    ];
    const result = redistributeProportionalBudgetByPercent(categories, -100);

    expect(result.totalNewCents).toBe(0);
    expect(result.items[0]?.newLimitCents).toBe(0);
    expect(result.items[1]?.newLimitCents).toBe(0);
  });
});
