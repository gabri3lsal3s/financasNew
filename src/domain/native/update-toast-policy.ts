export const UPDATE_DISMISSED_SESSION_KEY = "financas:update_dismissed_session";
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/**
 * Avalia se o aviso de atualização nativa foi dispensado pelo usuário
 * na sessão atual (sessionStorage) ou dentro da janela de tolerância de 12 horas (localStorage).
 */
export function isUpdateDismissedForSession(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage?.getItem(UPDATE_DISMISSED_SESSION_KEY) === "true") {
      return true;
    }
    const stored = window.localStorage?.getItem(UPDATE_DISMISSED_SESSION_KEY);
    if (stored) {
      const ts = Number(stored);
      if (!Number.isNaN(ts) && now - ts < TWELVE_HOURS_MS) {
        return true;
      }
    }
  } catch {
    // Storage inacessível
  }
  return false;
}

/**
 * Persiste a dispensa da notificação de atualização para a sessão atual
 * gravando flag no sessionStorage e timestamp no localStorage.
 */
export function dismissUpdateForSession(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(UPDATE_DISMISSED_SESSION_KEY, "true");
    window.localStorage?.setItem(UPDATE_DISMISSED_SESSION_KEY, String(now));
  } catch {
    // Storage inacessível
  }
}

/**
 * Reseta o estado de dispensa da notificação de atualização (útil para testes).
 */
export function resetUpdateDismissedForSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.removeItem(UPDATE_DISMISSED_SESSION_KEY);
    window.localStorage?.removeItem(UPDATE_DISMISSED_SESSION_KEY);
  } catch {
    // Storage inacessível
  }
}
