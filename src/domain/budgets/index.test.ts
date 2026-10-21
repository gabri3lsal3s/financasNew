import { describe, expect, it } from "vitest";
import {
  budgetLimitsByCategory,
  budgetStatus,
  exceededCents,
  globalUsedPercent,
  incomeGoalStatus,
  isExplicitZeroLimit,
  isInheritedLimit,
  progressTone,
  realizedByCategoryMap,
  reallocationSuggestion,
  resolveBudgetLimitDetails,
  resolveEffectiveLimit,
  spentByCategoryMap,
  spentGrossByCategoryMap,
  suggestCategory,
  suggestLimitCents,
} from "./index";


describe("suggestCategory (§3.5.1 — sugestão inteligente por nome)", () => {
  it("infere ícone/cor/% por palavra-chave", () => {
    expect(suggestCategory("Alimentação")).toMatchObject({ icon: "alimentacao", limitPercent: 15 });
    expect(suggestCategory("Moradia e contas")).toMatchObject({ icon: "moradia", limitPercent: 30 });
    expect(suggestCategory("Transporte")).toMatchObject({ icon: "transporte", limitPercent: 10 });
  });

  it("retorna null para nomes desconhecidos ou vazios", () => {
    expect(suggestCategory("")).toBeNull();
    expect(suggestCategory("   ")).toBeNull();
    expect(suggestCategory("Aleatório")).toBeNull();
  });

  it("é case-insensitive", () => {
    expect(suggestCategory("MERCADO")).toMatchObject({ icon: "mercado" });
  });
});

describe("suggestLimitCents (§3.5.2 — sugestão por % da renda)", () => {
  it("calcula o limite com arredondamento a R$ 10 (mínimo R$ 10)", () => {
    // Renda R$ 5.000 × 30% = R$ 1.500
    expect(suggestLimitCents(500000, 30)).toBe(150000);
    // Renda R$ 1.000 × 10% = R$ 100 → mínimo R$ 10
    expect(suggestLimitCents(100000, 10)).toBe(10000);
    // Renda R$ 500 × 5% = R$ 25 → arredonda para R$ 20
    expect(suggestLimitCents(50000, 5)).toBe(2000);
  });

  it("retorna 0 sem renda ou percentual", () => {
    expect(suggestLimitCents(0, 30)).toBe(0);
    expect(suggestLimitCents(500000, 0)).toBe(0);
  });
});

describe("faixas de atenção (§3.5.2 — 85/90/95/excedido)", () => {
  it("classifica cada faixa corretamente", () => {
    expect(budgetStatus(8499, 10000)).toBe("ok");
    expect(budgetStatus(8500, 10000)).toBe("attention");
    expect(budgetStatus(9000, 10000)).toBe("high");
    expect(budgetStatus(9500, 10000)).toBe("critical");
    expect(budgetStatus(10001, 10000)).toBe("exceeded");
  });

  it("excedido em centavos", () => {
    expect(exceededCents(12000, 10000)).toBe(2000);
    expect(exceededCents(9000, 10000)).toBe(0);
  });

  it("limite zero nunca excede", () => {
    expect(budgetStatus(5000, 0)).toBe("ok");
  });
});

describe("progressTone e globalUsedPercent (§3.5.2 — KPIs)", () => {
  it("cor de progresso: ≥85 crítico, ≥70 atenção, senão positivo", () => {
    expect(progressTone(90)).toBe("critical");
    expect(progressTone(75)).toBe("warning");
    expect(progressTone(50)).toBe("positive");
  });

  it("% global usado usa totalLimites como base", () => {
    expect(globalUsedPercent(150000, 300000, 1000000)).toBe(50);
  });

  it("fallback para rendas quando não há limites", () => {
    // Despesas 2.000 ÷ rendas 10.000 = 20%
    expect(globalUsedPercent(200000, 0, 1000000)).toBe(20);
  });

  it("nunca passa de 100% e trata base zero", () => {
    expect(globalUsedPercent(999999, 100, 0)).toBe(100);
    expect(globalUsedPercent(5000, 0, 0)).toBe(0);
  });
});

