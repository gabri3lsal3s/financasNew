import { App } from "@capacitor/app";
import { getActiveUserId, getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import { isBiometricAuthInProgress, authenticateWithBiometrics } from "./biometrics";
import { disablePrivacyShield, enablePrivacyShield } from "./privacy-shield";
import { isNativePlatform } from "./platform";
import { clearPinLockout, isPinLockConfigured } from "./pin-lock";
import { isNativeExportInProgress } from "./native-export";

const KEY_BIOMETRIC_LOCK = "biometric_lock_enabled";
const KEY_APP_LOCK_ENABLED = "app_lock_enabled";
const KEY_APP_LOCK_METHOD = "app_lock_method";
const KEY_APP_LOCK_IDLE_ENABLED = "app_lock_idle_enabled";
const KEY_TIMEOUT = "biometric_lock_timeout_minutes";
const KEY_PRIVACY_SHIELD = "privacy_shield_enabled";

export type AppLockMethod = "biometrics" | "pin" | "biometrics_or_pin";

export interface AppLockConfig {
  enabled: boolean;
  method: AppLockMethod;
  graceMinutes: number;
  lockOnIdle: boolean;
}

const APP_LOCK_IDLE_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

function readLegacyBiometricFlag(userId?: string | null): boolean | null {
  const direct = getUserStorageItem(KEY_BIOMETRIC_LOCK, userId);
  if (direct !== null) return direct === "true";

  if (typeof window !== "undefined") {
    try {
      const activeVal = window.localStorage.getItem(`financas_active_${KEY_BIOMETRIC_LOCK}`);
      if (activeVal !== null) return activeVal === "true";
    } catch {
      // no-op
    }
  }
  return null;
}

function resolveDefaultMethod(userId?: string | null): AppLockMethod {
  if (isNativePlatform()) {
    return isPinLockConfigured(userId) ? "biometrics_or_pin" : "biometrics";
  }
  return isPinLockConfigured(userId) ? "pin" : "biometrics";
}

/**
 * Lê a configuração completa do bloqueio local do dispositivo, migrando transparentemente
 * a chave legada `biometric_lock_enabled` quando encontrada.
 */
export function getAppLockConfig(userId?: string | null): AppLockConfig {
  const storedEnabled = getUserStorageItem(KEY_APP_LOCK_ENABLED, userId);
  let enabled = false;

  if (storedEnabled !== null) {
    enabled = storedEnabled === "true";
  } else {
    const legacyEnabled = readLegacyBiometricFlag(userId);
    if (legacyEnabled !== null) {
      enabled = legacyEnabled;
      setUserStorageItem(KEY_APP_LOCK_ENABLED, String(legacyEnabled), userId);
    }
  }

  const rawMethod = getUserStorageItem(KEY_APP_LOCK_METHOD, userId);
  const method: AppLockMethod =
    rawMethod === "biometrics" || rawMethod === "pin" || rawMethod === "biometrics_or_pin"
      ? rawMethod
      : resolveDefaultMethod(userId);

  const graceMinutes = getAppLockGraceMinutes(userId);

  const rawIdle = getUserStorageItem(KEY_APP_LOCK_IDLE_ENABLED, userId);
  const lockOnIdle = rawIdle !== null ? rawIdle === "true" : true;

  return {
    enabled,
    method,
    graceMinutes,
    lockOnIdle,
  };
}

/**
 * Atualiza parcialmente a configuração do bloqueio local e sincroniza chaves espelhadas.
 */
export function setAppLockConfig(
  partial: Partial<AppLockConfig>,
  userId?: string | null,
): void {
  if (partial.enabled !== undefined) {
    setUserStorageItem(KEY_APP_LOCK_ENABLED, String(partial.enabled), userId);
    setUserStorageItem(KEY_BIOMETRIC_LOCK, String(partial.enabled), userId);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          `financas_active_${KEY_BIOMETRIC_LOCK}`,
          String(partial.enabled),
        );
      } catch {
        // no-op
      }
    }
  }

  if (partial.method !== undefined) {
    setUserStorageItem(KEY_APP_LOCK_METHOD, partial.method, userId);
  }

  if (partial.graceMinutes !== undefined) {
    setUserStorageItem(KEY_TIMEOUT, String(partial.graceMinutes), userId);
  }

  if (partial.lockOnIdle !== undefined) {
    setUserStorageItem(KEY_APP_LOCK_IDLE_ENABLED, String(partial.lockOnIdle), userId);
  }

  scheduleIdleLockCheck();
  notifyLockListeners();
}

/**
 * Lê se o bloqueio do aplicativo (biometria ou PIN) está ativado pelo usuário.
 */
