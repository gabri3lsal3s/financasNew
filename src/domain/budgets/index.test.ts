import { describe, expect, it } from "vitest";
import {
  budgetLimitsByCategory,
  budgetStatus,
  CANONICAL_DEFAULT_CATEGORIES,
  exceededCents,
  globalUsedPercent,
  incomeGoalStatus,
  isExplicitZeroLimit,
  isInheritedLimit,
  isValidReallocationAmount,
  progressTone,
  realizedByCategoryMap,
  reallocationSuggestion,
  REALLOCATION_MIN_CENTS,
  resolveBudgetLimitDetails,
  resolveEffectiveLimit,
  roundToReallocationMultiple,
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

describe("reallocationSuggestion & múltiplos de R$ 10 (§3.5.2 / Tarefa 4.4)", () => {
  describe("roundToReallocationMultiple & isValidReallocationAmount", () => {
    it("arredonda centavos para o múltiplo inferior de R$ 10 (1.000 centavos)", () => {
      expect(roundToReallocationMultiple(0)).toBe(0);
      expect(roundToReallocationMultiple(500)).toBe(0);
      expect(roundToReallocationMultiple(999)).toBe(0);
      expect(roundToReallocationMultiple(1000)).toBe(1000); // R$ 10,00
      expect(roundToReallocationMultiple(1001)).toBe(1000);
      expect(roundToReallocationMultiple(1999)).toBe(1000);
      expect(roundToReallocationMultiple(2000)).toBe(2000); // R$ 20,00
      expect(roundToReallocationMultiple(3847)).toBe(3000); // R$ 38,47 -> R$ 30,00
      expect(roundToReallocationMultiple(7312)).toBe(7000); // R$ 73,12 -> R$ 70,00
      expect(roundToReallocationMultiple(100000)).toBe(100000); // R$ 1.000,00
    });

    it("valida rigorosamente se um valor atende aos critérios de realocação (mínimo R$ 10 e múltiplo de 10)", () => {
      expect(isValidReallocationAmount(REALLOCATION_MIN_CENTS)).toBe(true); // R$ 10
      expect(isValidReallocationAmount(2000)).toBe(true); // R$ 20
      expect(isValidReallocationAmount(50000)).toBe(true); // R$ 500
      expect(isValidReallocationAmount(0)).toBe(false);
      expect(isValidReallocationAmount(-1000)).toBe(false);
      expect(isValidReallocationAmount(500)).toBe(false); // R$ 5 < R$ 10
      expect(isValidReallocationAmount(999)).toBe(false);
      expect(isValidReallocationAmount(1500)).toBe(false); // R$ 15 não é múltiplo de 10
      expect(isValidReallocationAmount(1001)).toBe(false);
      expect(isValidReallocationAmount(1000.5)).toBe(false); // não inteiro
    });
  });

  describe("reallocationSuggestion — invariantes e transferência", () => {
    it("transfere do maior excesso para a maior folga (múltiplo de 10, min R$ 10)", () => {
      const suggestion = reallocationSuggestion([
        { categoryId: "a", limitCents: 100000, spentCents: 160000 }, // excesso 60.000
        { categoryId: "b", limitCents: 100000, spentCents: 30000 }, // folga 70.000
        { categoryId: "c", limitCents: 50000, spentCents: 10000 }, // folga 40.000
      ]);
      expect(suggestion).toEqual({ fromCategoryId: "b", toCategoryId: "a", amountCents: 60000 });
      expect(isValidReallocationAmount(suggestion!.amountCents)).toBe(true);
    });

    it("limita ao menor valor (folga menor que excesso), arredondado para baixo", () => {
      const suggestion = reallocationSuggestion([
        { categoryId: "a", limitCents: 100000, spentCents: 115000 }, // excesso 15.000
        { categoryId: "b", limitCents: 100000, spentCents: 89000 }, // folga 11.000
      ]);
      expect(suggestion).toEqual({ fromCategoryId: "b", toCategoryId: "a", amountCents: 11000 });
      expect(isValidReallocationAmount(suggestion!.amountCents)).toBe(true);
    });

    it("arredonda para o múltiplo de R$ 10 inferior quando os valores de excesso/folga são quebrados", () => {
      // Excesso de R$ 38,47 (3.847 centavos) e folga de R$ 73,12 (7.312 centavos)
      // Menor valor: 3.847 centavos. Arredondamento p/ baixo em múltiplos de 10: 3.000 centavos (R$ 30,00).
      const suggestion = reallocationSuggestion([
        { categoryId: "cat-estouro", limitCents: 100000, spentCents: 103847 },
        { categoryId: "cat-folga", limitCents: 100000, spentCents: 92688 }, // folga 7.312 centavos
      ]);
      expect(suggestion).toEqual({
        fromCategoryId: "cat-folga",
        toCategoryId: "cat-estouro",
        amountCents: 3000, // Exatamente R$ 30,00
      });
      expect(suggestion?.amountCents).toBe(3000);
      expect(suggestion!.amountCents % 1000).toBe(0);
    });

    it("assegura a conservação estrita da soma total dos tetos orçamentários", () => {
      const rows = [
        { categoryId: "origem", limitCents: 150000, spentCents: 80000 }, // folga 70.000
        { categoryId: "destino", limitCents: 100000, spentCents: 145000 }, // excesso 45.000
      ];
      const initialTotalLimit = rows.reduce((acc, r) => acc + r.limitCents, 0);

      const suggestion = reallocationSuggestion(rows);
      expect(suggestion).not.toBeNull();
      const amount = suggestion!.amountCents; // 40.000 centavos (R$ 40,00)

      // Simula aplicação da realocação nos limites
      const newLimitOrigem = rows[0]!.limitCents - amount;
      const newLimitDestino = rows[1]!.limitCents + amount;
      const finalTotalLimit = newLimitOrigem + newLimitDestino;

      // Invariante 1: Soma total dos limites antes e depois é estritamente idêntica
      expect(finalTotalLimit).toBe(initialTotalLimit);

      // Invariante 2: Origem nunca fica com limite menor que o valor já gasto
      expect(newLimitOrigem).toBeGreaterThanOrEqual(rows[0]!.spentCents);

      // Invariante 3: Valor transferido é múltiplo inteiro de R$ 10 (1.000 centavos)
      expect(amount % 1000).toBe(0);
      expect(amount).toBeGreaterThanOrEqual(1000);
    });

    it("respeita exatamente a fronteira mínima de R$ 10,00 (1.000 centavos)", () => {
      // Exatamente R$ 10,00 de excesso e R$ 10,00 de folga
      const suggestion = reallocationSuggestion([
        { categoryId: "a", limitCents: 50000, spentCents: 51000 }, // excesso 1.000
        { categoryId: "b", limitCents: 50000, spentCents: 49000 }, // folga 1.000
      ]);
      expect(suggestion).toEqual({ fromCategoryId: "b", toCategoryId: "a", amountCents: 1000 });
    });

    it("não sugere quando o valor transferido arredonda para menos de R$ 10", () => {
      // Excesso R$ 9,99 (999 centavos) e folga R$ 50,00 -> arredonda para 0 -> null
      const suggestion1 = reallocationSuggestion([
        { categoryId: "a", limitCents: 100000, spentCents: 100999 },
        { categoryId: "b", limitCents: 100000, spentCents: 50000 },
      ]);
      expect(suggestion1).toBeNull();

      // Excesso R$ 50,00 e folga R$ 9,99 (999 centavos) -> arredonda para 0 -> null
      const suggestion2 = reallocationSuggestion([
        { categoryId: "a", limitCents: 100000, spentCents: 150000 },
        { categoryId: "b", limitCents: 100000, spentCents: 99001 },
      ]);
      expect(suggestion2).toBeNull();
    });

    it("prioriza corretamente a categoria com maior excesso e a categoria com maior folga", () => {
      const suggestion = reallocationSuggestion([
        { categoryId: "slack-menor", limitCents: 100000, spentCents: 70000 }, // folga 30.000
        { categoryId: "slack-maior", limitCents: 200000, spentCents: 100000 }, // folga 100.000
        { categoryId: "over-menor", limitCents: 100000, spentCents: 120000 }, // excesso 20.000
        { categoryId: "over-maior", limitCents: 100000, spentCents: 180000 }, // excesso 80.000
      ]);
      // Origem deve ser slack-maior (100.000 folga), Destino deve ser over-maior (80.000 excesso)
      // Transferência: min(80.000, 100.000) = 80.000 centavos
      expect(suggestion).toEqual({
        fromCategoryId: "slack-maior",
        toCategoryId: "over-maior",
        amountCents: 80000,
      });
    });

    it("retorna null quando não há excesso em nenhuma categoria", () => {
      expect(
        reallocationSuggestion([
          { categoryId: "a", limitCents: 100000, spentCents: 50000 },
          { categoryId: "b", limitCents: 100000, spentCents: 30000 },
        ]),
      ).toBeNull();
    });

    it("retorna null quando há apenas uma categoria ou lista vazia", () => {
      expect(reallocationSuggestion([])).toBeNull();
      expect(reallocationSuggestion([{ categoryId: "a", limitCents: 100000, spentCents: 150000 }])).toBeNull();
    });

    it("retorna null se a categoria de maior excesso coincidir com a de maior folga", () => {
      // Cenário impossível matematicamente, mas blindado para robustez
      expect(
        reallocationSuggestion([
          { categoryId: "same", limitCents: 100000, spentCents: 100000 },
        ]),
      ).toBeNull();
    });
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

describe("CANONICAL_DEFAULT_CATEGORIES (§4.1 / §4.4 — catálogo canônico)", () => {
  it("possui exatamente 11 categorias de partida padronizadas", () => {
    expect(CANONICAL_DEFAULT_CATEGORIES).toHaveLength(11);

    const expenses = CANONICAL_DEFAULT_CATEGORIES.filter((c) => c.type === "expense");
    const incomes = CANONICAL_DEFAULT_CATEGORIES.filter((c) => c.type === "income");

    expect(expenses).toHaveLength(8);
    expect(incomes).toHaveLength(3);
  });

  it("garante integridade de tipos, ícones e cores hexadecimais válidas", () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    for (const cat of CANONICAL_DEFAULT_CATEGORIES) {
      expect(cat.name.trim().length).toBeGreaterThan(0);
      expect(cat.icon.trim().length).toBeGreaterThan(0);
      expect(cat.color).toMatch(hexRegex);
      expect(["expense", "income"]).toContain(cat.type);
    }
  });

  it("casa perfeitamente todas as 8 despesas com o motor de sugestão inteligente (suggestCategory)", () => {
    const expenseCategories = CANONICAL_DEFAULT_CATEGORIES.filter((c) => c.type === "expense");

    for (const cat of expenseCategories) {
      const suggestion = suggestCategory(cat.name);
      expect(suggestion).not.toBeNull();
      expect(suggestion?.icon).toBe(cat.icon);
      expect(suggestion?.limitPercent).toBeGreaterThan(0);
    }
  });

  it("contém as categorias essenciais e as rendas canônicas esperadas", () => {
    const names = CANONICAL_DEFAULT_CATEGORIES.map((c) => c.name);
    expect(names).toContain("Alimentação");
    expect(names).toContain("Moradia");
    expect(names).toContain("Transporte");
    expect(names).toContain("Saúde");
    expect(names).toContain("Educação");
    expect(names).toContain("Lazer");
    expect(names).toContain("Compras");
    expect(names).toContain("Assinaturas");
    expect(names).toContain("Salário");
    expect(names).toContain("Investimentos");
    expect(names).toContain("Outras Rendas");
  });
});