describe("herança de limite (§3.5.2)", () => {
  const limits = [
    { month: "2026-06", limitCents: 100000 },
    { month: "2026-08", limitCents: 120000 },
  ];

  it("usa o limite do próprio mês quando definido", () => {
    expect(resolveEffectiveLimit(limits, "2026-08")).toBe(120000);
  });

  it("herda o limite mais recente ANTERIOR (nunca o futuro)", () => {
    expect(resolveEffectiveLimit(limits, "2026-07")).toBe(100000);
  });

  it("sem anterior, retorna 0", () => {
    expect(resolveEffectiveLimit(limits, "2026-05")).toBe(0);
    expect(resolveEffectiveLimit([], "2026-07")).toBe(0);
  });

  it("isInheritedLimit marca herança", () => {
    expect(isInheritedLimit(limits, "2026-07")).toBe(true);
    expect(isInheritedLimit(limits, "2026-08")).toBe(false);
  });

  it("distingue zero explícito de ausência de limite no próprio mês", () => {
    const limitsWithExplicitZero = [
      { month: "2026-06", limitCents: 100000 },
      { month: "2026-07", limitCents: 0 }, // Categoria deliberadamente zerada
    ];

    // No mês com zero explícito, não herda o valor de junho
    expect(resolveEffectiveLimit(limitsWithExplicitZero, "2026-07")).toBe(0);
    expect(isInheritedLimit(limitsWithExplicitZero, "2026-07")).toBe(false);
    expect(isExplicitZeroLimit(limitsWithExplicitZero, "2026-07")).toBe(true);

    const details = resolveBudgetLimitDetails(limitsWithExplicitZero, "2026-07");
    expect(details).toEqual({
      limitCents: 0,
      type: "explicit",
      isExplicitZero: true,
      isInherited: false,
      hasLimit: true,
    });
  });

  it("não herda valor anterior obsoleto quando o mês imediatamente anterior foi zerado explicitamente", () => {
    const history = [
      { month: "2026-05", limitCents: 80000 },
      { month: "2026-06", limitCents: 0 }, // Categoria intencionalmente zerada em junho
    ];

    // Julho não tem registro, herda o limite mais recente (junho: 0), não o de maio (80.000)
    expect(resolveEffectiveLimit(history, "2026-07")).toBe(0);
    expect(isInheritedLimit(history, "2026-07")).toBe(true);

    const details = resolveBudgetLimitDetails(history, "2026-07");
    expect(details.limitCents).toBe(0);
    expect(details.isInherited).toBe(true);
    expect(details.type).toBe("inherited");
  });

  it("herda do mês anterior válido quando o mês atual possui ausência explícita (null)", () => {
    const historyWithNull = [
      { month: "2026-06", limitCents: 100000 },
      { month: "2026-07", limitCents: null },
    ];

    expect(resolveEffectiveLimit(historyWithNull, "2026-07")).toBe(100000);
    expect(isInheritedLimit(historyWithNull, "2026-07")).toBe(true);
  });

  it("identifica corretamente ausência total de limites (type = none, isInherited = false)", () => {
    expect(isInheritedLimit([], "2026-07")).toBe(false);
    expect(resolveBudgetLimitDetails([], "2026-07")).toEqual({
      limitCents: 0,
      type: "none",
      isExplicitZero: false,
      isInherited: false,
      hasLimit: false,
    });
  });
});

