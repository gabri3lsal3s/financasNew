import { useSyncExternalStore } from "react";

export type AccentTheme = "teal" | "emerald" | "gold" | "sapphire" | "violet" | "rose";
export type SurfaceStyle = "glass" | "flat" | "elevated";
export type MotionLevel = "fluid" | "eco" | "reduced";

export interface DashboardWidgetsConfig {
  kpis: boolean;
  pace: boolean;
  invoices: boolean;
  anomalies: boolean;
  flow: boolean;
  donut: boolean;
  savingsHealth: boolean;
  budgets: boolean;
}

export interface VisualCustomization {
  accent: AccentTheme;
  surfaceStyle: SurfaceStyle;
  motionLevel: MotionLevel;
  soundEnabled: boolean;
  numberTickerEnabled: boolean;
  dashboardWidgets: DashboardWidgetsConfig;
}

const STORAGE_KEYS = {
  accent: "financas_accent_theme",
  surfaceStyle: "financas_surface_style",
  motionLevel: "financas_motion_level",
  soundEnabled: "financas_sound_enabled",
  numberTickerEnabled: "financas_number_ticker_enabled",
  dashboardWidgets: "financas_dashboard_widgets",
} as const;

const DEFAULT_WIDGETS: DashboardWidgetsConfig = {
  kpis: true,
  pace: true,
  invoices: true,
  anomalies: true,
  flow: true,
  donut: true,
  savingsHealth: true,
  budgets: true,
};

const DEFAULT_CONFIG: VisualCustomization = {
  accent: "teal",
  surfaceStyle: "glass",
  motionLevel: "fluid",
  soundEnabled: false,
  numberTickerEnabled: true,
  dashboardWidgets: DEFAULT_WIDGETS,
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
  } else {
    root.removeAttribute("data-motion");
  }
}

function readStoredConfig(): VisualCustomization {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const rawAccent = window.localStorage.getItem(STORAGE_KEYS.accent) as AccentTheme | null;
    const accent: AccentTheme =
      rawAccent && ["teal", "emerald", "gold", "sapphire", "violet", "rose"].includes(rawAccent)
        ? rawAccent
        : "teal";

    const rawSurface = window.localStorage.getItem(STORAGE_KEYS.surfaceStyle) as SurfaceStyle | null;
    const surfaceStyle: SurfaceStyle =
      rawSurface && ["glass", "flat", "elevated"].includes(rawSurface) ? rawSurface : "glass";

    const rawMotion = window.localStorage.getItem(STORAGE_KEYS.motionLevel) as MotionLevel | null;
    const motionLevel: MotionLevel =
      rawMotion && ["fluid", "eco", "reduced"].includes(rawMotion) ? rawMotion : "fluid";

    const soundEnabled = window.localStorage.getItem(STORAGE_KEYS.soundEnabled) === "true";
    const numberTickerEnabled =
      window.localStorage.getItem(STORAGE_KEYS.numberTickerEnabled) !== "false";

    let dashboardWidgets = DEFAULT_WIDGETS;
    const rawWidgets = window.localStorage.getItem(STORAGE_KEYS.dashboardWidgets);
    if (rawWidgets) {
      try {
        dashboardWidgets = { ...DEFAULT_WIDGETS, ...JSON.parse(rawWidgets) };
      } catch {
        dashboardWidgets = DEFAULT_WIDGETS;
      }
    }

    return {
      accent,
      surfaceStyle,
      motionLevel,
      soundEnabled,
      numberTickerEnabled,
      dashboardWidgets,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function subscribeVisualCustomization(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVisualCustomization(): VisualCustomization {
  if (!isInitialized && typeof window !== "undefined") {
    currentConfig = readStoredConfig();
    applyDomAttributes(currentConfig);
    isInitialized = true;
  }
  return currentConfig;
}

export function updateVisualCustomization(partial: Partial<VisualCustomization>): void {
  if (typeof window === "undefined") return;

  const next: VisualCustomization = {
    ...currentConfig,
    ...partial,
    dashboardWidgets: partial.dashboardWidgets
      ? { ...currentConfig.dashboardWidgets, ...partial.dashboardWidgets }
      : currentConfig.dashboardWidgets,
  };

  try {
    if (partial.accent !== undefined) {
      window.localStorage.setItem(STORAGE_KEYS.accent, next.accent);
    }
    if (partial.surfaceStyle !== undefined) {
      window.localStorage.setItem(STORAGE_KEYS.surfaceStyle, next.surfaceStyle);
    }
    if (partial.motionLevel !== undefined) {
      window.localStorage.setItem(STORAGE_KEYS.motionLevel, next.motionLevel);
    }
    if (partial.soundEnabled !== undefined) {
      window.localStorage.setItem(STORAGE_KEYS.soundEnabled, String(next.soundEnabled));
    }
    if (partial.numberTickerEnabled !== undefined) {
      window.localStorage.setItem(STORAGE_KEYS.numberTickerEnabled, String(next.numberTickerEnabled));
    }
    if (partial.dashboardWidgets !== undefined) {
      window.localStorage.setItem(STORAGE_KEYS.dashboardWidgets, JSON.stringify(next.dashboardWidgets));
    }
  } catch {
    // quota exceeded fallback
  }

  currentConfig = next;
  applyDomAttributes(next);
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
    setNumberTickerEnabled: (numberTickerEnabled: boolean) =>
      updateVisualCustomization({ numberTickerEnabled }),
    setDashboardWidget: (widget: keyof DashboardWidgetsConfig, visible: boolean) =>
      updateVisualCustomization({
        dashboardWidgets: { ...config.dashboardWidgets, [widget]: visible },
      }),
    resetToDefaults: () => updateVisualCustomization(DEFAULT_CONFIG),
  };
}
