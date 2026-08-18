/**
 * Gateway central de feedback sensorial (Sound & Haptic Feedback).
 *
 * Unifica e padroniza microinterações táteis (vibratórias) e sonoras (Web Audio API)
 * de acordo com as preferências do usuário (soundEnabled / hapticEnabled) e níveis
 * de movimento (motionLevel).
 */

import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { playSound, type SoundEffect } from "./audio-fx";
import { triggerHaptic, type HapticPattern } from "./haptics";

export type SensoryIntent =
  | "selection"
  | "action"
  | "toggle"
  | "success"
  | "warning"
  | "destructive"
  | "error";

export interface SensoryOptions {
  skipSound?: boolean;
  skipHaptic?: boolean;
  volume?: number;
}

interface SensoryMapping {
  haptic: HapticPattern;
  sound: SoundEffect;
}

const SENSORY_MAP: Record<SensoryIntent, SensoryMapping> = {
  selection: { haptic: "light", sound: "click" },
  action: { haptic: "light", sound: "click" },
  toggle: { haptic: "light", sound: "pop" },
  success: { haptic: "success", sound: "success" },
  warning: { haptic: "warning", sound: "warning" },
  destructive: { haptic: "destructive", sound: "delete" },
  error: { haptic: "error", sound: "error" },
};

/**
 * Dispara feedback sensorial orquestrado (som e/ou vibração) conforme o nível
 * semântico da ação e as preferências ativas do usuário.
 */
export function triggerSensory(intent: SensoryIntent, options?: SensoryOptions): void {
  if (typeof window === "undefined") return;

  const visual = getVisualCustomization();
  const mapping = SENSORY_MAP[intent];

  // Disparo háptico respeitando a preferência global do usuário
  if (!options?.skipHaptic && visual.hapticEnabled) {
    triggerHaptic(mapping.haptic);
  }

  // Disparo sonoro respeitando a preferência global do usuário
  if (!options?.skipSound && visual.soundEnabled) {
    if (options?.volume !== undefined) {
      playSound(mapping.sound, true, options.volume);
    } else {
      playSound(mapping.sound, true);
    }
  }
}

/**
 * Utilitário ergonômico para chamadas semânticas diretas:
 * `sensory.success()`, `sensory.action()`, `sensory.destructive()`, etc.
 */
export const sensory = {
  selection: (options?: SensoryOptions) => triggerSensory("selection", options),
  action: (options?: SensoryOptions) => triggerSensory("action", options),
  toggle: (options?: SensoryOptions) => triggerSensory("toggle", options),
  success: (options?: SensoryOptions) => triggerSensory("success", options),
  warning: (options?: SensoryOptions) => triggerSensory("warning", options),
  destructive: (options?: SensoryOptions) => triggerSensory("destructive", options),
  error: (options?: SensoryOptions) => triggerSensory("error", options),
};
