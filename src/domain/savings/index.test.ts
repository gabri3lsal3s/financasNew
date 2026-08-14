import { describe, expect, it } from "vitest";
import {
  dynamicMinLimitCents,
  buildChallengeOptions,
  pickTopChallenges,
  discretionaryChallenge,
  suggestIncrease,
  suggestReduction,
  buildLimitSuggestions,
  MIN_FLOOR_CENTS,
  MAX_ACTIVE_CHALLENGES,
  MAX_LIMIT_SUGGESTIONS,
} from "./index";

describe("limite mínimo dinâmico (§3.7.5)", () => {
  it("rende pouco → piso fixo de R$ 20", () => {
    expect(dynamicMinLimitCents(100_000)).toBe(MIN_FLOOR_CENTS); // 0,5% = R$ 0,50 < R$ 20
    expect(dynamicMinLimitCents(0)).toBe(MIN_FLOOR_CENTS);
  });

  it("renda alta → 0,5% da renda", () => {
    // R$ 10.000 × 0,5% = R$ 50
    expect(dynamicMinLimitCents(1_000_000)).toBe(5000);
  });

  it("nunca fica abaixo do piso fixo", () => {
    // R$ 3.000 × 0,5% = R$ 15 → piso R$ 20
    expect(dynamicMinLimitCents(300_000)).toBe(2000);
  });
});

const baseCategories = [
  { categoryId: "c1", name: "Restaurante", icon: "alimentacao", monthlyAvgCents: 80_000, essential: false },
  { categoryId: "c2", name: "Lazer", icon: "lazer", monthlyAvgCents: 60_000, essential: false },
  { categoryId: "c3", name: "Moradia", icon: "moradia", monthlyAvgCents: 300_000, essential: true },
];

describe("desafios de economia (§3.7.5)", () => {
  it("gera as 3 intensidades por categoria de alto gasto não essencial", () => {
    // Renda R$ 5.000 → alto gasto ≥ R$ 500. Restaurante (800) e Lazer (600) entram; Moradia não.
    const options = buildChallengeOptions(baseCategories, 500_000);
    expect(options).toHaveLength(6); // 2 categorias × 3 intensidades
    expect(options.map((o) => o.percent).sort()).toEqual([10, 10, 20, 20, 30, 30]);
  });

  it("meta respeita o limite mínimo dinâmico", () => {
    // Renda R$ 1.000 → piso = max(20, 5) = R$ 20 = 2.000¢.
    // Categoria com média R$ 300: 30% → R$ 210 ✓; com média R$ 25: 30% → R$ 17,50 < piso → descartada.
    const options = buildChallengeOptions(
      [
        { categoryId: "a", name: "A", icon: null, monthlyAvgCents: 30_000, essential: false },
        { categoryId: "b", name: "B", icon: null, monthlyAvgCents: 2500, essential: false },
      ],
      100_000,
    );
    expect(options.filter((o) => o.categoryId === "b")).toHaveLength(0);
    expect(options.filter((o) => o.categoryId === "a")).toHaveLength(3);
  });

  it("categoria essencial nunca vira desafio", () => {
    const options = buildChallengeOptions(baseCategories, 500_000);
    expect(options.some((o) => o.categoryId === "c3")).toBe(false);
  });

  it("categoria abaixo de 10% da renda não é alto gasto", () => {
    const options = buildChallengeOptions(
      [{ categoryId: "x", name: "X", icon: null, monthlyAvgCents: 40_000, essential: false }],
      500_000, // alto gasto ≥ R$ 500 → R$ 400 não entra
    );
    expect(options).toHaveLength(0);
  });

  it("pickTopChallenges: máx. 4, um por categoria, prioriza impacto", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      categoryId: `cat-${i}`,
      name: `Cat ${i}`,
      icon: null,
      monthlyAvgCents: (i + 1) * 50_000,
      essential: false,
    }));
    const options = buildChallengeOptions(many, 500_000);
    const top = pickTopChallenges(options);
    expect(top).toHaveLength(Math.min(MAX_ACTIVE_CHALLENGES, many.length));
    expect(new Set(top.map((t) => t.categoryId)).size).toBe(top.length);
    // As 4 maiores médias (cat-5..cat-2) → maior savings primeiro.
    expect(top[0]?.categoryId).toBe("cat-5");
    expect(top[3]?.categoryId).toBe("cat-2");
  });

  it("desafio '30% em não essenciais' soma só categorias de alto gasto", () => {
    const challenge = discretionaryChallenge(
      [
        { categoryId: "a", name: "A", icon: null, monthlyAvgCents: 80_000, essential: false },
        { categoryId: "b", name: "B", icon: null, monthlyAvgCents: 60_000, essential: false },
        { categoryId: "c", name: "C", icon: null, monthlyAvgCents: 40_000, essential: false },
        { categoryId: "d", name: "D", icon: null, monthlyAvgCents: 300_000, essential: true },
      ],
      500_000, // alto gasto ≥ R$ 500 → só A e B contam (800 + 600 = 1.400)
    );
    expect(challenge).not.toBeNull();
    expect(challenge!.totalAvgCents).toBe(140_000);
    expect(challenge!.targetCents).toBe(98_000);
    expect(challenge!.savingsCents).toBe(42_000);
  });

  it("desafio '30% em não essenciais' é null sem base de corte", () => {
    expect(discretionaryChallenge([], 500_000)).toBeNull();
    expect(
      discretionaryChallenge(
        [{ categoryId: "a", name: "A", icon: null, monthlyAvgCents: 10_000, essential: false }],
        500_000,
      ),
    ).toBeNull();
  });
});

