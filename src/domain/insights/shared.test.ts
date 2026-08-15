import { describe, expect, it } from "vitest";
import { ESSENTIAL_CATEGORY_ICONS, normalizeServiceKey, normalizeText, valuesWithinTolerance } from "./shared";

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
    // Essenciais (subscriptions) + agregadoras (recurrences) — as 3 listas
    // sobrepostas agora têm uma única fonte.
    for (const icon of ["moradia", "saude", "educacao", "mercado", "supermercado", "combustivel", "transporte", "farmacia"]) {
      expect(ESSENTIAL_CATEGORY_ICONS.has(icon)).toBe(true);
    }
    // Categorias discricionárias não estão na lista.
    expect(ESSENTIAL_CATEGORY_ICONS.has("lazer")).toBe(false);
    expect(ESSENTIAL_CATEGORY_ICONS.has("compras")).toBe(false);
  });
});
