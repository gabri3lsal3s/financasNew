import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, isAALargeText, isAANormalText, relativeLuminance } from "./index";

/** Cores documentadas no DESIGN_SYSTEM §2.3 (light). */
const LIGHT = { background: "#FAFAF9", positive: "#10B981", positiveStrong: "#047857", negative: "#F43F5E" };
const DARK = { background: "#0F172A", positive: "#34D399", negative: "#FB7185" };

describe("hexToRgb / relativeLuminance", () => {
  it("converte #RGB e #RRGGBB", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#10B981")).toEqual({ r: 16, g: 185, b: 129 });
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
    const a = contrastRatio("#10B981", "#0F172A");
    const b = contrastRatio("#0F172A", "#10B981");
    expect(a).toBeCloseTo(b, 10);
  });
});

describe("isAALargeText (3:1) — gráficos/badges/fills", () => {
  it("positive base no light não serve para texto, mas serve para UI grande", () => {
    // #10B981 sobre #FAFAF9 ≈ 2.4:1 — abaixo de 4.5:1 (por isso existe -strong)
    expect(isAANormalText(LIGHT.positive, LIGHT.background)).toBe(false);
    expect(isAALargeText(LIGHT.positive, LIGHT.background)).toBe(false);
    // -strong é a variante de texto (AA)
    expect(isAANormalText(LIGHT.positiveStrong, LIGHT.background)).toBe(true);
  });

  it("dark/oled: positive claro passa AA para texto", () => {
    expect(isAANormalText(DARK.positive, DARK.background)).toBe(true);
    expect(isAALargeText(DARK.negative, DARK.background)).toBe(true);
  });
});

/**
 * Contraste dos tokens dos 3 temas (DESIGN_SYSTEM §2.1/2.3).
 * Texto secundário (muted-foreground) sobre o fundo: AA 4.5:1.
 * Texto primário (foreground) sobre o fundo: AA 4.5:1.
 */
const PALETTES = {
  light: {
    background: "#FAFAF9",
    foreground: "#1C1917",
    mutedForeground: "#57534E",
    primaryStrong: "#047857",
  },
  dark: {
    background: "#0F172A",
    foreground: "#F8FAFC",
    mutedForeground: "#94A3B8",
    primaryStrong: "#34D399",
  },
  oled: {
    background: "#000000",
    foreground: "#FAFAFA",
    mutedForeground: "#808080",
    primaryStrong: "#34D399",
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