export function isBiometricLockEnabled(userId?: string | null): boolean {
  return getAppLockConfig(userId).enabled;
}

/**
 * Atualiza a preferência de bloqueio do aplicativo.
 */
export function setBiometricLockEnabled(enabled: boolean, userId?: string | null): void {
  setAppLockConfig({ enabled }, userId);
}

/**
 * Retorna o tempo de tolerância em minutos antes de exigir desbloqueio ao retornar (padrão: 1 min).
 */
export function getAppLockGraceMinutes(userId?: string | null): number {
  const val = getUserStorageItem(KEY_TIMEOUT, userId);
  if (val === null) return 1;
  const parsed = Number(val);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

/**
 * Define o tempo de tolerância em minutos antes do bloqueio (0 = imediato).
 */
export function setAppLockGraceMinutes(minutes: number, userId?: string | null): void {
  setAppLockConfig({ graceMinutes: minutes }, userId);
}

/**
 * Lê se o Privacy Shield (FLAG_SECURE) está ativado.
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
 */
export function syncPrivacyShield(userId?: string | null): void {
  if (isPrivacyShieldEnabled(userId)) {
    void enablePrivacyShield();
  } else {
    void disablePrivacyShield();
  }
}

function hasActiveSessionContext(userId?: string | null): boolean {
  if (userId) return true;
  if (getActiveUserId()) return true;
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(`financas_active_${KEY_BIOMETRIC_LOCK}`) === "true") {
        return true;
      }
    } catch {
      // no-op
    }
  }
  return false;
}

/**
 * Indica se o aplicativo deve inicializar travado no cold start.
 * Só retorna true quando há sessão ativa e método válido configurado.
 */
export function shouldLockOnColdStart(userId?: string | null): boolean {
  if (!hasActiveSessionContext(userId)) return false;
  const config = getAppLockConfig(userId);
  if (!config.enabled) return false;
  if (isNativePlatform()) return true;
  return isPinLockConfigured(userId);
}

// ---------- Estado Reativo de Bloqueio em Memória ----------

let isLocked = typeof window !== "undefined" && shouldLockOnColdStart();
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
    lastInteractionAt = Date.now();
    scheduleIdleLockCheck();
  } else {
    clearIdleLockTimer();
  }
  notifyLockListeners();
}

export function subscribeAppLock(listener: () => void): () => void {
  lockListeners.add(listener);
  return () => {
    lockListeners.delete(listener);
  };
}

let pendingRouteAfterUnlock: string | null = null;

export function setPendingRouteAfterUnlock(route: string | null): void {
  pendingRouteAfterUnlock = route;
}

export function getPendingRouteAfterUnlock(): string | null {
  return pendingRouteAfterUnlock;
}

/**
 * Tenta desbloquear o app solicitando biometria ao usuário.
 */
export async function unlockAppWithBiometrics(): Promise<boolean> {
  const result = await authenticateWithBiometrics("Desbloqueie o aplicativo para acessar seus dados");
  if (result.success) {
    lastBackgroundTime = 0;
    clearPinLockout(getActiveUserId());
    setAppLocked(false);
    return true;
  }
  return false;
}

// ---------- Monitoramento de Segundo Plano e Inatividade em Tela Aberta ----------

let lastBackgroundTime = 0;
let lastInteractionAt = 0;
let idleLockTimer: ReturnType<typeof setTimeout> | null = null;
let isIdleLockPaused = false;
let isListenerActive = false;

function clearIdleLockTimer(): void {
  if (idleLockTimer !== null) {
    clearTimeout(idleLockTimer);
    idleLockTimer = null;
  }
}

/**
 * Pausa ou retoma o disparo de `lockOnIdle` (ex.: enquanto o modal de aviso de sessão estiver aberto).
 */
export function setAppLockIdlePaused(paused: boolean): void {
  isIdleLockPaused = paused;
  if (!paused) {
    lastInteractionAt = Date.now();
    scheduleIdleLockCheck();
  } else {
    clearIdleLockTimer();
  }
}

/**
 * Recalcula o bloqueio por inatividade com base exclusivamente em `Date.now() - lastInteractionAt`.
 */
export function evaluateIdleLock(nowMs = Date.now()): void {
  if (!isListenerActive || isLocked || isIdleLockPaused) return;
  if (isBiometricAuthInProgress() || isNativeExportInProgress()) return;

  const config = getAppLockConfig();
  if (!config.enabled || !config.lockOnIdle || config.graceMinutes <= 0) return;

  if (lastInteractionAt <= 0) {
    lastInteractionAt = nowMs;
    scheduleIdleLockCheck(nowMs);
    return;
  }

  const timeoutMs = config.graceMinutes * 60 * 1000;
  const elapsed = nowMs - lastInteractionAt;

  if (elapsed >= timeoutMs) {
    setAppLocked(true);
    return;
  }

  scheduleIdleLockCheck(nowMs);
}