describe("sugestões de limite (§3.7.5)", () => {
  it("aumento = max(excesso, 15% do limite) quando estourou", () => {
    // Limite R$ 1.000, gasto R$ 1.200 → excesso 200 > 15% (150) → novo 1.200
    expect(suggestIncrease(100_000, 120_000)).toBe(120_000);
    // Limite R$ 1.000, gasto R$ 1.050 → excesso 50 < 150 → novo 1.150
    expect(suggestIncrease(100_000, 105_000)).toBe(115_000);
  });

  it("sem estouro não há sugestão de aumento", () => {
    expect(suggestIncrease(100_000, 90_000)).toBeNull();
    expect(suggestIncrease(100_000, 100_000)).toBeNull();
  });

  it("redução mantém 30% de margem e arredonda para cima a R$ 10", () => {
    // Limite R$ 1.000, gasto R$ 400 (40% < 50%), folga 600 > 50 → novo = 400/0,7 = 571,43 → 580
    expect(suggestReduction(100_000, 40_000, 500_000)).toBe(58_000);
  });

  it("redução só quando folga > R$ 50 e uso < 50%", () => {
    // Folga 50 (limite 500, gasto 450) → não
    expect(suggestReduction(50_000, 45_000, 500_000)).toBeNull();
    // Uso 60% (limite 1.000, gasto 600) → não
    expect(suggestReduction(100_000, 60_000, 500_000)).toBeNull();
  });

  it("redução respeita o piso dinâmico", () => {
    // Renda R$ 1.000 → piso R$ 20. Limite R$ 100, gasto R$ 10 → 10/0,7 = 14,29 → 20 (piso)
    expect(suggestReduction(10_000, 1000, 100_000)).toBe(2000);
  });

  it("buildLimitSuggestions: máx. 3, prioriza por impacto", () => {
    const suggestions = buildLimitSuggestions(
      [
        { categoryId: "a", name: "A", icon: null, limitCents: 100_000, spentCents: 150_000 }, // +50.000
        { categoryId: "b", name: "B", icon: null, limitCents: 100_000, spentCents: 40_000 }, // −42.000
        { categoryId: "c", name: "C", icon: null, limitCents: 50_000, spentCents: 60_000 }, // +10.000
        { categoryId: "d", name: "D", icon: null, limitCents: 50_000, spentCents: 51_000 }, // +1.000
        { categoryId: "e", name: "E", icon: null, limitCents: 100_000, spentCents: 60_000 }, // sem folga > 50
      ],
      500_000,
    );
    expect(suggestions).toHaveLength(MAX_LIMIT_SUGGESTIONS);
    expect(suggestions.map((s) => s.kind)).toEqual(["increase", "reduce", "increase"]);
    expect(suggestions[0]?.categoryId).toBe("a");
    expect(suggestions[1]?.categoryId).toBe("b");
  });

  it("buildLimitSuggestions sem estouros nem folgas → vazio", () => {
    expect(buildLimitSuggestions([], 500_000)).toEqual([]);
    expect(
      buildLimitSuggestions(
        [{ categoryId: "a", name: "A", icon: null, limitCents: 100_000, spentCents: 70_000 }],
        500_000,
      ),
    ).toEqual([]);
  });
});
