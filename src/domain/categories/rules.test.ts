import { describe, expect, it } from "vitest";
import { normalizeCategoryKeyword, suggestCategory, suggestLimitCents } from "./rules";
import { CANONICAL_DEFAULT_CATEGORIES } from "./canonical";

describe("Regras de Categorias (domain/categories/rules.ts)", () => {
  it("normaliza palavras-chave removendo acentos e espaços", () => {
    expect(normalizeCategoryKeyword("  Alimentação  ")).toBe("alimentacao");
    expect(normalizeCategoryKeyword("Educação Infantil")).toBe("educacao infantil");
  });

  it("sugere ícone e cor por palavras-chave com sucesso", () => {
    const moradia = suggestCategory("Aluguel do Apartamento");
    expect(moradia).not.toBeNull();
    expect(moradia?.icon).toBe("moradia");
    expect(moradia?.limitPercent).toBe(30);

    const alimentacao = suggestCategory("Supermercado Mensal");
    expect(alimentacao?.icon).toBe("mercado");

    const pets = suggestCategory("Veterinário do Rex");
    expect(pets?.icon).toBe("pets");

    const desconhecido = suggestCategory("xyz123");
    expect(desconhecido).toBeNull();
  });

  it("sugere limite em centavos baseado na renda mensal arredondado a múltiplos de R$ 10", () => {
    // R$ 5.000,00 renda * 15% = R$ 750,00 (75000 centavos)
    expect(suggestLimitCents(500000, 15)).toBe(75000);

    // Mínimo R$ 10,00 (1000 centavos)
    expect(suggestLimitCents(1000, 10)).toBe(1000);

    // Renda zero ou percentual zero retorna 0
    expect(suggestLimitCents(0, 15)).toBe(0);
    expect(suggestLimitCents(500000, 0)).toBe(0);
  });

  it("possui 16 categorias canônicas padrão (12 despesas + 4 receitas)", () => {
    expect(CANONICAL_DEFAULT_CATEGORIES).toHaveLength(16);
    const expenses = CANONICAL_DEFAULT_CATEGORIES.filter((c) => c.type === "expense");
    const incomes = CANONICAL_DEFAULT_CATEGORIES.filter((c) => c.type === "income");
    expect(expenses).toHaveLength(12);
    expect(incomes).toHaveLength(4);
  });
});
