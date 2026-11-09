/**
 * Hook de persistência da identidade do participante convidado em links públicos (/viagem/:token).
 * Armazena a escolha de "Quem é você nesta viagem?" no localStorage do navegador sob a chave
 * `axis_guest_member_${token}`, evitando que lançamentos subsequentes sejam imputados ao host
 * ou que o usuário precise selecionar sua identidade repetidamente.
 */

import { useCallback, useSyncExternalStore } from "react";

export const GUEST_MEMBER_STORAGE_KEY_PREFIX = "axis_guest_member_";

export function getPublicTripGuestStorageKey(token: string): string {
  return `${GUEST_MEMBER_STORAGE_KEY_PREFIX}${token}`;
}

const guestIdentityListeners = new Set<() => void>();

function notifyGuestIdentityListeners(): void {
  guestIdentityListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignora erros de listeners para proteger os demais inscritos
    }
  });
}

function subscribeGuestIdentity(callback: () => void): () => void {
  guestIdentityListeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(GUEST_MEMBER_STORAGE_KEY_PREFIX)) {
      callback();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    guestIdentityListeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export interface UsePublicTripGuestIdentityReturn {
  activeMemberId: string | null;
  setActiveMemberId: (id: string | null) => void;
  clearActiveMember: () => void;
}

export function usePublicTripGuestIdentity(
  token?: string | null
): UsePublicTripGuestIdentityReturn {
  const cleanToken = token?.trim() || null;

  const getSnapshot = useCallback((): string | null => {
    if (!cleanToken || typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(getPublicTripGuestStorageKey(cleanToken));
      return stored && stored.trim() ? stored.trim() : null;
    } catch {
      return null;
    }
  }, [cleanToken]);

  const getServerSnapshot = useCallback((): string | null => null, []);

  const activeMemberId = useSyncExternalStore(
    subscribeGuestIdentity,
    getSnapshot,
    getServerSnapshot
  );

  const setActiveMemberId = useCallback(
    (id: string | null) => {
      if (!cleanToken || typeof window === "undefined") return;
      const key = getPublicTripGuestStorageKey(cleanToken);
      try {
        const trimmed = id?.trim();
        if (trimmed) {
          window.localStorage.setItem(key, trimmed);
        } else {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Falhas de cota ou restrições de sandbox em localStorage são tratadas sem quebra
      }
      notifyGuestIdentityListeners();
    },
    [cleanToken]
  );

  const clearActiveMember = useCallback(() => {
    setActiveMemberId(null);
  }, [setActiveMemberId]);

  return {
    activeMemberId,
    setActiveMemberId,
    clearActiveMember,
  };
}
