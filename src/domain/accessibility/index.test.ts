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

/**
 * F11 DoD (fechado na F12) — contraste AA das 6 paletas de acento nos 3 temas.
 * Valores hex espelhando `tokens.css` (blocos `data-accent`). Regras:
 * 1. `primary-strong` sobre o fundo ≥ 4.5:1 — texto de botões/links (os botões
 *    pós-F10 são borda + texto colorido, sem fundo sólido);
 * 2. `primary-foreground` sobre `primary-strong` ≥ 4.5:1 — texto dos controles
 *    sólidos (Stepper/DatePicker selecionados);
 * 3. `primary` sobre o fundo ≥ 3:1 — não-texto (ring de foco, progresso,
 *    seleção, checkmark).
 * Ajustes da F12: emerald light primary 160 84 33 (#0D9B6C), gold light
 * primary 42 73 40 (#B0841C) + strong 38 92 30 (#935F06), violet dark/oled
 * 258 92 72 (#9D76F9). O ouro decorativo (--accent #DDA726) é exceção
 * documentada (glow/órbitas) — não é requisito de texto (teste acima).
 */
const ACCENTS = {
  teal: {
    light: { primary: "#2A9D90", strong: "#176E64" },
    dark: { primary: "#2BD4C0", strong: "#2BD4C0" },
    oled: { primary: "#2BD4C0", strong: "#2BD4C0" },
  },
  emerald: {
    light: { primary: "#0D9B6C", strong: "#047752" },
    dark: { primary: "#36D399", strong: "#36D399" },
    oled: { primary: "#36D399", strong: "#36D399" },
  },
  gold: {
    light: { primary: "#B0841C", strong: "#935F06" },
    dark: { primary: "#F3C353", strong: "#F3C353" },
    oled: { primary: "#F3C353", strong: "#F3C353" },
  },
  sapphire: {
    light: { primary: "#0369A0", strong: "#075783" },
    dark: { primary: "#0DA2E7", strong: "#0DA2E7" },
    oled: { primary: "#0DA2E7", strong: "#0DA2E7" },
  },
  violet: {
    light: { primary: "#7C3BED", strong: "#6B26D9" },
    dark: { primary: "#9D76F9", strong: "#9D76F9" },
    oled: { primary: "#9D76F9", strong: "#9D76F9" },
  },
  rose: {
    light: { primary: "#E21D48", strong: "#B51739" },
    dark: { primary: "#FB6F84", strong: "#FB6F84" },
    oled: { primary: "#FB6F84", strong: "#FB6F84" },
  },
  mono: {
    light: { primary: "#1F1F1F", strong: "#000000" },
    dark: { primary: "#F5F5F5", strong: "#FFFFFF" },
    oled: { primary: "#FAFAFA", strong: "#FFFFFF" },
  },
} as const;

/** Fundos e foregrounds dos 3 temas (mesmos dos PALETTES acima). */
const ACCENT_CONTEXT = {
  light: { background: "#F4F7F9", foreground: "#FFFFFF" },
  dark: { background: "#0C1923", foreground: "#022C22" },
  oled: { background: "#000000", foreground: "#022C22" },
} as const;

describe("contraste AA das 7 paletas de acento × 3 temas (F11 DoD — F12)", () => {
  for (const [accent, themes] of Object.entries(ACCENTS)) {
    describe(`acento ${accent}`, () => {
      for (const [theme, colors] of Object.entries(themes)) {
        const ctx = ACCENT_CONTEXT[theme as keyof typeof ACCENT_CONTEXT];
        const label = `no tema ${theme}`;

        it(`primary-strong é texto legível ${label} (≥ 4.5:1)`, () => {
          const ratio = contrastRatio(colors.strong, ctx.background);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });

        it(`primary-foreground sobre primary-strong ${label} (≥ 4.5:1)`, () => {
          const ratio = contrastRatio(ctx.foreground, colors.strong);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });

        it(`primary é não-texto perceptível ${label} (≥ 3:1)`, () => {
          const ratio = contrastRatio(colors.primary, ctx.background);
          expect(ratio).toBeGreaterThanOrEqual(3);
        });
      }
    });
  }
});
