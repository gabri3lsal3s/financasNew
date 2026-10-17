import { useMemo } from "react";
import { triggerSensory, type SensoryIntent, type SensoryOptions } from "@/services/sensory";

export interface SensoryDispatcher {
  trigger: (intent: SensoryIntent, options?: SensoryOptions) => void;
  selection: (options?: SensoryOptions) => void;
  action: (options?: SensoryOptions) => void;
  toggle: (options?: SensoryOptions) => void;
  success: (options?: SensoryOptions) => void;
  warning: (options?: SensoryOptions) => void;
  destructive: (options?: SensoryOptions) => void;
  error: (options?: SensoryOptions) => void;
}

/**
 * Hook ergonômico para despacho de microinterações sensoriais padronizadas (Haptics & Som).
 * Conforme a Regra 17 do AGENTS.md, centraliza todas as ações via Gateway Sensorial.
 */
export function useSensory(): SensoryDispatcher {
  return useMemo(
    () => ({
      trigger: (intent: SensoryIntent, options?: SensoryOptions) => triggerSensory(intent, options),
      selection: (options?: SensoryOptions) => triggerSensory("selection", options),
      action: (options?: SensoryOptions) => triggerSensory("action", options),
      toggle: (options?: SensoryOptions) => triggerSensory("toggle", options),
      success: (options?: SensoryOptions) => triggerSensory("success", options),
      warning: (options?: SensoryOptions) => triggerSensory("warning", options),
      destructive: (options?: SensoryOptions) => triggerSensory("destructive", options),
      error: (options?: SensoryOptions) => triggerSensory("error", options),
    }),
    [],
  );
}
