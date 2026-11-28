import { useCallback, useState, type CSSProperties } from "react";
import type { Theme } from "@/domain/theme/theme-resolver";

export type AdminAccent = "default" | "indigo" | "emerald";

export const ADMIN_ACCENT_STORAGE_KEY = "axir_admin_accent";

export interface AdminAccentOption {
  id: AdminAccent;
  label: string;
  swatchColor: string;
}

export const ADMIN_ACCENT_OPTIONS: AdminAccentOption[] = [
  { id: "default", label: "Padrão", swatchColor: "#2A9D8F" },
  { id: "indigo", label: "Índigo", swatchColor: "#4F46E5" },
  { id: "emerald", label: "Verde", swatchColor: "#10B981" },
];

const ACCENT_TOKENS: Record<
  Exclude<AdminAccent, "default">,
  {
    light: Record<string, string>;
    dark: Record<string, string>;
  }
> = {
  indigo: {
    light: {
      "--primary": "239 84% 60%",
      "--primary-strong": "239 74% 47%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "239 84% 60%",
    },
    dark: {
      "--primary": "239 84% 67%",
      "--primary-strong": "239 84% 67%",
      "--primary-foreground": "222 47% 11%",
      "--ring": "239 84% 67%",
    },
  },
  emerald: {
    light: {
      "--primary": "158 64% 38%",
      "--primary-strong": "160 72% 26%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "158 64% 38%",
    },
    dark: {
      "--primary": "158 64% 48%",
      "--primary-strong": "158 64% 48%",
      "--primary-foreground": "160 92% 9%",
      "--ring": "158 64% 48%",
    },
  },
};

function isAdminAccent(value: string | null): value is AdminAccent {
  return value === "default" || value === "indigo" || value === "emerald";
}

export function readAdminAccent(): AdminAccent {
  if (typeof window === "undefined") return "default";
  try {
    const stored = window.localStorage.getItem(ADMIN_ACCENT_STORAGE_KEY);
    return isAdminAccent(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

export function writeAdminAccent(accent: AdminAccent): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_ACCENT_STORAGE_KEY, accent);
  } catch {
    // Ignora falhas de persistência local em modos restritos.
  }
}

export function getAdminAccentStyle(
  accent: AdminAccent,
  theme: Theme,
): CSSProperties | undefined {
  if (accent === "default") return undefined;
  const palette = theme === "light" ? ACCENT_TOKENS[accent].light : ACCENT_TOKENS[accent].dark;
  return palette as CSSProperties;
}

export function useAdminAccent() {
  const [accent, setAccentState] = useState<AdminAccent>(() => readAdminAccent());

  const setAccent = useCallback((next: AdminAccent) => {
    setAccentState(next);
    writeAdminAccent(next);
  }, []);

  return { accent, setAccent };
}
