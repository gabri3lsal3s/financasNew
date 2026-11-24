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

export type HeaderActionSlotKey = "calculatorButton" | "themeToggle" | "privacyToggle";
export type VisibleHeaderSlot = HeaderActionSlotKey | "notifications";

export const CANONICAL_HEADER_ACTION_SLOTS: readonly HeaderActionSlotKey[] = [
  "calculatorButton",
  "themeToggle",
  "privacyToggle",
];

export interface HeaderButtonsConfig {
  logo: boolean;
  calculatorButton: boolean;
  themeToggle: boolean;
  privacyToggle: boolean;
  order?: HeaderActionSlotKey[];
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
  showCalculationMemory: boolean;
  showEducationalPlaybooks: boolean;
  dismissedPlaybookKeys: string[];
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
  showCalculationMemory: "show_calculation_memory",
  showEducationalPlaybooks: "show_educational_playbooks",
  dismissedPlaybookKeys: "dismissed_playbook_keys",
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
  soundEnabled: false,
  hapticEnabled: true,
  disabledSensoryIntents: [],
  numberTickerEnabled: true,
  dashboardWidgets: DEFAULT_WIDGETS,
  headerButtons: DEFAULT_HEADER_BUTTONS,
  showCalculationMemory: true,
  showEducationalPlaybooks: true,
  dismissedPlaybookKeys: [],
};

export function isValidAccentTheme(value: unknown): value is AccentTheme {
  return typeof value === "string" && VALID_ACCENT_THEMES.includes(value as AccentTheme);
}

/**
 * Resolve a ordem da esquerda para a direita dos botões de ação ativos no cabeçalho (máx. 2).
 * Respeita a ordem em que o usuário ativou os botões (`cfg.order`), usando a ordem canônica como fallback.
 */
export function resolveHeaderActionOrder(cfg: HeaderButtonsConfig): HeaderActionSlotKey[] {
  const ordered: HeaderActionSlotKey[] = [];

  if (Array.isArray(cfg.order)) {
    for (const key of cfg.order) {
      if (
        CANONICAL_HEADER_ACTION_SLOTS.includes(key) &&
        cfg[key] === true &&
        !ordered.includes(key)
      ) {
        ordered.push(key);
      }
    }
  }

  for (const key of CANONICAL_HEADER_ACTION_SLOTS) {
    if (cfg[key] === true && !ordered.includes(key)) {
      ordered.push(key);
    }
  }

  return ordered.slice(0, 2);
}

/**
 * Resolve os slots visíveis no topo (máximo estrito de 2 botões).
 * Quando há notificações (`hasNotifications === true`), o sininho ocupa sempre o espaço mais extremo à direita:
 * - Se houver 2 botões ativos, o botão mais à direita (`active[1]`) é substituído pelo sininho;
 * - Se houver 1 botão ativo, ele permanece à esquerda e o sininho entra à direita;
 * - Quando as notificações zeram (`hasNotifications === false`), o sininho sai e o botão substituído retorna.
 */
export function resolveVisibleHeaderSlots(
  cfg: HeaderButtonsConfig,
  hasNotifications: boolean,
): VisibleHeaderSlot[] {
  const active = resolveHeaderActionOrder(cfg);
  if (!hasNotifications) {
    return active;
  }
  if (active.length >= 2) {
    return [active[0]!, "notifications"];
  }
  if (active.length === 1) {
    return [active[0]!, "notifications"];
  }
  return ["notifications"];
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
  const mergedHeaderButtons: HeaderButtonsConfig = partial.headerButtons
    ? {
        ...current.headerButtons,
        ...partial.headerButtons,
        ...(partial.headerButtons.order !== undefined
          ? { order: partial.headerButtons.order }
          : current.headerButtons.order !== undefined
            ? { order: current.headerButtons.order }
            : {}),
      }
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
  if (customSettings.showCalculationMemory !== undefined) {
    partial.showCalculationMemory = customSettings.showCalculationMemory;
  }
  if (customSettings.showEducationalPlaybooks !== undefined) {
    partial.showEducationalPlaybooks = customSettings.showEducationalPlaybooks;
  }
  if (Array.isArray(customSettings.dismissedPlaybookKeys)) {
    partial.dismissedPlaybookKeys = customSettings.dismissedPlaybookKeys;
  }

  return partial;
}
