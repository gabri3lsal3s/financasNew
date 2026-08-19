import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

export type Theme = "light" | "dark" | "oled";
export type ThemePreference = Theme | "system";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  /** Tema efetivo (system já resolvido). */
  theme: Theme;
  /** Preferência do usuário (persistida no storage local do dispositivo). */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPreference(userId?: string | null): ThemePreference {
  const stored = getUserStorageItem(STORAGE_KEY, userId);
  return stored === "light" || stored === "dark" || stored === "oled" || stored === "system"
    ? stored
    : "system";
}

const THEME_COLORS: Record<Theme, string> = {
  light: "#F4F7F9",
  dark: "#0C1923",
  oled: "#000000",
};

function updateMetaThemeColor(theme: Theme) {
  if (typeof document === "undefined") return;
  const color = THEME_COLORS[theme];
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta) => {
    meta.setAttribute("content", color);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference());
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const unsub = subscribeActiveUserId((userId) => {
      setPreferenceState(readPreference(userId));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? "dark" : "light");
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, []);

  const theme: Theme = preference === "system" ? system : preference;

  useEffect(() => {
    // Aplica o tema nos tokens (tokens.css) — fallback CSS evita flash sem JS.
    document.documentElement.dataset.theme = theme;
    // Sincroniza a cor da barra de título do SO/PWA e barra de status mobile
    updateMetaThemeColor(theme);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setUserStorageItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, preference, setPreference }), [theme, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Contexto + hook no mesmo arquivo é o padrão shadcn; suprime o fast-refresh warning.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}
