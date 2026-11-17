/**
 * Hook de persistência da identidade do participante em links públicos de racha (/r/:token).
 * Armazena a escolha de "Quem é você neste racha?" no localStorage sob a chave
 * `axis_guest_split_${token}`, garantindo que pagamentos via Pix e sinalizações
 * sejam imputados ao participante correto sem fricção ou falsas identidades de anfitrião.
 */

import { useCallback, useSyncExternalStore } from "react";

export const GUEST_SPLIT_STORAGE_KEY_PREFIX = "axis_guest_split_";

export function getPublicSplitGuestStorageKey(token: string): string {
  return `${GUEST_SPLIT_STORAGE_KEY_PREFIX}${token}`;
}

const guestSplitIdentityListeners = new Set<() => void>();

function notifyGuestSplitIdentityListeners(): void {
  guestSplitIdentityListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignora erros de listeners para proteger os demais inscritos
    }
  });
}

function subscribeGuestSplitIdentity(callback: () => void): () => void {
  guestSplitIdentityListeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(GUEST_SPLIT_STORAGE_KEY_PREFIX)) {
      callback();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    guestSplitIdentityListeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export interface UsePublicSplitGuestIdentityReturn {
  activeParticipantId: string | null;
  setActiveParticipantId: (id: string | null) => void;
  clearActiveParticipant: () => void;
}

export function usePublicSplitGuestIdentity(
  token?: string | null,
): UsePublicSplitGuestIdentityReturn {
  const cleanToken = token?.trim() || null;

  const getSnapshot = useCallback((): string | null => {
    if (!cleanToken || typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(getPublicSplitGuestStorageKey(cleanToken));
      return stored && stored.trim() ? stored.trim() : null;
    } catch {
      return null;
    }
  }, [cleanToken]);

  const getServerSnapshot = useCallback((): string | null => null, []);

  const activeParticipantId = useSyncExternalStore(
    subscribeGuestSplitIdentity,
    getSnapshot,
    getServerSnapshot,
  );

  const setActiveParticipantId = useCallback(
    (id: string | null) => {
      if (!cleanToken || typeof window === "undefined") return;
      const key = getPublicSplitGuestStorageKey(cleanToken);
      try {
        const trimmed = id?.trim();
        if (trimmed) {
          window.localStorage.setItem(key, trimmed);
        } else {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Falhas de cota de storage tratadas silenciosamente
      }
      notifyGuestSplitIdentityListeners();
    },
    [cleanToken],
  );

  const clearActiveParticipant = useCallback(() => {
    setActiveParticipantId(null);
  }, [setActiveParticipantId]);

  return {
    activeParticipantId,
    setActiveParticipantId,
    clearActiveParticipant,
  };
}
