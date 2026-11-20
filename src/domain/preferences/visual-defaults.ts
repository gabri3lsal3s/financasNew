/**
 * Contrato de preferências visuais e sensoriais, defaults e normalizadores puros.
 * Sem dependências de DOM, React, storage ou Supabase.
 */
import type { UserCustomSettings } from "@/types";
import {
  applyExperiencePreset,
  detectActivePreset,
  type ExperiencePreset,
  type SensoryIntent,
} from "./index";

export type AccentTheme = "teal" | "gold" | "mono";
export type SurfaceStyle = "glass" | "flat";
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

export const VISUAL_STORAGE_KEYS = {
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

export const VALID_ACCENT_THEMES: readonly AccentTheme[] = [
  "teal",
  "gold",
  "mono",
];
export const VALID_MOTION_LEVELS: readonly MotionLevel[] = ["fluid", "eco", "reduced"];
export const VALID_DENSITY_LEVELS: readonly DensityLevel[] = ["comfortable", "compact"];
export const VALID_EXPERIENCE_PRESETS: readonly ExperiencePreset[] = [
  "dynamic",
  "minimal",
  "discreet",
  "custom",
];
export const VALID_SENSORY_INTENTS: readonly SensoryIntent[] = [
  "selection",
  "action",
  "toggle",
  "success",
  "warning",
  "destructive",
  "error",
];

export const DEFAULT_HEADER_BUTTONS: HeaderButtonsConfig = {
  logo: true,
  calculatorButton: true,
  themeToggle: true,
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

export function isValidAccentTheme(value: unknown): value is AccentTheme {
  return typeof value === "string" && VALID_ACCENT_THEMES.includes(value as AccentTheme);
}

/**
 * Mescla uma atualização parcial na configuração visual preservando a consistência
 * entre presets de experiência e ajustes finos individuais.
 */
export function mergeVisualCustomization(
  current: VisualCustomization,
  partial: Partial<VisualCustomization>,
): VisualCustomization {
  const mergedWidgets = partial.dashboardWidgets
    ? { ...current.dashboardWidgets, ...partial.dashboardWidgets }
    : current.dashboardWidgets;
  const mergedHeaderButtons = partial.headerButtons
    ? { ...current.headerButtons, ...partial.headerButtons }
    : current.headerButtons;

  if (partial.experiencePreset && partial.experiencePreset !== "custom") {
    const applied = applyExperiencePreset(partial.experiencePreset, {
      ...current,
      ...partial,
    });
    return {
      ...applied,
      experiencePreset: partial.experiencePreset,
      dashboardWidgets: mergedWidgets,
      headerButtons: mergedHeaderButtons,
    };
  }

  const next: VisualCustomization = {
    ...current,
    ...partial,
    dashboardWidgets: mergedWidgets,
    headerButtons: mergedHeaderButtons,
  };
  next.experiencePreset = partial.experiencePreset ?? detectActivePreset(next);
  return next;
}

/**
 * Converte custom_settings vindos da nuvem para atualização parcial validada.
 */
export function normalizeCloudVisualPartial(
  customSettings: UserCustomSettings,
): Partial<VisualCustomization> {
  const partial: Partial<VisualCustomization> = {};

  if (customSettings.experiencePreset) partial.experiencePreset = customSettings.experiencePreset;
  if (isValidAccentTheme(customSettings.accent)) partial.accent = customSettings.accent;
  if (customSettings.surfaceStyle) {
    partial.surfaceStyle = customSettings.surfaceStyle === "flat" ? "flat" : "glass";
  }
  if (customSettings.motionLevel) partial.motionLevel = customSettings.motionLevel;
  if (customSettings.density) partial.density = customSettings.density;
  if (customSettings.soundEnabled !== undefined) partial.soundEnabled = customSettings.soundEnabled;
  if (customSettings.hapticEnabled !== undefined) partial.hapticEnabled = customSettings.hapticEnabled;
  if (customSettings.numberTickerEnabled !== undefined) {
    partial.numberTickerEnabled = customSettings.numberTickerEnabled;
  }
  if (customSettings.disabledSensoryIntents) {
    partial.disabledSensoryIntents = customSettings.disabledSensoryIntents.filter((item): item is SensoryIntent =>
      VALID_SENSORY_INTENTS.includes(item as SensoryIntent),
    );
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

  return partial;
}