function scheduleIdleLockCheck(nowMs = Date.now()): void {
  clearIdleLockTimer();
  if (!isListenerActive || isLocked || isIdleLockPaused) return;

  const config = getAppLockConfig();
  if (!config.enabled || !config.lockOnIdle || config.graceMinutes <= 0) return;

  if (lastInteractionAt <= 0) {
    lastInteractionAt = nowMs;
  }

  const timeoutMs = config.graceMinutes * 60 * 1000;
  const remainingMs = Math.max(0, lastInteractionAt + timeoutMs - nowMs);

  idleLockTimer = setTimeout(() => {
    evaluateIdleLock(Date.now());
  }, remainingMs);
}

/**
 * Redefine o timestamp de início de segundo plano e interação.
 */
export function resetAppLockBackgroundTimer(): void {
  lastBackgroundTime = 0;
  lastInteractionAt = Date.now();
  scheduleIdleLockCheck();
}

/**
 * Inicializa o monitoramento de ciclo de vida do app nativo e PWA / Web.
 * Ao retornar do background ou após inatividade em tela aberta superior à tolerância, bloqueia o app.
 */
export function initAppLockListener(): () => void {
  syncPrivacyShield();

  if (shouldLockOnColdStart()) {
    setAppLocked(true);
  }

  if (isListenerActive) {
    return () => {};
  }

  isListenerActive = true;
  lastInteractionAt = Date.now();
  scheduleIdleLockCheck();

  const handleUserInteraction = () => {
    if (isLocked) return;
    lastInteractionAt = Date.now();
    scheduleIdleLockCheck(lastInteractionAt);
  };

  if (typeof window !== "undefined") {
    for (const eventName of APP_LOCK_IDLE_EVENTS) {
      window.addEventListener(eventName, handleUserInteraction, { passive: true });
    }
  }

  if (isNativePlatform()) {
    const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isBiometricAuthInProgress() || isNativeExportInProgress()) {
        return;
      }

      if (!isActive) {
        lastBackgroundTime = Date.now();
        clearIdleLockTimer();
      } else {
        const now = Date.now();
        const config = getAppLockConfig();
        if (lastBackgroundTime > 0 && config.enabled) {
          const timeoutMs = config.graceMinutes * 60 * 1000;
          if (now - lastBackgroundTime >= timeoutMs) {
            setAppLocked(true);
          }
        }
        lastBackgroundTime = 0;
        evaluateIdleLock(now);
      }
    });

    return () => {
      isListenerActive = false;
      lastBackgroundTime = 0;
      clearIdleLockTimer();
      if (typeof window !== "undefined") {
        for (const eventName of APP_LOCK_IDLE_EVENTS) {
          window.removeEventListener(eventName, handleUserInteraction);
        }
      }
      void listenerPromise?.then?.((handle) => handle?.remove?.());
    };
  }

  if (typeof document !== "undefined") {
    const handleHide = () => {
      if (isBiometricAuthInProgress()) {
        return;
      }
      if (!lastBackgroundTime) {
        lastBackgroundTime = Date.now();
      }
      clearIdleLockTimer();
    };

    const handleShow = () => {
      if (isBiometricAuthInProgress()) {
        return;
      }
      const now = Date.now();
      const config = getAppLockConfig();
      if (lastBackgroundTime > 0 && config.enabled) {
        const timeoutMs = config.graceMinutes * 60 * 1000;
        if (now - lastBackgroundTime >= timeoutMs) {
          setAppLocked(true);
        }
      }
      lastBackgroundTime = 0;
      evaluateIdleLock(now);
    };

    const handleFocus = () => {
      evaluateIdleLock(Date.now());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleHide();
      } else if (document.visibilityState === "visible") {
        handleShow();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", handleHide);
      window.addEventListener("pageshow", handleShow);
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      isListenerActive = false;
      lastBackgroundTime = 0;
      clearIdleLockTimer();
      for (const eventName of APP_LOCK_IDLE_EVENTS) {
        window.removeEventListener(eventName, handleUserInteraction);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", handleHide);
        window.removeEventListener("pageshow", handleShow);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }

  return () => {
    isListenerActive = false;
    lastBackgroundTime = 0;
    clearIdleLockTimer();
    if (typeof window !== "undefined") {
      for (const eventName of APP_LOCK_IDLE_EVENTS) {
        window.removeEventListener(eventName, handleUserInteraction);
      }
    }
  };
}
