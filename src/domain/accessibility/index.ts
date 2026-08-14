/**
 * Contraste de cores — WCAG 2.1 (funções puras, sem UI).
 * Regras de acessibilidade do DESIGN_SYSTEM §9: texto pequeno AA 4.5:1,
 * texto grande/UI AA 3:1. Usado para validar os tokens dos 3 temas.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Hex #RRGGBB ou #RGB → canais 0–255. Lança em formato inválido. */
export function hexToRgb(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return {
      r: parseInt(value[0]! + value[0]!, 16),
      g: parseInt(value[1]! + value[1]!, 16),
      b: parseInt(value[2]! + value[2]!, 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(value)) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }
  throw new Error(`Cor inválida: ${hex} — use #RGB ou #RRGGBB.`);
}

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminância relativa (WCAG 2.1 §1.4.3): 0 (preto) … 1 (branco). */
export function relativeLuminance(color: Rgb): number {
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

/** Razão de contraste entre duas cores (1 … 21). Ordem irrelevante. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const rgbA = typeof a === "string" ? hexToRgb(a) : a;
  const rgbB = typeof b === "string" ? hexToRgb(b) : b;
  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Contraste AA para texto normal (4.5:1). */
export function isAANormalText(a: Rgb | string, b: Rgb | string): boolean {
  return contrastRatio(a, b) >= 4.5;
}

/** Contraste AA para texto grande / componentes de UI (3:1). */
export function isAALargeText(a: Rgb | string, b: Rgb | string): boolean {
  return contrastRatio(a, b) >= 3;
}