describe("reallocationSuggestion (§3.5.2)", () => {
  it("transfere do maior excesso para a maior folga (múltiplo de 10, min R$ 10)", () => {
    const suggestion = reallocationSuggestion([
      { categoryId: "a", limitCents: 100000, spentCents: 160000 }, // excesso 60.000
      { categoryId: "b", limitCents: 100000, spentCents: 30000 }, // folga 70.000
      { categoryId: "c", limitCents: 50000, spentCents: 10000 }, // folga 40.000
    ]);
    expect(suggestion).toEqual({ fromCategoryId: "b", toCategoryId: "a", amountCents: 60000 });
  });

  it("limita ao menor valor (folga menor que excesso), arredondado para baixo", () => {
    const suggestion = reallocationSuggestion([
      { categoryId: "a", limitCents: 100000, spentCents: 115000 }, // excesso 15.000
      { categoryId: "b", limitCents: 100000, spentCents: 89000 }, // folga 11.000
    ]);
    expect(suggestion).toEqual({ fromCategoryId: "b", toCategoryId: "a", amountCents: 11000 });
  });

  it("não sugere quando o valor transferido arredonda para menos de R$ 10", () => {
    const suggestion = reallocationSuggestion([
      { categoryId: "a", limitCents: 100000, spentCents: 100500 }, // excesso R$ 5
      { categoryId: "b", limitCents: 100000, spentCents: 99500 }, // folga R$ 5 → arredonda p/ 0
    ]);
    expect(suggestion).toBeNull();
  });

  it("não sugere quando não há excesso", () => {
    expect(
      reallocationSuggestion([
        { categoryId: "a", limitCents: 100000, spentCents: 50000 },
        { categoryId: "b", limitCents: 100000, spentCents: 30000 },
      ]),
    ).toBeNull();
  });
});

describe("budgetLimitsByCategory / spentByCategoryMap (F19 — helpers compartilhados)", () => {
  it("agrupa limites mensais por categoria convertendo para centavos", () => {
    const byCategory = budgetLimitsByCategory([
      { category_id: "a", month: "2026-06", limit: 1000 },
      { category_id: "a", month: "2026-08", limit: 1200 },
      { category_id: "b", month: "2026-08", limit: 500 },
    ]);
    expect(byCategory.get("a")).toEqual([
      { month: "2026-06", limitCents: 100000 },
      { month: "2026-08", limitCents: 120000 },
    ]);
    expect(byCategory.get("b")).toEqual([{ month: "2026-08", limitCents: 50000 }]);
  });

  it("soma os gastos ponderados por categoria", () => {
    const spent = spentByCategoryMap([
      { category_id: "a", value: 120, report_weight: 1 },
      { category_id: "a", value: 80, report_weight: 0.5 },
      { category_id: "b", value: 50, report_weight: 1 },
    ]);
    expect(spent.get("a")).toBe(16000); // 12.000 + 4.000
    expect(spent.get("b")).toBe(5000);
  });

  it("soma os gastos brutos por categoria sem ponderação", () => {
    const spent = spentGrossByCategoryMap([
      { category_id: "a", value: 120 },
      { category_id: "a", value: 80 },
      { category_id: "b", value: 50 },
    ]);
    expect(spent.get("a")).toBe(20000); // 12.000 + 8.000
    expect(spent.get("b")).toBe(5000);
  });

  it("soma as receitas realizadas ponderadas por categoria", () => {
    const realized = realizedByCategoryMap([
      { category_id: "salario", value: 5000, report_weight: 1 },
      { category_id: "freela", value: 2000, report_weight: 0.5 },
      { category_id: "salario", value: 1000, report_weight: 1 },
    ]);
    expect(realized.get("salario")).toBe(600000); // 5000 + 1000 = 6000 BRL = 600000 cents
    expect(realized.get("freela")).toBe(100000); // 2000 * 0.5 = 1000 BRL = 100000 cents
  });
});


describe("incomeGoalStatus (§3.5.3 — metas de renda)", () => {
  it("déficit quando realizado < esperado", () => {
    expect(incomeGoalStatus(80000, 100000)).toBe("deficit");
  });

  it("na meta / acima da meta", () => {
    expect(incomeGoalStatus(100000, 100000)).toBe("on_track");
    expect(incomeGoalStatus(120000, 100000)).toBe("surplus");
  });

  it("sem meta definida nunca fica em déficit", () => {
    expect(incomeGoalStatus(5000, 0)).toBe("on_track");
  });
});
