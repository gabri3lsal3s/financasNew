/**
 * Feedback háptico tátil (F8 — Decisão 3).
 *
 * `navigator.vibrate` com padrões calibrados por intensidade; no-op quando
 * não suportado (desktop sem suporte, jsdom/testes). Nunca lança — vibração
 * é um enhancement, jamais um requisito de fluxo.
 */
export type HapticPattern =
  | "light"
  | "medium"
  | "success"
  | "warning"
  | "destructive"
  | "error";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: [10, 30, 10],
  success: [12, 40, 24],
  warning: [30, 40, 30],
  destructive: [40, 60, 40],
  error: [50, 40, 50, 40],
};

export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

import { getVisualCustomization } from "@/hooks/use-visual-customization";

/**
 * Utilitário centralizado de controle de vibração (hapticsManager) com anti-concorrência e mute global.
 */
export class HapticsManager {
  private muted = false;
  private lastTriggerTime = 0;
  private readonly minIntervalMs = 60;

  public mute(): void {
    this.muted = true;
  }

  public unmute(): void {
    this.muted = false;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public isSupported(): boolean {
    return isHapticsSupported();
  }

  public reset(): void {
    this.muted = false;
    this.lastTriggerTime = 0;
  }

  public trigger(pattern: HapticPattern = "light", enabled?: boolean): boolean {
    if (this.muted || !this.isSupported()) return false;

    const isEnabled =
      enabled !== undefined
        ? enabled
        : typeof window !== "undefined"
          ? getVisualCustomization().hapticEnabled
          : false;

    if (!isEnabled) return false;

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const isUrgent =
      pattern === "warning" || pattern === "destructive" || pattern === "error" || pattern === "success";

    // Anti-concorrência: bloqueia disparos múltiplos quase simultâneos (< 60ms)
    if (!isUrgent && now - this.lastTriggerTime < this.minIntervalMs) {
      return false;
    }

    this.lastTriggerTime = now;

    try {
      return navigator.vibrate(PATTERNS[pattern]);
    } catch {
      // Navegadores podem lançar em contexto sem permissão — segue sem vibração.
      return false;
    }
  }
}

export const hapticsManager = new HapticsManager();

/**
 * Dispara a vibração do padrão informado. Retorna `true` se o dispositivo
 * aceitou a vibração (ou ela foi suportada); `false` em ambiente sem suporte
 * ou quando desabilitada.
 */
export function triggerHaptic(
  pattern: HapticPattern = "light",
  enabled?: boolean,
): boolean {
  return hapticsManager.trigger(pattern, enabled);
}
