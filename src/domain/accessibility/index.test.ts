import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, isAALargeText, isAANormalText, relativeLuminance } from "./index";

/** Cores documentadas no DESIGN_SYSTEM §2.3 (identidade "Guia Financeiro" — F10). */
const LIGHT = {
  background: "#F4F7F9",
  positive: "#2A9D8F",
  positiveStrong: "#1B6B62",
  negative: "#E76F51",
  accent: "#DDA726",
  accentForeground: "#142531",
  portfolio: "#1B3A4B",
};
const DARK = {
  background: "#0C1923",
  positive: "#2DD4BF",
  negative: "#FB7185",
  accent: "#F3C352",
  accentForeground: "#4A3605",
  portfolio: "#38BDF8",
};

describe("hexToRgb / relativeLuminance", () => {
  it("converte #RGB e #RRGGBB", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#2A9D8F")).toEqual({ r: 42, g: 157, b: 143 });
  });

  it("rejeita formatos inválidos", () => {
    expect(() => hexToRgb("zzz")).toThrow();
    expect(() => hexToRgb("#12345")).toThrow();
  });

  it("luminância: preto 0 e branco 1", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("razões canônicas (WCAG exemplos)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("é simétrico", () => {
    const a = contrastRatio("#2A9D8F", "#0C1923");
    const b = contrastRatio("#0C1923", "#2A9D8F");
    expect(a).toBeCloseTo(b, 10);
  });
});

describe("isAALargeText (3:1) — gráficos/badges/fills", () => {
  it("positive base no light serve para UI grande, mas não para texto normal", () => {
    // #2A9D8F sobre #F4F7F9 ≈ 3.0:1 — passa UI grande (3:1), falha texto (4.5:1)
    expect(isAANormalText(LIGHT.positive, LIGHT.background)).toBe(false);
    expect(isAALargeText(LIGHT.positive, LIGHT.background)).toBe(true);
    // -strong é a variante de texto (AA)
    expect(isAANormalText(LIGHT.positiveStrong, LIGHT.background)).toBe(true);
  });

  it("negative base no light é gráfico (coral suave); -strong cobre texto", () => {
    expect(isAANormalText(LIGHT.negative, LIGHT.background)).toBe(false);
    expect(isAANormalText("#B23A2A", LIGHT.background)).toBe(true);
  });

  it("dark/oled: positive claro passa AA para texto", () => {
    expect(isAANormalText(DARK.positive, DARK.background)).toBe(true);
    expect(isAALargeText(DARK.negative, DARK.background)).toBe(true);
  });
});

describe("ouro âmbar (accent) — F10", () => {
  it("light: ouro é acento gráfico (glow/órbitas); foreground sobre ouro passa AA", () => {
    // Ouro #DDA726 sobre o fundo claro é decorativo (não requisito de texto).
    expect(isAALargeText(LIGHT.accent, LIGHT.background)).toBe(false);
    // Texto do accent-foreground (#142531) sobre o ouro: AA normal.
    expect(isAANormalText(LIGHT.accentForeground, LIGHT.accent)).toBe(true);
  });

  it("dark: foreground escuro sobre dourado #F3C352 passa AA", () => {
    expect(isAANormalText(DARK.accentForeground, DARK.accent)).toBe(true);
  });
});

describe("investimentos (portfolio) — F10", () => {
  it("light: Sky Petróleo #1B3A4B tem contraste alto sobre o fundo", () => {
    expect(isAANormalText(LIGHT.portfolio, LIGHT.background)).toBe(true);
  });

  it("dark: #38BDF8 passa AA sobre o fundo Abissal", () => {
    expect(isAANormalText(DARK.portfolio, DARK.background)).toBe(true);
  });
});

/**
 * Contraste dos tokens dos 3 temas (DESIGN_SYSTEM §2.1/2.3).
 * Texto secundário (muted-foreground) sobre o fundo: AA 4.5:1.
 * Texto primário (foreground) sobre o fundo: AA 4.5:1.
 * Variantes -strong sobre o fundo: AA 4.5:1 (links/texto).
 */
const PALETTES = {
  light: {
    background: "#F4F7F9",
    foreground: "#142531",
    mutedForeground: "#475569",
    primaryStrong: "#1B6B62",
  },
  dark: {
    background: "#0C1923",
    foreground: "#E8F1F5",
    mutedForeground: "#9DB2C0",
    primaryStrong: "#2DD4BF",
  },
  oled: {
    background: "#000000",
    foreground: "#FAFAFA",
    mutedForeground: "#808080",
    primaryStrong: "#2DD4BF",
  },
} as const;

describe("contraste AA dos tokens (DESIGN_SYSTEM §2)", () => {
  for (const [theme, palette] of Object.entries(PALETTES)) {
    describe(`tema ${theme}`, () => {
      it("foreground sobre background ≥ 4.5:1", () => {
        expect(isAANormalText(palette.foreground, palette.background)).toBe(true);
      });

      it("muted-foreground sobre background ≥ 4.5:1", () => {
        const ratio = contrastRatio(palette.mutedForeground, palette.background);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("primary-strong sobre background ≥ 4.5:1 (links/texto)", () => {
        const ratio = contrastRatio(palette.primaryStrong, palette.background);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});
