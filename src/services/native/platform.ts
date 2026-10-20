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
