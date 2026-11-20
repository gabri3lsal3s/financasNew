import { useSyncExternalStore } from "react";
import { subscribeActiveUserId, getActiveUserId } from "@/services/user-storage";
import type { UserCustomSettings } from "@/types";
import {
  DEFAULT_CONFIG,
  DEFAULT_HEADER_BUTTONS,
  DEFAULT_WIDGETS,
  mergeVisualCustomization,
  normalizeCloudVisualPartial,
  type AccentTheme,
  type DashboardWidgetsConfig,
  type DensityLevel,
  type ExperiencePreset,
  type HeaderButtonsConfig,
  type MotionLevel,
  type SensoryIntent,
  type SurfaceStyle,
  type VisualCustomization,
} from "@/domain/preferences/visual-defaults";
import {
  applyVisualDomAttributes,
  readStoredVisualConfig,
  triggerThemeTransition,
  writeThemeCloudStorage,
  writeVisualStorageDiff,
} from "@/services/visual-storage";

export type {
  AccentTheme,
  SurfaceStyle,
  MotionLevel,
  DensityLevel,
  ExperiencePreset,
  SensoryIntent,
  DashboardWidgetsConfig,
  HeaderButtonsConfig,
  VisualCustomization,
};
export { DEFAULT_HEADER_BUTTONS, DEFAULT_WIDGETS, DEFAULT_CONFIG };

const listeners = new Set<() => void>();
let currentConfig: VisualCustomization = DEFAULT_CONFIG;
let isInitialized = false;

function subscribeVisualCustomization(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initVisualCustomization(userId?: string | null): VisualCustomization {
  if (typeof window !== "undefined") {
    currentConfig = readStoredVisualConfig(userId);
    applyVisualDomAttributes(currentConfig);
    isInitialized = true;
  }
  return currentConfig;
}

if (typeof window !== "undefined") {
  initVisualCustomization();
  subscribeActiveUserId((userId) => {
    resetVisualCustomization(userId);
  });
}

export function getVisualCustomization(): VisualCustomization {
  if (!isInitialized && typeof window !== "undefined") {
    return initVisualCustomization();
  }
  return currentConfig;
}

export function updateVisualCustomization(
  partial: Partial<VisualCustomization>,
  userId?: string | null,
): void {
  if (typeof window === "undefined") return;

  const next = mergeVisualCustomization(currentConfig, partial);
  writeVisualStorageDiff(currentConfig, next, partial, userId);

  currentConfig = next;
  applyVisualDomAttributes(next);
  listeners.forEach((listener) => listener());
}

/**
 * Sincroniza as configurações da nuvem (Supabase custom_settings) com a store local.
 */
export function syncVisualWithCloud(
  customSettings?: UserCustomSettings | null,
  userId?: string | null,
): void {
  if (!customSettings || typeof window === "undefined") return;

  const partial = normalizeCloudVisualPartial(customSettings);
  writeThemeCloudStorage(customSettings, userId);
  updateVisualCustomization(partial, userId);
}

export function resetVisualCustomization(userId?: string | null): void {
  const uid = userId !== undefined ? userId : getActiveUserId();
  currentConfig = uid ? readStoredVisualConfig(uid) : DEFAULT_CONFIG;
  if (uid && typeof window !== "undefined") {
    triggerThemeTransition(600);
  }
  applyVisualDomAttributes(currentConfig);
  listeners.forEach((listener) => listener());
}

/** Hook reativo para leitura e alteração das preferências visuais e sensoriais do usuário. */
export function useVisualCustomization() {
  const config = useSyncExternalStore(
    subscribeVisualCustomization,
    getVisualCustomization,
    () => DEFAULT_CONFIG,
  );

  return {
    ...config,
    setExperiencePreset: (preset: ExperiencePreset) =>
      updateVisualCustomization({ experiencePreset: preset }),
    setAccent: (accent: AccentTheme) => updateVisualCustomization({ accent }),
    setSurfaceStyle: (surfaceStyle: SurfaceStyle) => updateVisualCustomization({ surfaceStyle }),
    setMotionLevel: (motionLevel: MotionLevel) => updateVisualCustomization({ motionLevel }),
    setDensity: (density: DensityLevel) => updateVisualCustomization({ density }),
    setSoundEnabled: (soundEnabled: boolean) => {
      const shouldClearAllMuted =
        soundEnabled && currentConfig.disabledSensoryIntents.length >= 7;
      updateVisualCustomization({
        soundEnabled,
        ...(shouldClearAllMuted ? { disabledSensoryIntents: [] } : {}),
      });
    },
    setHapticEnabled: (hapticEnabled: boolean) => {
      const shouldClearAllMuted =
        hapticEnabled && currentConfig.disabledSensoryIntents.length >= 7;
      updateVisualCustomization({
        hapticEnabled,
        ...(shouldClearAllMuted ? { disabledSensoryIntents: [] } : {}),
      });
    },
    toggleSensoryIntent: (intent: SensoryIntent, enabled: boolean) => {
      const current = config.disabledSensoryIntents ?? [];
      const next = enabled
        ? current.filter((i) => i !== intent)
        : current.includes(intent)
          ? current
          : [...current, intent];
      updateVisualCustomization({ disabledSensoryIntents: next });
    },
    setDisabledSensoryIntents: (disabledSensoryIntents: SensoryIntent[]) =>
      updateVisualCustomization({ disabledSensoryIntents }),
    setNumberTickerEnabled: (numberTickerEnabled: boolean) =>
      updateVisualCustomization({ numberTickerEnabled }),
    setDashboardWidget: (widget: keyof DashboardWidgetsConfig, visible: boolean) =>
      updateVisualCustomization({
        dashboardWidgets: { ...config.dashboardWidgets, [widget]: visible },
      }),
    setHeaderButton: (button: keyof HeaderButtonsConfig, visible: boolean) =>
      updateVisualCustomization({
        headerButtons: { ...config.headerButtons, [button]: visible },
      }),
    resetToDefaults: () => updateVisualCustomization(DEFAULT_CONFIG),
  };
}
