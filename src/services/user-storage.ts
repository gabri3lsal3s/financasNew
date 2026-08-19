/**
 * Utilitário de isolamento de armazenamento local por usuário (localStorage).
 * Garante que preferências de dispositivo fiquem restritas ao userId ativo,
 * impedindo vazamento de preferências ou configurações entre contas no mesmo navegador.
 */

let activeUserId: string | null = null;
const userListeners = new Set<(userId: string | null) => void>();

export function getActiveUserId(): string | null {
  return activeUserId;
}

export function setActiveUserId(userId: string | null): void {
  if (activeUserId !== userId) {
    activeUserId = userId;
    userListeners.forEach((listener) => listener(activeUserId));
  }
}

export function subscribeActiveUserId(listener: (userId: string | null) => void): () => void {
  userListeners.add(listener);
  return () => {
    userListeners.delete(listener);
  };
}

export function getUserStorageKey(key: string, userId?: string | null): string {
  const uid = userId !== undefined ? userId : activeUserId;
  return uid ? `financas_${uid}_${key}` : `financas_guest_${key}`;
}

export function getUserStorageItem(key: string, userId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fullKey = getUserStorageKey(key, userId);
    return window.localStorage.getItem(fullKey);
  } catch {
    return null;
  }
}

export function setUserStorageItem(key: string, value: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const fullKey = getUserStorageKey(key, userId);
    window.localStorage.setItem(fullKey, value);
  } catch {
    // quota exceeded or storage disabled
  }
}

export function removeUserStorageItem(key: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const fullKey = getUserStorageKey(key, userId);
    window.localStorage.removeItem(fullKey);
  } catch {
    // no-op
  }
}

/**
 * Remove chaves legadas e despadronizadas sem namespace de usuário
 * para evitar que dados antigos vazem ou poluam sessões futuras.
 */
export function sanitizeLegacyStorage(): void {
  if (typeof window === "undefined") return;
  const legacyKeys = [
    "financas:theme",
    "financas_density",
    "financas_sidebar_collapsed",
    "financas_accent_theme",
    "financas_surface_style",
    "financas_motion_level",
    "financas_sound_enabled",
    "financas_haptic_enabled",
    "financas_disabled_sensory_intents",
    "financas_number_ticker_enabled",
    "financas_dashboard_widgets",
    "financas_header_buttons",
    "financas_guest_theme",
    "financas_guest_density",
    "financas_guest_sidebar_collapsed",
    "financas_guest_accent",
  ];

  for (const key of legacyKeys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // no-op
    }
  }
}
