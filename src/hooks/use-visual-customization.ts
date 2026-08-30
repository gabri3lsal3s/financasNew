import { useSyncExternalStore } from "react";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
  getActiveUserId,
} from "@/services/user-storage";
import type { UserCustomSettings } from "@/types";
import {
  type ExperiencePreset,
  type SensoryIntent,
  applyExperiencePreset,
  detectActivePreset,
} from "@/domain/preferences";

export type AccentTheme = "teal" | "emerald" | "gold" | "sapphire" | "violet" | "rose" | "mono";
export type SurfaceStyle = "glass" | "flat" | "elevated";
export type MotionLevel = "fluid" | "eco" | "reduced";
export type DensityLevel = "comfortable" | "compact";
export type { ExperiencePreset, SensoryIntent };

export interface DashboardWidgetsConfig {
  kpis: boolean;
  summary: boolean;
  flow: boolean;
  donut: boolean;
  budgets: boolean;
  contextBanners: boolean;
}

export interface HeaderButtonsConfig {
  logo: boolean;
  calculatorButton: boolean;
  themeToggle: boolean;
  privacyToggle: boolean;
}

export interface VisualCustomization {
  experiencePreset: ExperiencePreset;
  accent: AccentTheme;
  surfaceStyle: SurfaceStyle;
  motionLevel: MotionLevel;
  density: DensityLevel;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  disabledSensoryIntents: SensoryIntent[];
  numberTickerEnabled: boolean;
  dashboardWidgets: DashboardWidgetsConfig;
  headerButtons: HeaderButtonsConfig;
}

const STORAGE_KEYS = {
  experiencePreset: "experience_preset",
  accent: "accent_theme",
  surfaceStyle: "surface_style",
  motionLevel: "motion_level",
  density: "density_level",
  soundEnabled: "sound_enabled",
  hapticEnabled: "haptic_enabled",
  disabledSensoryIntents: "disabled_sensory_intents",
  numberTickerEnabled: "number_ticker_enabled",
  dashboardWidgets: "dashboard_widgets",
  headerButtons: "header_buttons",
} as const;

export const DEFAULT_HEADER_BUTTONS: HeaderButtonsConfig = {
  logo: true,
  calculatorButton: true,
  themeToggle: false,
  privacyToggle: false,
};

export const DEFAULT_WIDGETS: DashboardWidgetsConfig = {
  kpis: true,
  summary: true,
  flow: true,
  donut: true,
  budgets: true,
  contextBanners: true,
};

export const DEFAULT_CONFIG: VisualCustomization = {
  experiencePreset: "dynamic",
  accent: "teal",
  surfaceStyle: "glass",
  motionLevel: "fluid",
  density: "comfortable",
  soundEnabled: true,
  hapticEnabled: true,
  disabledSensoryIntents: [],
  numberTickerEnabled: true,
  dashboardWidgets: DEFAULT_WIDGETS,
  headerButtons: DEFAULT_HEADER_BUTTONS,
};

const listeners = new Set<() => void>();
let currentConfig: VisualCustomization = DEFAULT_CONFIG;
let isInitialized = false;

function applyDomAttributes(config: VisualCustomization): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (config.accent === "teal") {
    root.removeAttribute("data-accent");
  } else {
    root.setAttribute("data-accent", config.accent);
  }

  if (config.surfaceStyle === "glass") {
    root.removeAttribute("data-surface-style");
  } else {
    root.setAttribute("data-surface-style", config.surfaceStyle);
  }

  if (config.motionLevel === "reduced") {
    root.setAttribute("data-motion", "reduced");
  } else if (config.motionLevel === "eco") {
    root.setAttribute("data-motion", "eco");
  } else {
    root.removeAttribute("data-motion");
  }

  if (config.density === "compact") {
    root.setAttribute("data-density", "compact");
  } else {
    root.removeAttribute("data-density");
  }
}

