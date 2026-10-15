import { App } from "@capacitor/app";
import { getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import { authenticateWithBiometrics } from "./biometrics";
import { disablePrivacyShield, enablePrivacyShield } from "./privacy-shield";
import { isNativePlatform } from "./platform";

const KEY_BIOMETRIC_LOCK = "biometric_lock_enabled";
const KEY_TIMEOUT = "biometric_lock_timeout_minutes";
const KEY_PRIVACY_SHIELD = "privacy_shield_enabled";

/**
 * Lê se o bloqueio por biometria está ativado pelo usuário.
 */
export function isBiometricLockEnabled(userId?: string | null): boolean {
  return getUserStorageItem(KEY_BIOMETRIC_LOCK, userId) === "true";
}

/**
 * Atualiza a preferência de bloqueio por biometria.
 */
export function setBiometricLockEnabled(enabled: boolean, userId?: string | null): void {
  setUserStorageItem(KEY_BIOMETRIC_LOCK, String(enabled), userId);
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
 * Lê se o Privacy Shield (FLAG_SECURE) está ativado. No nativo, padrão é true.
 */
export function isPrivacyShieldEnabled(userId?: string | null): boolean {
  const val = getUserStorageItem(KEY_PRIVACY_SHIELD, userId);
  if (val === null) return isNativePlatform();
  return val === "true";
}

/**
 * Define e sincroniza o Privacy Shield.
 */
export function setPrivacyShieldEnabled(enabled: boolean, userId?: string | null): void {
  setUserStorageItem(KEY_PRIVACY_SHIELD, String(enabled), userId);
  if (enabled) {
    void enablePrivacyShield();
  } else {
    void disablePrivacyShield();
  }
  notifyLockListeners();
}

// ---------- Estado Reativo de Bloqueio em Memória ----------

let isLocked = false;
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
    setAppLocked(false);
    return true;
  }
  return false;
}

// ---------- Monitoramento de Segundo Plano (AppStateChange) ----------

let lastBackgroundTime = 0;
let isListenerActive = false;

/**
 * Inicializa o monitoramento de ciclo de vida do app nativo.
 * Ao retornar do background após a tolerância configurada, bloqueia o app.
 */
export function initAppLockListener(): () => void {
  // Sincroniza o Privacy Shield na inicialização
  if (isPrivacyShieldEnabled()) {
    void enablePrivacyShield();
  }

  if (!isNativePlatform() || isListenerActive) {
    return () => {};
  }

  isListenerActive = true;
  const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) {
      lastBackgroundTime = Date.now();
    } else {
      if (isBiometricLockEnabled()) {
        const timeoutMinutes = getBiometricLockTimeoutMinutes();
        const timeoutMs = timeoutMinutes * 60 * 1000;
        if (Date.now() - lastBackgroundTime >= timeoutMs) {
          setAppLocked(true);
        }
      }
    }
  });

  return () => {
    isListenerActive = false;
    void listenerPromise.then((handle) => handle.remove());
  };
}
