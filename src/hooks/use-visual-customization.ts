import { useSyncExternalStore } from "react";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
  getActiveUserId,
} from "@/services/user-storage";
import type { UserCustomSettings } from "@/types";

export type AccentTheme = "teal" | "emerald" | "gold" | "sapphire" | "violet" | "rose" | "mono";
export type SurfaceStyle = "glass" | "flat" | "elevated";
export type MotionLevel = "fluid" | "eco" | "reduced";

export type SensoryIntent =
  | "selection"
  | "action"
  | "toggle"
  | "success"
  | "warning"
  | "destructive"
  | "error";

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
  accent: AccentTheme;
  surfaceStyle: SurfaceStyle;
  motionLevel: MotionLevel;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  disabledSensoryIntents: SensoryIntent[];
  numberTickerEnabled: boolean;
  dashboardWidgets: DashboardWidgetsConfig;
  headerButtons: HeaderButtonsConfig;
}

const STORAGE_KEYS = {
  accent: "accent_theme",
  surfaceStyle: "surface_style",
  motionLevel: "motion_level",
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
  accent: "teal",
  surfaceStyle: "glass",
  motionLevel: "fluid",
  soundEnabled: false,
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

    const soundEnabled = getUserStorageItem(STORAGE_KEYS.soundEnabled, userId) === "true";
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

    return {
      accent,
      surfaceStyle,
      motionLevel,
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

  const next: VisualCustomization = {
    ...currentConfig,
    ...partial,
    dashboardWidgets: partial.dashboardWidgets
      ? { ...currentConfig.dashboardWidgets, ...partial.dashboardWidgets }
      : currentConfig.dashboardWidgets,
    headerButtons: partial.headerButtons
      ? { ...currentConfig.headerButtons, ...partial.headerButtons }
      : currentConfig.headerButtons,
  };

  try {
    if (partial.accent !== undefined) {
      setUserStorageItem(STORAGE_KEYS.accent, next.accent, userId);
    }
    if (partial.surfaceStyle !== undefined) {
      setUserStorageItem(STORAGE_KEYS.surfaceStyle, next.surfaceStyle, userId);
    }
    if (partial.motionLevel !== undefined) {
      setUserStorageItem(STORAGE_KEYS.motionLevel, next.motionLevel, userId);
    }
    if (partial.soundEnabled !== undefined) {
      setUserStorageItem(STORAGE_KEYS.soundEnabled, String(next.soundEnabled), userId);
    }
    if (partial.hapticEnabled !== undefined) {
      setUserStorageItem(STORAGE_KEYS.hapticEnabled, String(next.hapticEnabled), userId);
    }
    if (partial.disabledSensoryIntents !== undefined) {
      setUserStorageItem(
        STORAGE_KEYS.disabledSensoryIntents,
        JSON.stringify(next.disabledSensoryIntents),
        userId,
      );
    }
    if (partial.numberTickerEnabled !== undefined) {
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
  if (customSettings.surfaceStyle) partial.surfaceStyle = customSettings.surfaceStyle;
  if (customSettings.motionLevel) partial.motionLevel = customSettings.motionLevel;
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

/** Hook reativo para leitura e alteração das preferências visuais do usuário */
export function useVisualCustomization() {
  const config = useSyncExternalStore(
    subscribeVisualCustomization,
    getVisualCustomization,
    () => DEFAULT_CONFIG,
  );

  return {
    ...config,
    setAccent: (accent: AccentTheme) => updateVisualCustomization({ accent }),
    setSurfaceStyle: (surfaceStyle: SurfaceStyle) => updateVisualCustomization({ surfaceStyle }),
    setMotionLevel: (motionLevel: MotionLevel) => updateVisualCustomization({ motionLevel }),
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
