/**
 * Hook de persistência da identidade do participante em links públicos de racha (/r/:token).
 * Delega ao store unificado `useGuestIdentityStore("split", token)`.
 */

import {
  GUEST_IDENTITY_STORAGE_PREFIXES,
  getGuestIdentityStorageKey,
  useGuestIdentityStore,
} from "./use-guest-identity-store";

export const GUEST_SPLIT_STORAGE_KEY_PREFIX = GUEST_IDENTITY_STORAGE_PREFIXES.split;

export function getPublicSplitGuestStorageKey(token: string): string {
  return getGuestIdentityStorageKey("split", token);
}

export interface UsePublicSplitGuestIdentityReturn {
  activeParticipantId: string | null;
  setActiveParticipantId: (id: string | null) => void;
  clearActiveParticipant: () => void;
}

export function usePublicSplitGuestIdentity(
  token?: string | null,
): UsePublicSplitGuestIdentityReturn {
  const { activeId, setActiveId, clearActive } = useGuestIdentityStore("split", token);

  return {
    activeParticipantId: activeId,
    setActiveParticipantId: setActiveId,
    clearActiveParticipant: clearActive,
  };
}
