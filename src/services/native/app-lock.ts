import { App } from "@capacitor/app";
import { getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import { isBiometricAuthInProgress, authenticateWithBiometrics } from "./biometrics";
import { disablePrivacyShield, enablePrivacyShield } from "./privacy-shield";
import { isNativePlatform } from "./platform";

const KEY_BIOMETRIC_LOCK = "biometric_lock_enabled";
const KEY_TIMEOUT = "biometric_lock_timeout_minutes";
const KEY_PRIVACY_SHIELD = "privacy_shield_enabled";

/**
 * Lê se o bloqueio por biometria está ativado pelo usuário.
 */
export function isBiometricLockEnabled(userId?: string | null): boolean {
  const direct = getUserStorageItem(KEY_BIOMETRIC_LOCK, userId);
  if (direct !== null) return direct === "true";

  if (typeof window !== "undefined") {
    try {
      const activeVal = window.localStorage.getItem(`financas_active_${KEY_BIOMETRIC_LOCK}`);
      if (activeVal !== null) return activeVal === "true";

      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("financas_") && k.endsWith(`_${KEY_BIOMETRIC_LOCK}`)) {
          return window.localStorage.getItem(k) === "true";
        }
      }
    } catch {
      // no-op
    }
  }
  return false;
}

/**
 * Atualiza a preferência de bloqueio por biometria.
 */
export function setBiometricLockEnabled(enabled: boolean, userId?: string | null): void {
  setUserStorageItem(KEY_BIOMETRIC_LOCK, String(enabled), userId);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`financas_active_${KEY_BIOMETRIC_LOCK}`, String(enabled));
    } catch {
      // no-op
    }
  }
  notifyLockListeners();
}

/**
 * Retorna o tempo de tolerância em minutos antes de exigir biometria ao retornar (padrão: 1 min).
 */
export function getBiometricLockTimeoutMinutes(userId?: string | null): number {
  const val = getUserStorageItem(KEY_TIMEOUT, userId);
  if (val === null) return 1;
  const parsed = Number(val);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

/**
 * Define o tempo de tolerância em minutos antes do bloqueio (0 = imediato).
 */
export function setBiometricLockTimeoutMinutes(minutes: number, userId?: string | null): void {
  setUserStorageItem(KEY_TIMEOUT, String(minutes), userId);
  notifyLockListeners();
}

export const getAppLockGraceMinutes = getBiometricLockTimeoutMinutes;
export const setAppLockGraceMinutes = setBiometricLockTimeoutMinutes;

/**
 * Lê se o Privacy Shield (FLAG_SECURE) está ativado.
 * Padrão: false (desativado por padrão para viabilizar capturas de tela e comprovantes).
 * Ativado exclusivamente quando o usuário ligar a opção nas configurações de segurança.
 */
export function isPrivacyShieldEnabled(userId?: string | null): boolean {
  const direct = getUserStorageItem(KEY_PRIVACY_SHIELD, userId);
  if (direct !== null) return direct === "true";

  if (typeof window !== "undefined") {
    try {
      const activeVal = window.localStorage.getItem(`financas_active_${KEY_PRIVACY_SHIELD}`);
      if (activeVal !== null) return activeVal === "true";
    } catch {
      // no-op
    }
  }
  return false;
}

/**
 * Define e sincroniza o Privacy Shield com armazenamento local e chave ativa espelhada.
 */
export function setPrivacyShieldEnabled(enabled: boolean, userId?: string | null): void {
  setUserStorageItem(KEY_PRIVACY_SHIELD, String(enabled), userId);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`financas_active_${KEY_PRIVACY_SHIELD}`, String(enabled));
      window.localStorage.setItem(`financas_guest_${KEY_PRIVACY_SHIELD}`, String(enabled));
    } catch {
      // no-op
    }
  }
  if (enabled) {
    void enablePrivacyShield();
  } else {
    void disablePrivacyShield();
  }
  notifyLockListeners();
}

/**
 * Sincroniza o Privacy Shield nativo com base na preferência salva.
 * Garante que tanto a ativação quanto a desativação sejam despachadas para o container nativo.
 */
export function syncPrivacyShield(userId?: string | null): void {
  if (isPrivacyShieldEnabled(userId)) {
    void enablePrivacyShield();
  } else {
    void disablePrivacyShield();
  }
}

// ---------- Estado Reativo de Bloqueio em Memória ----------

// No cold start nativo, inicializa já travado se o usuário habilitou o bloqueio biométrico
let isLocked = typeof window !== "undefined" && isNativePlatform() && isBiometricLockEnabled();
const lockListeners = new Set<() => void>();

function notifyLockListeners(): void {
  for (const listener of lockListeners) {
    listener();
  }
}

export function isAppLocked(): boolean {
  return isLocked;
}

export function setAppLocked(locked: boolean): void {
  if (isLocked === locked) return;
  isLocked = locked;
  if (!locked) {
    lastBackgroundTime = 0;
  }
  notifyLockListeners();
}

export function subscribeAppLock(listener: () => void): () => void {
  lockListeners.add(listener);
  return () => {
    lockListeners.delete(listener);
  };
}

/**
 * Tenta desbloquear o app solicitando biometria ao usuário.
 */
export async function unlockAppWithBiometrics(): Promise<boolean> {
  const result = await authenticateWithBiometrics("Desbloqueie o aplicativo para acessar seus dados");
  if (result.success) {
    lastBackgroundTime = 0;
    setAppLocked(false);
    return true;
  }
  return false;
}

// ---------- Monitoramento de Segundo Plano (AppStateChange) ----------

let lastBackgroundTime = 0;
let isListenerActive = false;

/**
 * Redefine o timestamp de início de segundo plano.
 */
export function resetAppLockBackgroundTimer(): void {
  lastBackgroundTime = 0;
}

/**
 * Inicializa o monitoramento de ciclo de vida do app nativo.
 * Ao retornar do background após a tolerância configurada, bloqueia o app.
 */
export function initAppLockListener(): () => void {
  // Sincroniza o Privacy Shield na inicialização (ativa ou desativa ativamente)
  syncPrivacyShield();

  // No cold start nativo, se a biometria estiver ativa, garante o bloqueio imediato
  if (isNativePlatform() && isBiometricLockEnabled()) {
    setAppLocked(true);
  }

  if (!isNativePlatform() || isListenerActive) {
    return () => {};
  }

  isListenerActive = true;
  const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
    // Se a autenticação biométrica nativa está em andamento (ou na janela de retorno),
    // a alternância de foco da janela não representa uma saída real do aplicativo.
    if (isBiometricAuthInProgress()) {
      return;
    }

    if (!isActive) {
      lastBackgroundTime = Date.now();
    } else {
      if (lastBackgroundTime > 0 && isBiometricLockEnabled()) {
        const timeoutMinutes = getBiometricLockTimeoutMinutes();
        const timeoutMs = timeoutMinutes * 60 * 1000;
        if (Date.now() - lastBackgroundTime >= timeoutMs) {
          setAppLocked(true);
        }
      }
      lastBackgroundTime = 0;
    }
  });

  return () => {
    isListenerActive = false;
    void listenerPromise?.then?.((handle) => handle?.remove?.());
  };
}
