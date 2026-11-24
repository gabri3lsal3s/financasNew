import { useCallback, useSyncExternalStore } from "react";
import { getActiveUserId, getUserStorageKey } from "@/services/user-storage";
import { useBusinessMode } from "@/state/queries/use-business-mode";
import type { ViewScope } from "@/types";

const BASE_VIEW_SCOPE_KEY = "axir_view_scope";
const subscribers = new Set<() => void>();
let inMemoryFallback: Record<string, ViewScope> = {};

function getScopedStorageKey(): string {
  const uid = getActiveUserId();
  return uid ? getUserStorageKey(BASE_VIEW_SCOPE_KEY, uid) : `${BASE_VIEW_SCOPE_KEY}::__guest__`;
}

function isValidScope(value: unknown): value is ViewScope {
  return value === "all" || value === "personal" || value === "business";
}

function readSnapshot(): ViewScope {
  const key = getScopedStorageKey();
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (isValidScope(raw)) return raw;
    } catch {
      // Fallback para memória em ambientes restritos
    }
  }
  return inMemoryFallback[key] ?? "all";
}

function writeSnapshot(next: ViewScope): void {
  const key = getScopedStorageKey();
  inMemoryFallback[key] = next;
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(key, next);
    } catch {
      // Ignora erro de quota
    }
  }
  for (const listener of subscribers) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function resetViewScopeStoreForTest(): void {
  inMemoryFallback = {};
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(getScopedStorageKey());
    } catch {
      // Ignora
    }
  }
  for (const listener of subscribers) {
    listener();
  }
}

/**
 * Store client-side (0 ms, sem roundtrip de banco) da visão ativa PF x PJ.
 * Se o Modo Negócio estiver desativado, `effectiveViewScope` retorna estritamente "all".
 */
export function useViewScope() {
  const { isBusinessModeEnabled } = useBusinessMode();
  const viewScope = useSyncExternalStore(subscribe, readSnapshot, () => "all");

  const setViewScope = useCallback((next: ViewScope) => {
    writeSnapshot(next);
  }, []);

  return {
    viewScope,
    effectiveViewScope: (isBusinessModeEnabled ? viewScope : "all") as ViewScope,
    setViewScope,
    isBusinessModeEnabled,
  };
}
