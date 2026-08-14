/**
 * Feedback háptico tátil (F8 — Decisão 3).
 *
 * `navigator.vibrate` com padrões calibrados por intensidade; no-op quando
 * não suportado (desktop sem suporte, jsdom/testes). Nunca lança — vibração
 * é um enhancement, jamais um requisito de fluxo.
 */
export type HapticPattern = "light" | "medium" | "success" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: [10, 30, 10],
  success: [12, 40, 24],
  warning: [40, 60, 40],
};

export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Dispara a vibração do padrão informado. Retorna `true` se o dispositivo
 * aceitou a vibração (ou ela foi suportada); `false` em ambiente sem suporte.
 */
export function triggerHaptic(pattern: HapticPattern = "light"): boolean {
  if (!isHapticsSupported()) return false;
  try {
    return navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Navegadores podem lançar em contexto sem permissão — segue sem vibração.
    return false;
  }
}
