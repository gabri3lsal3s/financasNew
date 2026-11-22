import { useCallback, useSyncExternalStore } from "react";
import { getActiveUserId, getUserStorageKey, subscribeActiveUserId } from "@/services/user-storage";

const STORAGE_KEY = "financas:onboarding_dismissed";
const listeners = new Set<() => void>();

function getScopedOnboardingKey(): string {
  const uid = getActiveUserId();
  return uid ? getUserStorageKey(STORAGE_KEY, uid) : STORAGE_KEY;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const unsubUser = subscribeActiveUserId(() => listener());
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
      unsubUser();
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === getScopedOnboardingKey() || event.key === STORAGE_KEY || event.key === null) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    unsubUser();
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return window.localStorage.getItem(getScopedOnboardingKey()) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function useOnboardingDismissed() {
  const isDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dismiss = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(getScopedOnboardingKey(), "true");
      }
    } catch {
      // Falha silenciosa caso cookies/armazenamento estejam bloqueados
    }
    emitChange();
  }, []);

  return { isDismissed, dismiss };
}
