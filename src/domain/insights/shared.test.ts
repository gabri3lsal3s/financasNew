import { describe, expect, it } from "vitest";
import {
  ESSENTIAL_CATEGORY_ICONS,
  matchesServiceKey,
  normalizeServiceKey,
  normalizeText,
  tokenizeText,
  valuesWithinTolerance,
} from "./shared";

describe("normalizeText — fonte única de normalização (F19)", () => {
  it("minúsculas, sem acentos, espaços colapsados", () => {
    expect(normalizeText("  Netflix  ")).toBe("netflix");
    expect(normalizeText("São Paulo")).toBe("sao paulo");
    expect(normalizeText("Amazon Prime")).toBe("amazon prime");
    expect(normalizeText("ÀÇÉ")).toBe("ace");
  });

  it("normalizeServiceKey remove não-alfanuméricos (catálogo)", () => {
    expect(normalizeServiceKey("Amazon Prime")).toBe("amazonprime");
    expect(normalizeServiceKey("Disney+")).toBe("disney");
    expect(normalizeServiceKey("iCloud Plus")).toBe("icloudplus");
  });
});

describe("valuesWithinTolerance — fonte única de tolerância (F19)", () => {
  it("todos os valores dentro de X% do primeiro", () => {
    expect(valuesWithinTolerance([1000, 1010, 990], 0.05)).toBe(true);
    expect(valuesWithinTolerance([1000, 1100], 0.05)).toBe(false);
    expect(valuesWithinTolerance([1000, 950, 1050], 0.1)).toBe(true);
  });

  it("menos de 2 valores ou base zero → false", () => {
    expect(valuesWithinTolerance([], 0.05)).toBe(false);
    expect(valuesWithinTolerance([1000], 0.05)).toBe(false);
    expect(valuesWithinTolerance([0, 10], 0.05)).toBe(false);
  });
});

describe("ESSENTIAL_CATEGORY_ICONS — fonte única de essencialidade (F19)", () => {
  it("é a união das essenciais com as agregadoras", () => {
    for (const icon of ["moradia", "saude", "educacao", "mercado", "supermercado", "combustivel", "transporte", "farmacia"]) {
      expect(ESSENTIAL_CATEGORY_ICONS.has(icon)).toBe(true);
    }
    expect(ESSENTIAL_CATEGORY_ICONS.has("lazer")).toBe(false);
    expect(ESSENTIAL_CATEGORY_ICONS.has("compras")).toBe(false);
  });
});

describe("tokenizeText e matchesServiceKey — prevenção de falsos positivos", () => {
  it("divide em tokens de palavras", () => {
    expect(tokenizeText("Maxxi Atacado")).toEqual(["maxxi", "atacado"]);
    expect(tokenizeText("HBO Max")).toEqual(["hbo", "max"]);
    expect(tokenizeText("Smart Fit - Mensalidade")).toEqual(["smart", "fit", "mensalidade"]);
  });

  it("previne falsos positivos para chaves curtas (<= 3 letras: max, oi, tim, sky)", () => {
    // Falsos positivos que antes ocorriam com substring:
    expect(matchesServiceKey("Maxxi Atacado", "max")).toBe(false);
    expect(matchesServiceKey("Farmácia São Maximiliano", "max")).toBe(false);
    expect(matchesServiceKey("Climamax", "max")).toBe(false);
    expect(matchesServiceKey("Biscoito Bauducco", "oi")).toBe(false);
    expect(matchesServiceKey("Estimativa de Custo", "tim")).toBe(false);

    // Casos legítimos com chave curta:
    expect(matchesServiceKey("HBO Max", "max")).toBe(true);
    expect(matchesServiceKey("Max", "max")).toBe(true);
    expect(matchesServiceKey("Fatura Oi Fibra", "oi")).toBe(true);
    expect(matchesServiceKey("TIM Celular", "tim")).toBe(true);
    expect(matchesServiceKey("Sky TV", "sky")).toBe(true);
  });

  it("reconhece marcas compostas e com espaços", () => {
    expect(matchesServiceKey("Smart Fit Mensalidade", "smartfit")).toBe(true);
    expect(matchesServiceKey("Sem Parar Pedagio", "semparar")).toBe(true);
    expect(matchesServiceKey("Disney Plus", "disneyplus")).toBe(true);
    expect(matchesServiceKey("Apple iCloud", "icloud")).toBe(true);
  });
});


