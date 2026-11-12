export type Theme = "light" | "dark" | "oled";

export const THEME_PREFERENCES = ["light", "dark", "oled", "system", "schedule"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type DarkThemeVariant = "dark" | "oled";

export interface ThemeScheduleConfig {
  /** Horário de início do período diurno (formato "HH:mm"). Padrão: "06:00". */
  dayStart: string;
  /** Horário de início do período noturno (formato "HH:mm"). Padrão: "18:00". */
  nightStart: string;
  /** Tema aplicado no período diurno. Padrão: "light". */
  dayTheme: "light";
  /** Tema aplicado no período noturno. Padrão: "dark". */
  nightTheme: DarkThemeVariant;
}

export const DEFAULT_DARK_VARIANT: DarkThemeVariant = "dark";

export const DEFAULT_THEME_SCHEDULE: ThemeScheduleConfig = {
  dayStart: "06:00",
  nightStart: "18:00",
  dayTheme: "light",
  nightTheme: "dark",
};

export const THEME_COLORS: Record<Theme, string> = {
  light: "#F4F7F9",
  dark: "#0C1923",
  oled: "#000000",
};

/**
 * Converte string no formato "HH:mm" em total de minutos a partir da meia-noite (0–1439).
 * Se o formato for inválido, usa o fallback fornecido ou 0.
 */
export function parseTimeToMinutes(timeStr: string, fallbackMinutes = 0): number {
  if (!timeStr || typeof timeStr !== "string") return fallbackMinutes;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return fallbackMinutes;
  const hours = parseInt(parts[0] ?? "", 10);
  const minutes = parseInt(parts[1] ?? "", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallbackMinutes;
  const safeHours = Math.max(0, Math.min(23, hours));
  const safeMinutes = Math.max(0, Math.min(59, minutes));
  return safeHours * 60 + safeMinutes;
}

/**
 * Determina se o horário informado está dentro do período diurno com base nos horários
 * de início do dia e da noite configurados.
 */
export function isDaytime(
  currentTime: { hours: number; minutes: number } | Date,
  dayStart = DEFAULT_THEME_SCHEDULE.dayStart,
  nightStart = DEFAULT_THEME_SCHEDULE.nightStart,
): boolean {
  const currentMinutes =
    currentTime instanceof Date
      ? currentTime.getHours() * 60 + currentTime.getMinutes()
      : currentTime.hours * 60 + currentTime.minutes;

  const startDayMinutes = parseTimeToMinutes(dayStart, 360); // 06:00 = 360
  const startNightMinutes = parseTimeToMinutes(nightStart, 1080); // 18:00 = 1080

  if (startDayMinutes === startNightMinutes) {
    return true;
  }

  // Janela diurna convencional (ex: 06:00 às 18:00)
  if (startDayMinutes < startNightMinutes) {
    return currentMinutes >= startDayMinutes && currentMinutes < startNightMinutes;
  }

  // Janela invertida (ex: início do dia às 20:00 e noite às 08:00)
  return currentMinutes >= startDayMinutes || currentMinutes < startNightMinutes;
}

export interface ResolveThemeParams {
  preference: ThemePreference;
  systemIsDark: boolean;
  darkThemeVariant?: DarkThemeVariant;
  scheduleConfig?: Partial<ThemeScheduleConfig>;
  currentTime?: { hours: number; minutes: number } | Date;
}

/**
 * Função pura e determinística para resolver o tema ativo final ("light" | "dark" | "oled").
 *
 * Invariantes de negócio:
 * 1. Temas manuais ("light", "dark", "oled") são soberanos e retornam diretamente seu valor.
 * 2. Modo "system":
 *    - Se o SO estiver em modo claro -> "light".
 *    - Se o SO estiver em modo escuro -> usa `darkThemeVariant` (padrão oficial: "dark", ou "oled" se escolhido).
 * 3. Modo "schedule":
 *    - Se for horário diurno -> `dayTheme` ("light").
 *    - Se for horário noturno -> `nightTheme` (ou `darkThemeVariant`, padrão "dark").
 */
export function resolveTheme(params: ResolveThemeParams): Theme {
  const {
    preference,
    systemIsDark,
    darkThemeVariant = DEFAULT_DARK_VARIANT,
    scheduleConfig,
    currentTime = new Date(),
  } = params;

  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (preference === "oled") return "oled";

  if (preference === "system") {
    if (!systemIsDark) return "light";
    return darkThemeVariant === "oled" ? "oled" : "dark";
  }

  if (preference === "schedule") {
    const dayStart = scheduleConfig?.dayStart ?? DEFAULT_THEME_SCHEDULE.dayStart;
    const nightStart = scheduleConfig?.nightStart ?? DEFAULT_THEME_SCHEDULE.nightStart;
    const dayTheme = scheduleConfig?.dayTheme ?? DEFAULT_THEME_SCHEDULE.dayTheme;
    const nightTheme = scheduleConfig?.nightTheme ?? darkThemeVariant ?? DEFAULT_THEME_SCHEDULE.nightTheme;

    const isDay = isDaytime(currentTime, dayStart, nightStart);
    if (isDay) return dayTheme;
    return nightTheme === "oled" ? "oled" : "dark";
  }

  return "light";
}
