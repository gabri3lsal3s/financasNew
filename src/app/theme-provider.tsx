import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";
import { syncStatusBarTheme } from "@/services/native";

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
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oled" : "light";
}

function readPreference(userId?: string | null): ThemePreference {
  const stored = getUserStorageItem(STORAGE_KEY, userId);
  if (stored === "light" || stored === "dark" || stored === "oled" || stored === "system") {
    return stored;
  }

  // Se a conta ainda não possui preferência gravada, herda a preferência ativa da sessão (evita que o tema mude ao fazer login)
  if (typeof window !== "undefined") {
    try {
      const activeStored =
        window.localStorage.getItem(`financas_active_${STORAGE_KEY}`) ||
        window.localStorage.getItem(`financas_guest_${STORAGE_KEY}`);
      if (
        activeStored === "light" ||
        activeStored === "dark" ||
        activeStored === "oled" ||
        activeStored === "system"
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

  // Fallback seguro: se o documento HTML já possui tema ativo no DOM, preserva-o
  if (typeof document !== "undefined") {
    const domTheme = document.documentElement.getAttribute("data-theme");
    if (domTheme === "light" || domTheme === "dark" || domTheme === "oled") {
      if (userId) {
        setUserStorageItem(STORAGE_KEY, domTheme, userId);
      }
      return domTheme;
    }
  }

  return "system";
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
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? "oled" : "light");
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, []);

  const theme: Theme = preference === "system" ? system : preference;

  useEffect(() => {
    // Aplica o tema nos tokens (tokens.css) — fallback CSS evita flash sem JS.
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

  const value = useMemo(() => ({ theme, preference, setPreference }), [theme, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function getSafeThemeFromDom(): Theme {
  if (typeof document !== "undefined") {
    const dataTheme = document.documentElement.getAttribute("data-theme");
    if (dataTheme === "light" || dataTheme === "dark" || dataTheme === "oled") {
      return dataTheme;
    }
    if (typeof window !== "undefined" && window.matchMedia && !window.matchMedia("(prefers-color-scheme: dark)").matches) {
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
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSafeTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx.theme;
  return getSafeThemeFromDom();
}
