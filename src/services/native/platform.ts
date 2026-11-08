import { Capacitor } from "@capacitor/core";

/**
 * Retorna se a aplicação está rodando sob uma plataforma nativa (ex.: Android / iOS)
 * envelopada pelo Capacitor.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Retorna se a aplicação está rodando no navegador / ambiente Web (não-nativo).
 */
export function isWebPlatform(): boolean {
  return !Capacitor.isNativePlatform();
}

/**
 * Retorna o nome da plataforma ativa ("android", "ios", "web").
 */
export function getPlatform(): "android" | "ios" | "web" {
  const platform = Capacitor.getPlatform();
  if (platform === "android" || platform === "ios") {
    return platform;
  }
  return "web";
}

/**
 * Verifica se a plataforma ativa é Android nativo.
 */
export function isAndroidNative(): boolean {
  return Capacitor.getPlatform() === "android";
}

/**
 * Verifica se a plataforma ativa é iOS nativo.
 */
export function isIOSNative(): boolean {
  return Capacitor.getPlatform() === "ios";
}

/**
 * Verifica se o dispositivo do usuário é Android (seja no navegador, PWA ou nativo).
 */
export function isAndroidDevice(): boolean {
  if (Capacitor.getPlatform() === "android") {
    return true;
  }
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    return /Android/i.test(ua);
  }
  return false;
}

/**
 * Verifica se o dispositivo do usuário é Apple iOS (iPhone, iPad, iPod).
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOSPlatform = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOSPlatform || isIPadOS;
}

/**
 * Verifica se o dispositivo atual é móvel (smartphone ou tablet).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isAndroidDevice() || isIOSDevice()) return true;
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

/**
 * Verifica se a aplicação está rodando em modo standalone (PWA instalado na tela de início).
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { standalone?: boolean }) : null;
  return window.matchMedia("(display-mode: standalone)").matches || nav?.standalone === true;
}

export type ActivePlatform = "web_desktop" | "mobile_pwa" | "android_pro";

/**
 * Retorna a plataforma atualmente em uso:
 * - "android_pro": APK Android nativo (Capacitor)
 * - "mobile_pwa": Smartphone ou tablet (via PWA instalado ou navegador mobile)
 * - "web_desktop": Computador / desktop (navegador web em tela ampla)
 */
export function getActivePlatform(): ActivePlatform {
  if (isNativePlatform()) {
    return "android_pro";
  }
  if (isMobileDevice() || isStandaloneDisplay()) {
    return "mobile_pwa";
  }
  return "web_desktop";
}

