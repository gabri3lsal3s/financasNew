export const UPDATE_DISMISSED_SESSION_KEY = "financas:update_dismissed_session";
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

let inMemoryDismissed = false;

/**
 * Avalia se o aviso de atualização foi dispensado pelo usuário na sessão atual (sessionStorage).
 * Garante que o pop-up não volte a incomodar durante o uso contínuo do app na mesma sessão,
 * mas reapareça caso o usuário feche e entre no aplicativo novamente em uma nova sessão.
 */
export function isUpdateDismissedForSession(): boolean {
  if (inMemoryDismissed) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage?.getItem(UPDATE_DISMISSED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persiste a dispensa da notificação de atualização para a sessão atual
 * gravando flag no sessionStorage (e em memória para WebView nativa)
 * e registrando o timestamp no localStorage para auditoria/telemetria.
 */
export function dismissUpdateForSession(now: number = Date.now()): void {
  inMemoryDismissed = true;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(UPDATE_DISMISSED_SESSION_KEY, "true");
    window.localStorage?.setItem(UPDATE_DISMISSED_SESSION_KEY, String(now));
  } catch {
    // Storage inacessível
  }
}

/**
 * Reseta o estado de dispensa da notificação de atualização (útil para testes ou logout).
 */
export function resetUpdateDismissedForSession(): void {
  inMemoryDismissed = false;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.removeItem(UPDATE_DISMISSED_SESSION_KEY);
    window.localStorage?.removeItem(UPDATE_DISMISSED_SESSION_KEY);
  } catch {
    // Storage inacessível
  }
}
