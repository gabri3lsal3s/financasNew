import { describe, expect, it } from "vitest";
import { weightedCents, weightedSum } from "./index";

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
