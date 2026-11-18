/**
 * Store unificado de persistência da identidade do visitante em links públicos (/r/:token e /viagem/:token).
 *
 * Centraliza a assinatura reativa (`useSyncExternalStore`), sincronização entre abas (`storage` event)
 * e tratamento defensivo de cota/sandbox do `localStorage`, mantendo os prefixos de chave canônicos
 * por escopo (`split` e `trip`).
 */

import { useCallback, useSyncExternalStore } from "react";

export type GuestIdentityScope = "split" | "trip";

export const GUEST_IDENTITY_STORAGE_PREFIXES: Record<GuestIdentityScope, string> = {
  split: "axis_guest_split_",
  trip: "axis_guest_member_",
};

export function getGuestIdentityStorageKey(scope: GuestIdentityScope, token: string): string {
  return `${GUEST_IDENTITY_STORAGE_PREFIXES[scope]}${token}`;
}

const listenersByScope: Record<GuestIdentityScope, Set<() => void>> = {
  split: new Set<() => void>(),
  trip: new Set<() => void>(),
};

function notifyScopeListeners(scope: GuestIdentityScope): void {
  listenersByScope[scope].forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignora erros de listeners para proteger os demais inscritos
    }
  });
}

function subscribeScope(scope: GuestIdentityScope, callback: () => void): () => void {
  const prefix = GUEST_IDENTITY_STORAGE_PREFIXES[scope];
  listenersByScope[scope].add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(prefix)) {
      callback();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listenersByScope[scope].delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export interface UseGuestIdentityStoreReturn {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  clearActive: () => void;
}

export function useGuestIdentityStore(
  scope: GuestIdentityScope,
  token?: string | null,
): UseGuestIdentityStoreReturn {
  const cleanToken = token?.trim() || null;

  const subscribe = useCallback(
    (callback: () => void) => subscribeScope(scope, callback),
    [scope],
  );

  const getSnapshot = useCallback((): string | null => {
    if (!cleanToken || typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(getGuestIdentityStorageKey(scope, cleanToken));
      return stored && stored.trim() ? stored.trim() : null;
    } catch {
      return null;
    }
  }, [scope, cleanToken]);

  const getServerSnapshot = useCallback((): string | null => null, []);

  const activeId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setActiveId = useCallback(
    (id: string | null) => {
      if (!cleanToken || typeof window === "undefined") return;
      const key = getGuestIdentityStorageKey(scope, cleanToken);
      try {
        const trimmed = id?.trim();
        if (trimmed) {
          window.localStorage.setItem(key, trimmed);
        } else {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Falhas de cota ou restrições de sandbox em localStorage são tratadas silenciosamente
      }
      notifyScopeListeners(scope);
    },
    [scope, cleanToken],
  );

  const clearActive = useCallback(() => {
    setActiveId(null);
  }, [setActiveId]);

  return {
    activeId,
    setActiveId,
    clearActive,
  };
}
