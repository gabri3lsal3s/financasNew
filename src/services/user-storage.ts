/**
 * Utilitário de isolamento de armazenamento local por usuário (localStorage).
 * Garante que preferências de dispositivo fiquem restritas ao userId ativo,
 * impedindo vazamento de preferências ou configurações entre contas no mesmo navegador.
 */

const ACTIVE_USER_ID_STORAGE_KEY = "financas_active_user_id";

function getInitialActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_USER_ID_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

let activeUserId: string | null = getInitialActiveUserId();
const userListeners = new Set<(userId: string | null) => void>();

export function getActiveUserId(): string | null {
  if (activeUserId) return activeUserId;
  return getInitialActiveUserId();
}

export function setActiveUserId(userId: string | null): void {
  if (activeUserId !== userId) {
    const prevUserId = activeUserId;
    activeUserId = userId;

    if (typeof window !== "undefined") {
      try {
        if (userId) {
          window.localStorage.setItem(ACTIVE_USER_ID_STORAGE_KEY, userId);
        } else {
          window.localStorage.removeItem(ACTIVE_USER_ID_STORAGE_KEY);
        }
      } catch {
        // no-op
      }
    }

    // Se estiver transitando de visitante (null) para um usuário autenticado (userId):
    // Herda as preferências visuais ativas (tema, acento, superfície, movimento)
    // para que a interface não sofra alterações bruscas de tema ou cor durante login/checkout.
    if (!prevUserId && userId && typeof window !== "undefined") {
      try {
        SYNCED_BOOT_KEYS.forEach((key) => {
          const userKey = `financas_${userId}_${key}`;
          if (window.localStorage.getItem(userKey) === null) {
            const activeVal =
              window.localStorage.getItem(`financas_active_${key}`) ||
              window.localStorage.getItem(`financas_guest_${key}`);
            if (activeVal !== null) {
              window.localStorage.setItem(userKey, activeVal);
            }
          }
        });
      } catch {
        // no-op
      }
    }

    userListeners.forEach((listener) => listener(activeUserId));
  }
}

export function subscribeActiveUserId(listener: (userId: string | null) => void): () => void {
  userListeners.add(listener);
  return () => {
    userListeners.delete(listener);
  };
}

const SYNCED_BOOT_KEYS = [
  "theme",
  "accent_theme",
  "surface_style",
  "motion_level",
];

export function getUserStorageKey(key: string, userId?: string | null): string {
  const uid = userId !== undefined ? userId : activeUserId;
  return uid ? `financas_${uid}_${key}` : `financas_guest_${key}`;
}

export function getUserStorageItem(key: string, userId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fullKey = getUserStorageKey(key, userId);
    const value = window.localStorage.getItem(fullKey);
    if (value !== null) return value;

    // Se estiver sem usuário ativo e a chave for de bootstrap visual, usa o espelho ativo
    if ((userId === undefined || userId === null) && !activeUserId && SYNCED_BOOT_KEYS.includes(key)) {
      return window.localStorage.getItem(`financas_active_${key}`);
    }
    return null;
  } catch {
    return null;
  }
}

export function setUserStorageItem(key: string, value: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const fullKey = getUserStorageKey(key, userId);
    window.localStorage.setItem(fullKey, value);

    if (SYNCED_BOOT_KEYS.includes(key)) {
      window.localStorage.setItem(`financas_active_${key}`, value);
    }
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
  ];

  for (const key of legacyKeys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // no-op
    }
  }
}
