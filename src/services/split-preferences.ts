/**
 * Serviço e Hook de Gerenciamento e Aprendizado de Preferências de Rachar Despesa.
 *
 * Persistência em duas camadas:
 * 1. Camada local imediata (< 1 ms via user-storage isolado por usuário).
 * 2. Camada em nuvem multi-dispositivo via Supabase (user_preferences.custom_settings.splitPreferences).
 */

import { useCallback, useEffect, useState } from "react";
import { updateCustomSettings } from "@/data/repositories/user-preferences";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";
import type { SplitPreferences } from "@/types";

const STORAGE_KEY = "split_preferences";
const listeners = new Set<(prefs: SplitPreferences) => void>();

let cache: SplitPreferences | null = null;
let cloudSyncTimeout: ReturnType<typeof setTimeout> | null = null;

export const DEFAULT_SPLIT_PREFERENCES: SplitPreferences = {
  pixKey: "",
  pixKeyType: "auto",
  merchantName: "",
  merchantCity: "",
  remainderPolicy: "host",
  defaultPeopleCount: 2,
  autoCreateDebt: true,
};

function sanitizeSplitPreferences(raw: unknown): SplitPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_SPLIT_PREFERENCES };
  }
  const obj = raw as Record<string, unknown>;
  return {
    pixKey: typeof obj.pixKey === "string" ? obj.pixKey.trim() : "",
    pixKeyType:
      obj.pixKeyType &&
      ["auto", "cpf", "phone", "email", "random", "cnpj"].includes(String(obj.pixKeyType))
        ? (obj.pixKeyType as SplitPreferences["pixKeyType"])
        : "auto",
    merchantName: typeof obj.merchantName === "string" ? obj.merchantName.trim() : "",
    merchantCity: typeof obj.merchantCity === "string"
      ? obj.merchantCity.trim().toUpperCase()
      : "",
    remainderPolicy:
      obj.remainderPolicy === "balanced" || obj.remainderPolicy === "host"
        ? obj.remainderPolicy
        : "host",
    defaultPeopleCount:
      typeof obj.defaultPeopleCount === "number" && obj.defaultPeopleCount >= 2 && obj.defaultPeopleCount <= 50
        ? obj.defaultPeopleCount
        : 2,
    autoCreateDebt: typeof obj.autoCreateDebt === "boolean" ? obj.autoCreateDebt : true,
  };
}

export function getStoredSplitPreferences(userId?: string | null): SplitPreferences {
  if (cache) return { ...cache };
  const raw = getUserStorageItem(STORAGE_KEY, userId);
  if (!raw) {
    cache = { ...DEFAULT_SPLIT_PREFERENCES };
    return { ...cache };
  }
  try {
    const parsed = JSON.parse(raw);
    cache = sanitizeSplitPreferences(parsed);
    return { ...cache };
  } catch {
    cache = { ...DEFAULT_SPLIT_PREFERENCES };
    return { ...cache };
  }
}

export function storeSplitPreferences(
  patch: Partial<SplitPreferences>,
  userId?: string | null,
): SplitPreferences {
  const current = getStoredSplitPreferences(userId);
  const updated = sanitizeSplitPreferences({ ...current, ...patch });

  cache = updated;
  setUserStorageItem(STORAGE_KEY, JSON.stringify(updated), userId);
  listeners.forEach((fn) => fn(updated));

  // Sincronização assíncrona em nuvem com debounce
  if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
  cloudSyncTimeout = setTimeout(() => {
    void updateCustomSettings({ splitPreferences: updated }).catch(() => {
      // Falha de nuvem tratada silenciosamente; a preferência local já está salva.
    });
  }, 400);

  return updated;
}

export function useSplitPreferences() {
  const { data: userPrefs } = useUserPreferences();
  const [preferences, setPreferences] = useState<SplitPreferences>(() => getStoredSplitPreferences());

  // Hidratação a partir da nuvem quando disponível
  useEffect(() => {
    if (userPrefs?.custom_settings?.splitPreferences) {
      const cloudPrefs = sanitizeSplitPreferences(userPrefs.custom_settings.splitPreferences);
      const timer = setTimeout(() => {
        setPreferences((prev) => {
          const merged = sanitizeSplitPreferences({
            ...cloudPrefs,
            ...Object.fromEntries(
              Object.entries(prev).filter(([, v]) => v !== "" && v !== undefined),
            ),
          });
          cache = merged;
          setUserStorageItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [userPrefs?.custom_settings?.splitPreferences]);

  // Listener de atualizações locais e troca de usuário
  useEffect(() => {
    const handleUpdate = (updated: SplitPreferences) => {
      setPreferences(updated);
    };
    listeners.add(handleUpdate);

    const unsubUser = subscribeActiveUserId(() => {
      cache = null;
      setPreferences(getStoredSplitPreferences());
    });

    return () => {
      listeners.delete(handleUpdate);
      unsubUser();
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<SplitPreferences>) => {
    return storeSplitPreferences(patch);
  }, []);

  return {
    preferences,
    updatePreferences,
  };
}
