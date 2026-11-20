/**
 * Persistência local (localStorage isolado por usuário) e sincronização de atributos
 * DOM das preferências visuais e sensoriais do Axir.
 */
import { detectActivePreset } from "@/domain/preferences";
import {
  DEFAULT_CONFIG,
  DEFAULT_HEADER_BUTTONS,
  DEFAULT_WIDGETS,
  VALID_DENSITY_LEVELS,
  VALID_EXPERIENCE_PRESETS,
  VALID_MOTION_LEVELS,
  VALID_SENSORY_INTENTS,
  VISUAL_STORAGE_KEYS,
  isValidAccentTheme,
  type DensityLevel,
  type ExperiencePreset,
  type MotionLevel,
  type SensoryIntent,
  type SurfaceStyle,
  type VisualCustomization,
} from "@/domain/preferences/visual-defaults";
import { getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import type { UserCustomSettings } from "@/types";

/**
 * Detecta se o caminho atual pertence a uma rota pública de apresentação ou tela de autenticação.
 * Nestas rotas, o app exibe estritamente a identidade oficial Axir (Teal Vital, sem data-accent).
 */
export function isPublicOrAuthPath(pathname?: string): boolean {
  if (typeof window === "undefined") return false;
  const path = pathname ?? window.location.pathname;
  if (!path) return false;
  return (
    path.startsWith("/entrar") ||
    path.startsWith("/cadastro") ||
    path.startsWith("/cadastrar") ||
    path.startsWith("/criar-conta") ||
    path.startsWith("/recuperar-senha") ||
    path.startsWith("/redefinir-senha") ||
    path.startsWith("/atualizar-senha") ||
    path.startsWith("/apresentacao") ||
    path.startsWith("/landing") ||
    path.startsWith("/precos") ||
    path.startsWith("/planos") ||
    path.startsWith("/vendas") ||
    path.startsWith("/termos") ||
    path.startsWith("/privacidade") ||
    path.startsWith("/r/") ||
    path.startsWith("/orcamento-familiar/") ||
    path.startsWith("/meta/") ||
    path.startsWith("/convite-familiar/") ||
    path.startsWith("/viagem/") ||
    path.startsWith("/ferramentas") ||
    path.startsWith("/admin/login")
  );
}

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Ativa uma transição CSS suave nas cores do aplicativo (500ms),
 * permitindo passagem fluida da tela de loading para a cor de destaque do usuário autenticado.
 */
export function triggerThemeTransition(durationMs = 500): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-transition");
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove("theme-transition");
    transitionTimer = null;
  }, durationMs);
}

export function applyVisualDomAttributes(config: VisualCustomization): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Telas públicas e de autenticação mantêm estritamente a identidade oficial Axir (Teal Vital)
  if (config.accent === "teal" || isPublicOrAuthPath()) {
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

function parseJsonObject<T extends object>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function parseDisabledIntents(raw: string | null): SensoryIntent[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SensoryIntent =>
      typeof item === "string" && VALID_SENSORY_INTENTS.includes(item as SensoryIntent),
    );
  } catch {
    return [];
  }
}