function readStoredConfig(userId?: string | null): VisualCustomization {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const rawAccent = getUserStorageItem(STORAGE_KEYS.accent, userId) as AccentTheme | null;
    const accent: AccentTheme =
      rawAccent && ["teal", "emerald", "gold", "sapphire", "violet", "rose", "mono"].includes(rawAccent)
        ? rawAccent
        : "teal";

    const rawSurface = getUserStorageItem(STORAGE_KEYS.surfaceStyle, userId) as SurfaceStyle | null;
    const surfaceStyle: SurfaceStyle =
      rawSurface && ["glass", "flat", "elevated"].includes(rawSurface) ? rawSurface : "glass";

    const rawMotion = getUserStorageItem(STORAGE_KEYS.motionLevel, userId) as MotionLevel | null;
    const motionLevel: MotionLevel =
      rawMotion && ["fluid", "eco", "reduced"].includes(rawMotion) ? rawMotion : "fluid";

    const rawDensity = getUserStorageItem(STORAGE_KEYS.density, userId) as DensityLevel | null;
    const density: DensityLevel =
      rawDensity && ["comfortable", "compact"].includes(rawDensity) ? rawDensity : "comfortable";

    const soundRaw = getUserStorageItem(STORAGE_KEYS.soundEnabled, userId);
    const soundEnabled = soundRaw !== null ? soundRaw === "true" : true;

    const hapticRaw = getUserStorageItem(STORAGE_KEYS.hapticEnabled, userId);
    const hapticEnabled = hapticRaw !== null ? hapticRaw !== "false" : true;

    const tickerRaw = getUserStorageItem(STORAGE_KEYS.numberTickerEnabled, userId);
    const numberTickerEnabled = tickerRaw !== null ? tickerRaw !== "false" : true;

    let disabledSensoryIntents: SensoryIntent[] = [];
    const rawDisabled = getUserStorageItem(STORAGE_KEYS.disabledSensoryIntents, userId);
    if (rawDisabled) {
      try {
        const parsed = JSON.parse(rawDisabled);
        if (Array.isArray(parsed)) {
          const validIntents: SensoryIntent[] = [
            "selection",
            "action",
            "toggle",
            "success",
            "warning",
            "destructive",
            "error",
          ];
          disabledSensoryIntents = parsed.filter((item): item is SensoryIntent =>
            validIntents.includes(item),
          );
        }
      } catch {
        disabledSensoryIntents = [];
      }
    }

    let dashboardWidgets = DEFAULT_WIDGETS;
    const rawWidgets = getUserStorageItem(STORAGE_KEYS.dashboardWidgets, userId);
    if (rawWidgets) {
      try {
        dashboardWidgets = { ...DEFAULT_WIDGETS, ...JSON.parse(rawWidgets) };
      } catch {
        dashboardWidgets = DEFAULT_WIDGETS;
      }
    }

    let headerButtons = DEFAULT_HEADER_BUTTONS;
    const rawHeader = getUserStorageItem(STORAGE_KEYS.headerButtons, userId);
    if (rawHeader) {
      try {
        headerButtons = { ...DEFAULT_HEADER_BUTTONS, ...JSON.parse(rawHeader) };
      } catch {
        headerButtons = DEFAULT_HEADER_BUTTONS;
      }
    }

    const rawPreset = getUserStorageItem(STORAGE_KEYS.experiencePreset, userId) as ExperiencePreset | null;
    const experiencePreset: ExperiencePreset =
      rawPreset && ["dynamic", "minimal", "discreet", "custom"].includes(rawPreset)
        ? rawPreset
        : detectActivePreset({
            motionLevel,
            density,
            soundEnabled,
            hapticEnabled,
            numberTickerEnabled,
            disabledSensoryIntents,
          });

    return {
      experiencePreset,
      accent,
      surfaceStyle,
      motionLevel,
      density,
      soundEnabled,
      hapticEnabled,
      disabledSensoryIntents,
      numberTickerEnabled,
      dashboardWidgets,
      headerButtons,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function subscribeVisualCustomization(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initVisualCustomization(userId?: string | null): VisualCustomization {
  if (typeof window !== "undefined") {
    currentConfig = readStoredConfig(userId);
    applyDomAttributes(currentConfig);
    isInitialized = true;
  }
  return currentConfig;
}

// Inicializa no boot
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

  let next: VisualCustomization;

  if (partial.experiencePreset && partial.experiencePreset !== "custom") {
    const applied = applyExperiencePreset(partial.experiencePreset, {
      ...currentConfig,
      ...partial,
    });
    next = {
      ...applied,
      experiencePreset: partial.experiencePreset,
      dashboardWidgets: partial.dashboardWidgets
        ? { ...currentConfig.dashboardWidgets, ...partial.dashboardWidgets }
        : currentConfig.dashboardWidgets,
      headerButtons: partial.headerButtons
        ? { ...currentConfig.headerButtons, ...partial.headerButtons }
        : currentConfig.headerButtons,
    };
  } else {
    next = {
      ...currentConfig,
      ...partial,
      dashboardWidgets: partial.dashboardWidgets
        ? { ...currentConfig.dashboardWidgets, ...partial.dashboardWidgets }
        : currentConfig.dashboardWidgets,
      headerButtons: partial.headerButtons
        ? { ...currentConfig.headerButtons, ...partial.headerButtons }
        : currentConfig.headerButtons,
    };
    next.experiencePreset = partial.experiencePreset ?? detectActivePreset(next);
  }

  try {
    setUserStorageItem(STORAGE_KEYS.experiencePreset, next.experiencePreset, userId);
    if (partial.accent !== undefined || next.accent !== currentConfig.accent) {
      setUserStorageItem(STORAGE_KEYS.accent, next.accent, userId);
    }
    if (partial.surfaceStyle !== undefined || next.surfaceStyle !== currentConfig.surfaceStyle) {
      setUserStorageItem(STORAGE_KEYS.surfaceStyle, next.surfaceStyle, userId);
    }
    if (next.motionLevel !== currentConfig.motionLevel || partial.motionLevel !== undefined) {
      setUserStorageItem(STORAGE_KEYS.motionLevel, next.motionLevel, userId);
    }
    if (next.density !== currentConfig.density || partial.density !== undefined) {
      setUserStorageItem(STORAGE_KEYS.density, next.density, userId);
    }
    if (next.soundEnabled !== currentConfig.soundEnabled || partial.soundEnabled !== undefined) {
      setUserStorageItem(STORAGE_KEYS.soundEnabled, String(next.soundEnabled), userId);
    }
    if (next.hapticEnabled !== currentConfig.hapticEnabled || partial.hapticEnabled !== undefined) {
      setUserStorageItem(STORAGE_KEYS.hapticEnabled, String(next.hapticEnabled), userId);
    }
    if (
      next.disabledSensoryIntents !== currentConfig.disabledSensoryIntents ||
      partial.disabledSensoryIntents !== undefined
    ) {
      setUserStorageItem(
        STORAGE_KEYS.disabledSensoryIntents,
        JSON.stringify(next.disabledSensoryIntents),
        userId,
      );
    }
    if (
      next.numberTickerEnabled !== currentConfig.numberTickerEnabled ||
      partial.numberTickerEnabled !== undefined
    ) {
      setUserStorageItem(
        STORAGE_KEYS.numberTickerEnabled,
        String(next.numberTickerEnabled),
        userId,
      );
    }
    if (partial.dashboardWidgets !== undefined) {
      setUserStorageItem(
        STORAGE_KEYS.dashboardWidgets,
        JSON.stringify(next.dashboardWidgets),
        userId,
      );
    }
    if (partial.headerButtons !== undefined) {
      setUserStorageItem(
        STORAGE_KEYS.headerButtons,
        JSON.stringify(next.headerButtons),
        userId,
      );
    }
  } catch {
    // storage fallback
  }

  currentConfig = next;
  applyDomAttributes(next);
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

  const partial: Partial<VisualCustomization> = {};
  if (customSettings.experiencePreset) partial.experiencePreset = customSettings.experiencePreset;
  if (customSettings.surfaceStyle) partial.surfaceStyle = customSettings.surfaceStyle;
  if (customSettings.motionLevel) partial.motionLevel = customSettings.motionLevel;
  if (customSettings.density) partial.density = customSettings.density;
  if (customSettings.soundEnabled !== undefined) partial.soundEnabled = customSettings.soundEnabled;
  if (customSettings.hapticEnabled !== undefined) partial.hapticEnabled = customSettings.hapticEnabled;
  if (customSettings.numberTickerEnabled !== undefined) {
    partial.numberTickerEnabled = customSettings.numberTickerEnabled;
  }
  if (customSettings.disabledSensoryIntents) {
    partial.disabledSensoryIntents = customSettings.disabledSensoryIntents as SensoryIntent[];
  }
  if (customSettings.dashboardWidgets) {
    partial.dashboardWidgets = {
      ...DEFAULT_WIDGETS,
      ...customSettings.dashboardWidgets,
    };
  }
  if (customSettings.headerButtons) {
    partial.headerButtons = {
      ...DEFAULT_HEADER_BUTTONS,
      ...customSettings.headerButtons,
    };
  }

  updateVisualCustomization(partial, userId);
}

export function resetVisualCustomization(userId?: string | null): void {
  const uid = userId !== undefined ? userId : getActiveUserId();
  currentConfig = uid ? readStoredConfig(uid) : DEFAULT_CONFIG;
  applyDomAttributes(currentConfig);
  listeners.forEach((listener) => listener());
}

/** Hook reativo para leitura e alteração das preferências visuais e sensoriais do usuário */
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
    setSoundEnabled: (soundEnabled: boolean) => updateVisualCustomization({ soundEnabled }),
    setHapticEnabled: (hapticEnabled: boolean) => updateVisualCustomization({ hapticEnabled }),
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
