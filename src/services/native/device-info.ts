import { isMobileDevice, isNativePlatform } from "./platform";
import type { DeviceRegistrationInput } from "@/types";

export const DEVICE_ID_STORAGE_KEY = "axir_device_id";
export const DEVICE_LAST_SYNC_STORAGE_KEY = "axir_device_last_synced_at";
export const SYNC_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtém ou gera um identificador estável e exclusivo para a instalação / dispositivo atual.
 * Persiste no localStorage do cliente para assegurar coexistência em multi-sessões.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "server_device_fallback";
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }

    let newId = "";
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      newId = crypto.randomUUID();
    } else {
      newId = "dev_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
    }

    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    return newId;
  } catch {
    return "session_temp_device";
  }
}

/**
 * Detecta o sistema operacional a partir do User-Agent ou ambiente nativo.
 */
export function detectOS(customUserAgent?: string): string {
  if (isNativePlatform()) {
    return "Android";
  }

  const ua = customUserAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!ua) return "Desconhecido";

  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows NT 10.0|Windows NT 11.0/i.test(ua)) return "Windows 10/11";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "Chrome OS";
  if (/Linux/i.test(ua)) return "Linux";

  return "Desconhecido";
}

/**
 * Detecta o navegador a partir do User-Agent.
 */
export function detectBrowser(customUserAgent?: string): string {
  if (isNativePlatform()) {
    return "App Axir Android";
  }

  const ua = customUserAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!ua) return "Navegador Web";

  if (/Edg\//i.test(ua)) return "Microsoft Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Firefox\//i.test(ua)) return "Mozilla Firefox";
  if (/Chrome\//i.test(ua)) return "Google Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";

  return "Navegador Web";
}

/**
 * Produz um rótulo amigável legível para o usuário final reconhecer o aparelho conectado.
 */
export function getFriendlyDeviceName(browser: string, os: string, isMobile: boolean): string {
  if (isNativePlatform()) {
    return "Axir Android (Nativo)";
  }
  if (isMobile) {
    return `${browser} no ${os} (Mobile)`;
  }
  return `${browser} no ${os}`;
}

/**
 * Consolida as informações do dispositivo atual prontas para persistência ou sincronização.
 */
export function getDeviceInfo(): DeviceRegistrationInput {
  const deviceId = getOrCreateDeviceId();
  const os = detectOS();
  const browser = detectBrowser();
  const isMobile = isMobileDevice();
  const deviceName = getFriendlyDeviceName(browser, os, isMobile);

  return {
    deviceId,
    deviceName,
    browser,
    os,
  };
}

/**
 * Verifica se a sessão do dispositivo precisa ser sincronizada com o backend (throttle de 24h).
 */
export function shouldSyncDeviceSession(force?: boolean): boolean {
  if (force) return true;
  if (typeof window === "undefined" || !window.localStorage) return false;

  try {
    const lastSyncStr = window.localStorage.getItem(DEVICE_LAST_SYNC_STORAGE_KEY);
    if (!lastSyncStr) return true;

    const lastSyncMs = parseInt(lastSyncStr, 10);
    if (isNaN(lastSyncMs) || lastSyncMs <= 0) return true;

    const elapsed = Date.now() - lastSyncMs;
    return elapsed >= SYNC_THROTTLE_MS;
  } catch {
    return true;
  }
}

/**
 * Marca o timestamp da sincronização do dispositivo no armazenamento local.
 */
export function markDeviceSessionSynced(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(DEVICE_LAST_SYNC_STORAGE_KEY, Date.now().toString());
  } catch {
    // Ignora falhas de escrita no localStorage
  }
}

/**
 * Limpa o timestamp de sincronização (ex: logout) para forçar novo registro na próxima autenticação.
 */
export function clearDeviceSessionSync(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(DEVICE_LAST_SYNC_STORAGE_KEY);
  } catch {
    // Ignora falhas
  }
}
