/**
 * Hook de persistência da identidade do participante convidado em links públicos (/viagem/:token).
 * Delega ao store unificado `useGuestIdentityStore("trip", token)`.
 */

import {
  GUEST_IDENTITY_STORAGE_PREFIXES,
  getGuestIdentityStorageKey,
  useGuestIdentityStore,
} from "./use-guest-identity-store";

export const GUEST_MEMBER_STORAGE_KEY_PREFIX = GUEST_IDENTITY_STORAGE_PREFIXES.trip;

export function getPublicTripGuestStorageKey(token: string): string {
  return getGuestIdentityStorageKey("trip", token);
}

export interface UsePublicTripGuestIdentityReturn {
  activeMemberId: string | null;
  setActiveMemberId: (id: string | null) => void;
  clearActiveMember: () => void;
}

export function usePublicTripGuestIdentity(
  token?: string | null,
): UsePublicTripGuestIdentityReturn {
  const { activeId, setActiveId, clearActive } = useGuestIdentityStore("trip", token);

  return {
    activeMemberId: activeId,
    setActiveMemberId: setActiveId,
    clearActiveMember: clearActive,
  };
}
