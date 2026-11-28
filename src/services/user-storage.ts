/**
 * Utilitário de isolamento de armazenamento local por usuário (localStorage).
 * Garante que preferências de dispositivo fiquem restritas ao userId ativo,
 * impedindo vazamento de preferências ou configurações entre contas no mesmo navegador.
 */

const ACTIVE_USER_ID_STORAGE_KEY = "financas_active_user_id";
const ADMIN_ACTIVE_USER_ID_STORAGE_KEY = "financas_admin_active_user_id";
const TAB_ISOLATED_STORAGE_KEY = "axir_tab_isolated";
const ADMIN_PORTAL_TAB_STORAGE_KEY = "axir_admin_portal_tab";

export function isAdminPortalContext(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage?.getItem(ADMIN_PORTAL_TAB_STORAGE_KEY) === "1") {
      return true;
    }
    const pathname = window.location.pathname || "";
    const portalParam = new URLSearchParams(window.location.search || "").get("portal");
    if (pathname.startsWith("/admin") || portalParam === "admin") {
      window.sessionStorage?.setItem(ADMIN_PORTAL_TAB_STORAGE_KEY, "1");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function markAdminPortalTab(enabled = true): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.sessionStorage?.setItem(ADMIN_PORTAL_TAB_STORAGE_KEY, "1");
    } else {
      window.sessionStorage?.removeItem(ADMIN_PORTAL_TAB_STORAGE_KEY);
    }
  } catch {
    // no-op
  }
}

export function isTabIsolatedSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage?.getItem(TAB_ISOLATED_STORAGE_KEY) === "1") {
      return true;
    }
    return new URLSearchParams(window.location.search).has("tab_intent");
  } catch {
    return false;
  }
}

export function markTabIsolatedSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(TAB_ISOLATED_STORAGE_KEY, "1");
  } catch {
    // no-op
  }
}

function getInitialActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (isAdminPortalContext()) {
      return window.sessionStorage?.getItem(ADMIN_ACTIVE_USER_ID_STORAGE_KEY) || null;
    }
    if (isTabIsolatedSession()) {
      return window.sessionStorage?.getItem(ACTIVE_USER_ID_STORAGE_KEY) || null;
    }
    return window.localStorage.getItem(ACTIVE_USER_ID_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

let activeUserId: string | null = getInitialActiveUserId();
let hasInitializedActiveUserId = typeof window !== "undefined";
const userListeners = new Set<(userId: string | null) => void>();

export function getActiveUserId(): string | null {
  if (hasInitializedActiveUserId) return activeUserId;
  activeUserId = getInitialActiveUserId();
  hasInitializedActiveUserId = typeof window !== "undefined";
  return activeUserId;
}

export function setActiveUserId(userId: string | null): void {
  hasInitializedActiveUserId = true;
  if (activeUserId !== userId) {
    const prevUserId = activeUserId;
    activeUserId = userId;

    if (typeof window !== "undefined") {
      try {
        if (isAdminPortalContext()) {
          if (userId) {
            window.sessionStorage?.setItem(ADMIN_ACTIVE_USER_ID_STORAGE_KEY, userId);
          } else {
            window.sessionStorage?.removeItem(ADMIN_ACTIVE_USER_ID_STORAGE_KEY);
          }
        } else if (isTabIsolatedSession()) {
          if (userId) {
            window.sessionStorage?.setItem(ACTIVE_USER_ID_STORAGE_KEY, userId);
          } else {
            window.sessionStorage?.removeItem(ACTIVE_USER_ID_STORAGE_KEY);
          }
        } else if (userId) {
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
        [...SYNCED_BOOT_KEYS, "accent_theme"].forEach((key) => {
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

    // Se estiver deslogando (prevUserId para null):
    // Preserva as preferências ergonômicas de exibição (tema, movimento) no estado guest/active,
    // mas limpa a cor de destaque (accent) da conta anterior para manter a marca oficial Axir (Teal Vital) nas telas de login/cadastro.
    if (prevUserId && !userId && typeof window !== "undefined") {
      try {
        SYNCED_BOOT_KEYS.forEach((key) => {
          const userVal = window.localStorage.getItem(`financas_${prevUserId}_${key}`);
          if (userVal !== null) {
            window.localStorage.setItem(`financas_guest_${key}`, userVal);
            window.localStorage.setItem(`financas_active_${key}`, userVal);
          }
        });
        window.localStorage.removeItem("financas_guest_accent_theme");
        window.localStorage.removeItem("financas_active_accent_theme");
        if (typeof document !== "undefined") {
          document.documentElement.removeAttribute("data-accent");
        }
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
  "dark_theme_variant",
  "theme_schedule",
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

    // Se estiver sem usuário ativo e a chave for de bootstrap visual, usa o espelho ativo do dispositivo
    if ((userId === undefined || userId === null) && !activeUserId && SYNCED_BOOT_KEYS.includes(key)) {
      return (
        window.localStorage.getItem(`financas_active_${key}`) ||
        window.localStorage.getItem(`financas_guest_${key}`)
      );
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
 * Expurga seletivamente todas as chaves de armazenamento local pertencentes
 * exclusivamente à conta informada (`financas_<accountKey>_*`), preservando
 * integralmente os dados e preferências de quaisquer outras contas.
 */
export function purgeAccountStorage(accountKey: string): number {
  if (typeof window === "undefined") return 0;
  const normalizedKey = accountKey.trim();
  if (!normalizedKey || normalizedKey === "guest" || normalizedKey === "active") {
    return 0;
  }

  const underscorePrefix = `financas_${normalizedKey}_`;
  const colonPrefix = `financas:${normalizedKey}:`;
  let removedCount = 0;

  try {
    const keysToRemove: string[] = [];
    for (let idx = 0; idx < window.localStorage.length; idx += 1) {
      const storageKey = window.localStorage.key(idx);
      if (
        storageKey !== null &&
        (storageKey.startsWith(underscorePrefix) || storageKey.startsWith(colonPrefix))
      ) {
        keysToRemove.push(storageKey);
      }
    }

    for (const storageKey of keysToRemove) {
      window.localStorage.removeItem(storageKey);
      removedCount += 1;
    }

    if (getActiveUserId() === normalizedKey) {
      activeUserId = null;
      window.sessionStorage?.removeItem(ADMIN_ACTIVE_USER_ID_STORAGE_KEY);
      window.sessionStorage?.removeItem(ACTIVE_USER_ID_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_USER_ID_STORAGE_KEY);
      window.localStorage.removeItem("financas_active_accent_theme");
      window.localStorage.removeItem("financas_active_biometric_lock_enabled");
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-accent");
      }
      userListeners.forEach((listener) => listener(null));
    }
  } catch {
    // no-op em ambientes com storage restrito
  }

  return removedCount;
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
    "financas:onboarding_dismissed",
    "axis_smart_advisor_dismissals",
    "axis_smart_advisor_last_dismissed_day",
    "axis_smart_advisor_dismissals_v1",
    "axis_smart_advisor_last_dismissed_day_v1",
    "financasnew:dashboard_alert_dismissals",
    "axir_dashboard_alert_dismissals_v1",
  ];

  for (const key of legacyKeys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // no-op
    }
  }
}