export function readStoredVisualConfig(userId?: string | null): VisualCustomization {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const rawAccent = getUserStorageItem(VISUAL_STORAGE_KEYS.accent, userId);
    const accent = isValidAccentTheme(rawAccent) ? rawAccent : "teal";

    const rawSurface = getUserStorageItem(VISUAL_STORAGE_KEYS.surfaceStyle, userId);
    const surfaceStyle: SurfaceStyle = rawSurface === "flat" ? "flat" : "glass";

    const rawMotion = getUserStorageItem(VISUAL_STORAGE_KEYS.motionLevel, userId);
    const motionLevel: MotionLevel =
      rawMotion && VALID_MOTION_LEVELS.includes(rawMotion as MotionLevel)
        ? (rawMotion as MotionLevel)
        : "fluid";

    const rawDensity = getUserStorageItem(VISUAL_STORAGE_KEYS.density, userId);
    const density: DensityLevel =
      rawDensity && VALID_DENSITY_LEVELS.includes(rawDensity as DensityLevel)
        ? (rawDensity as DensityLevel)
        : "comfortable";

    const soundRaw = getUserStorageItem(VISUAL_STORAGE_KEYS.soundEnabled, userId);
    const soundEnabled = soundRaw !== null ? soundRaw === "true" : true;

    const hapticRaw = getUserStorageItem(VISUAL_STORAGE_KEYS.hapticEnabled, userId);
    const hapticEnabled = hapticRaw !== null ? hapticRaw !== "false" : true;

    const tickerRaw = getUserStorageItem(VISUAL_STORAGE_KEYS.numberTickerEnabled, userId);
    const numberTickerEnabled = tickerRaw !== null ? tickerRaw !== "false" : true;

    const disabledSensoryIntents = parseDisabledIntents(
      getUserStorageItem(VISUAL_STORAGE_KEYS.disabledSensoryIntents, userId),
    );

    const dashboardWidgets = parseJsonObject(
      getUserStorageItem(VISUAL_STORAGE_KEYS.dashboardWidgets, userId),
      DEFAULT_WIDGETS,
    );

    const headerButtons = parseJsonObject(
      getUserStorageItem(VISUAL_STORAGE_KEYS.headerButtons, userId),
      DEFAULT_HEADER_BUTTONS,
    );

    const rawPreset = getUserStorageItem(VISUAL_STORAGE_KEYS.experiencePreset, userId);
    const experiencePreset: ExperiencePreset =
      rawPreset && VALID_EXPERIENCE_PRESETS.includes(rawPreset as ExperiencePreset)
        ? (rawPreset as ExperiencePreset)
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

export function writeVisualStorageDiff(
  prev: VisualCustomization,
  next: VisualCustomization,
  partial: Partial<VisualCustomization>,
  userId?: string | null,
): void {
  try {
    setUserStorageItem(VISUAL_STORAGE_KEYS.experiencePreset, next.experiencePreset, userId);
    if (partial.accent !== undefined || next.accent !== prev.accent) {
      setUserStorageItem(VISUAL_STORAGE_KEYS.accent, next.accent, userId);
    }
    if (partial.surfaceStyle !== undefined || next.surfaceStyle !== prev.surfaceStyle) {
      setUserStorageItem(VISUAL_STORAGE_KEYS.surfaceStyle, next.surfaceStyle, userId);
    }
    if (next.motionLevel !== prev.motionLevel || partial.motionLevel !== undefined) {
      setUserStorageItem(VISUAL_STORAGE_KEYS.motionLevel, next.motionLevel, userId);
    }
    if (next.density !== prev.density || partial.density !== undefined) {
      setUserStorageItem(VISUAL_STORAGE_KEYS.density, next.density, userId);
    }
    if (next.soundEnabled !== prev.soundEnabled || partial.soundEnabled !== undefined) {
      setUserStorageItem(VISUAL_STORAGE_KEYS.soundEnabled, String(next.soundEnabled), userId);
    }
    if (next.hapticEnabled !== prev.hapticEnabled || partial.hapticEnabled !== undefined) {
      setUserStorageItem(VISUAL_STORAGE_KEYS.hapticEnabled, String(next.hapticEnabled), userId);
    }
    if (
      next.disabledSensoryIntents !== prev.disabledSensoryIntents ||
      partial.disabledSensoryIntents !== undefined
    ) {
      setUserStorageItem(
        VISUAL_STORAGE_KEYS.disabledSensoryIntents,
        JSON.stringify(next.disabledSensoryIntents),
        userId,
      );
    }
    if (
      next.numberTickerEnabled !== prev.numberTickerEnabled ||
      partial.numberTickerEnabled !== undefined
    ) {
      setUserStorageItem(
        VISUAL_STORAGE_KEYS.numberTickerEnabled,
        String(next.numberTickerEnabled),
        userId,
      );
    }
    if (partial.dashboardWidgets !== undefined) {
      setUserStorageItem(
        VISUAL_STORAGE_KEYS.dashboardWidgets,
        JSON.stringify(next.dashboardWidgets),
        userId,
      );
    }
    if (partial.headerButtons !== undefined) {
      setUserStorageItem(
        VISUAL_STORAGE_KEYS.headerButtons,
        JSON.stringify(next.headerButtons),
        userId,
      );
    }
  } catch {
    // storage fallback
  }
}

export function writeThemeCloudStorage(
  customSettings: UserCustomSettings,
  userId?: string | null,
): void {
  if (customSettings.themePreference) {
    setUserStorageItem("theme", customSettings.themePreference, userId);
  }
  if (customSettings.darkThemeVariant) {
    setUserStorageItem("dark_theme_variant", customSettings.darkThemeVariant, userId);
  }
  if (customSettings.themeSchedule) {
    setUserStorageItem("theme_schedule", JSON.stringify(customSettings.themeSchedule), userId);
  }
}
