import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";
import { syncStatusBarTheme } from "@/services/native";
import {
  type Theme,
  type ThemePreference,
  type DarkThemeVariant,
  type ThemeScheduleConfig,
  DEFAULT_DARK_VARIANT,
  DEFAULT_THEME_SCHEDULE,
  THEME_COLORS,
  resolveTheme,
} from "@/domain/theme";

export type { Theme, ThemePreference, DarkThemeVariant, ThemeScheduleConfig };

const STORAGE_KEY = "theme";
const DARK_VARIANT_KEY = "dark_theme_variant";
const SCHEDULE_KEY = "theme_schedule";

export interface ThemeContextValue {
  /** Tema efetivo aplicado no DOM ("light" | "dark" | "oled"). */
  theme: Theme;
  /** Preferência do usuário ("system" | "schedule" | "light" | "dark" | "oled"). */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Preferência de modo escuro padrão quando o app entra em modo dark ("dark" | "oled"). Padrão: "dark". */
  darkThemeVariant: DarkThemeVariant;
  setDarkThemeVariant: (variant: DarkThemeVariant) => void;
  /** Configuração de agendamento por horário do dia. */
  scheduleConfig: ThemeScheduleConfig;
  setScheduleConfig: (config: Partial<ThemeScheduleConfig>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(userId?: string | null): ThemePreference {
  const stored = getUserStorageItem(STORAGE_KEY, userId);
  if (
    stored === "light" ||
    stored === "dark" ||
    stored === "oled" ||
    stored === "system" ||
    stored === "schedule"
  ) {
    return stored;
  }

  // Se a conta ainda não possui preferência gravada, herda a preferência ativa da sessão (evita pulo de tema ao logar)
  if (typeof window !== "undefined") {
    try {
      const activeStored =
        window.localStorage.getItem(`financas_active_${STORAGE_KEY}`) ||
        window.localStorage.getItem(`financas_guest_${STORAGE_KEY}`);
      if (
        activeStored === "light" ||
        activeStored === "dark" ||
        activeStored === "oled" ||
        activeStored === "system" ||
        activeStored === "schedule"
      ) {
        if (userId) {
          setUserStorageItem(STORAGE_KEY, activeStored, userId);
        }
        return activeStored;
      }
    } catch {
      // no-op
    }
  }

  // Novos usuários iniciam obrigatoriamente no modo automático do sistema
  return "system";
}

function readDarkThemeVariant(userId?: string | null): DarkThemeVariant {
  const stored = getUserStorageItem(DARK_VARIANT_KEY, userId);
  if (stored === "oled" || stored === "dark") {
    return stored;
  }

  if (typeof window !== "undefined") {
    try {
      const activeStored =
        window.localStorage.getItem(`financas_active_${DARK_VARIANT_KEY}`) ||
        window.localStorage.getItem(`financas_guest_${DARK_VARIANT_KEY}`);
      if (activeStored === "oled" || activeStored === "dark") {
        if (userId) {
          setUserStorageItem(DARK_VARIANT_KEY, activeStored, userId);
        }
        return activeStored;
      }
    } catch {
      // no-op
    }
  }

  return DEFAULT_DARK_VARIANT;
}

function readScheduleConfig(userId?: string | null): ThemeScheduleConfig {
  const stored = getUserStorageItem(SCHEDULE_KEY, userId);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<ThemeScheduleConfig>;
      return {
        dayStart: parsed.dayStart ?? DEFAULT_THEME_SCHEDULE.dayStart,
        nightStart: parsed.nightStart ?? DEFAULT_THEME_SCHEDULE.nightStart,
        dayTheme: "light",
        nightTheme: parsed.nightTheme === "oled" ? "oled" : "dark",
      };
    } catch {
      // fallback
    }
  }

