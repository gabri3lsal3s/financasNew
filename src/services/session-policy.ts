import { getUserStorageItem, setUserStorageItem } from "@/services/user-storage";

export type IdleLogoutPolicy = "never" | "15m" | "30m" | "60m" | "240m";

export const IDLE_LOGOUT_POLICY_STORAGE_KEY = "idle_logout_policy";
export const SHARED_DEVICE_SESSION_KEY = "axir_shared_device_session";

const VALID_POLICIES: ReadonlySet<IdleLogoutPolicy> = new Set([
  "never",
  "15m",
  "30m",
  "60m",
  "240m",
]);

export const IDLE_LOGOUT_POLICY_MS: Record<IdleLogoutPolicy, number | null> = {
  never: null,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "60m": 60 * 60 * 1000,
  "240m": 240 * 60 * 1000,
};

/**
 * Converte uma política de inatividade em milissegundos (ou `null` quando `"never"`).
 */
export function resolveIdlePolicyMs(policy: IdleLogoutPolicy): number | null {
  return IDLE_LOGOUT_POLICY_MS[policy] ?? null;
}

/**
 * Lê a preferência persistida de encerramento por inatividade para este dispositivo/usuário.
 * Padrão: `"never"` (manter conectado em dispositivo pessoal).
 */
export function getIdleLogoutPolicy(userId?: string | null): IdleLogoutPolicy {
  const raw = getUserStorageItem(IDLE_LOGOUT_POLICY_STORAGE_KEY, userId);
  if (raw && VALID_POLICIES.has(raw as IdleLogoutPolicy)) {
    return raw as IdleLogoutPolicy;
  }
  return "never";
}

/**
 * Salva a preferência de encerramento por inatividade para este dispositivo/usuário.
 */
export function setIdleLogoutPolicy(
  policy: IdleLogoutPolicy,
  userId?: string | null,
): void {
  if (!VALID_POLICIES.has(policy)) return;
  setUserStorageItem(IDLE_LOGOUT_POLICY_STORAGE_KEY, policy, userId);
}

/**
 * Marca ou remove a flag efêmera de "Computador compartilhado" em `sessionStorage`.
 * É limpa automaticamente no logout via `resetAppState()` (`sessionStorage.clear()`).
 */
export function setSharedDeviceSession(enabled: boolean): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      if (enabled) {
        window.sessionStorage.setItem(SHARED_DEVICE_SESSION_KEY, "1");
      } else {
        window.sessionStorage.removeItem(SHARED_DEVICE_SESSION_KEY);
      }
    } catch {
      // no-op em ambiente restrito
    }
  }
  sharedModeListeners.forEach((listener) => listener(enabled));
}

/**
 * Indica se a sessão atual foi iniciada no modo "Computador compartilhado".
 */
const sharedModeListeners = new Set<(enabled: boolean) => void>();

export function subscribeSharedDeviceSessionChange(
  listener: (enabled: boolean) => void,
): () => void {
  sharedModeListeners.add(listener);
  return () => {
    sharedModeListeners.delete(listener);
  };
}

export function isSharedDeviceSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!window.sessionStorage) return true;
    return window.sessionStorage.getItem(SHARED_DEVICE_SESSION_KEY) === "1";
  } catch {
    // Falha de storage nunca promove para modo pessoal (fail-closed para efêmero)
    return true;
  }
}

/**
 * Retorna a política efetiva de inatividade:
 * se o modo "Computador compartilhado" estiver ativo nesta sessão, sobrepõe `"never"` para `"30m"`
 * (ou mantém a política mais restritiva se o usuário já configurou `"15m"`).
 */
export function getEffectiveIdleLogoutPolicy(userId?: string | null): IdleLogoutPolicy {
  const saved = getIdleLogoutPolicy(userId);
  if (!isSharedDeviceSession()) {
    return saved;
  }
  const savedMs = resolveIdlePolicyMs(saved);
  const sharedMs = resolveIdlePolicyMs("30m")!;
  if (savedMs !== null && savedMs < sharedMs) {
    return saved;
  }
  return "30m";
}