  if (typeof window !== "undefined") {
    try {
      const activeStored =
        window.localStorage.getItem(`financas_active_${SCHEDULE_KEY}`) ||
        window.localStorage.getItem(`financas_guest_${SCHEDULE_KEY}`);
      if (activeStored) {
        const parsed = JSON.parse(activeStored) as Partial<ThemeScheduleConfig>;
        const config: ThemeScheduleConfig = {
          dayStart: parsed.dayStart ?? DEFAULT_THEME_SCHEDULE.dayStart,
          nightStart: parsed.nightStart ?? DEFAULT_THEME_SCHEDULE.nightStart,
          dayTheme: "light",
          nightTheme: parsed.nightTheme === "oled" ? "oled" : "dark",
        };
        if (userId) {
          setUserStorageItem(SCHEDULE_KEY, JSON.stringify(config), userId);
        }
        return config;
      }
    } catch {
      // no-op
    }
  }

  return DEFAULT_THEME_SCHEDULE;
}

function updateMetaThemeColor(theme: Theme) {
  if (typeof document === "undefined") return;
  const color = THEME_COLORS[theme];
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta) => {
    meta.setAttribute("content", color);
  });
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference());
  const [darkThemeVariant, setDarkThemeVariantState] = useState<DarkThemeVariant>(() =>
    readDarkThemeVariant(),
  );
  const [scheduleConfig, setScheduleConfigState] = useState<ThemeScheduleConfig>(() =>
    readScheduleConfig(),
  );
  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemPrefersDark);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  // Sincroniza preferências locais se o userId mudar (login / logout)
  useEffect(() => {
    const unsub = subscribeActiveUserId((userId) => {
      setPreferenceState(readPreference(userId));
      setDarkThemeVariantState(readDarkThemeVariant(userId));
      setScheduleConfigState(readScheduleConfig(userId));
    });
    return unsub;
  }, []);

  // Escuta alterações de tema no sistema operacional
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, []);

  // Quando o modo schedule estiver ativo, atualiza o relógio a cada 30 segundos para transição suave
  useEffect(() => {
    if (preference !== "schedule") return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [preference]);

  // Resolução determinística do tema ativo
  const theme: Theme = useMemo(
    () =>
      resolveTheme({
        preference,
        systemIsDark,
        darkThemeVariant,
        scheduleConfig,
        currentTime,
      }),
    [preference, systemIsDark, darkThemeVariant, scheduleConfig, currentTime],
  );

  useEffect(() => {
    // Aplica o tema nos tokens CSS (tokens.css)
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
    // Sincroniza a cor da barra de título do SO/PWA e barra de status mobile
    updateMetaThemeColor(theme);
    // Sincroniza a barra de status nativa no Android
    void syncStatusBarTheme(theme);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setUserStorageItem(STORAGE_KEY, next);
  }, []);

  const setDarkThemeVariant = useCallback((next: DarkThemeVariant) => {
    setDarkThemeVariantState(next);
    setUserStorageItem(DARK_VARIANT_KEY, next);
  }, []);

  const setScheduleConfig = useCallback((patch: Partial<ThemeScheduleConfig>) => {
    setScheduleConfigState((prev) => {
      const merged: ThemeScheduleConfig = {
        ...prev,
        ...patch,
        dayTheme: "light",
        nightTheme: patch.nightTheme ?? prev.nightTheme,
      };
      setUserStorageItem(SCHEDULE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      darkThemeVariant,
      setDarkThemeVariant,
      scheduleConfig,
      setScheduleConfig,
    }),
    [
      theme,
      preference,
      setPreference,
      darkThemeVariant,
      setDarkThemeVariant,
      scheduleConfig,
      setScheduleConfig,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function getSafeThemeFromDom(): Theme {
  if (typeof document !== "undefined") {
    const dataTheme = document.documentElement.getAttribute("data-theme");
    if (dataTheme === "light" || dataTheme === "dark" || dataTheme === "oled") {
      return dataTheme;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      !window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "light";
    }
  }
  return "dark";
}

// Contexto + hook no mesmo arquivo é o padrão shadcn; suprime o fast-refresh warning.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    theme: getSafeThemeFromDom(),
    preference: "system",
    setPreference: () => {},
    darkThemeVariant: DEFAULT_DARK_VARIANT,
    setDarkThemeVariant: () => {},
    scheduleConfig: DEFAULT_THEME_SCHEDULE,
    setScheduleConfig: () => {},
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSafeTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx.theme;
  return getSafeThemeFromDom();
}
