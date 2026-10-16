import { registerSW } from "virtual:pwa-register";
import { isNativePlatform } from "@/services/native";

/**
 * Registro do Service Worker + fluxo de instalação/atualização (PWA_GUIDELINES §6).
 * O SW cacheia apenas o App Shell e assets estáticos; dados seguem Online First.
 *
 * Com `registerType: "autoUpdate"`, o SW novo assume sozinho (skipWaiting +
 * clientsClaim); interceptamos o reload automático via `onNeedReload` e avisamos
 * o usuário com um toast — sem perda de estado na navegação.
 */

// ---------- Atualização automática (autoUpdate → toast) ----------

const updateListeners = new Set<() => void>();
let updateAvailable = false;

/** Assina mudanças no estado "nova versão disponível". */
export function subscribePWAUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

export function getPWAUpdateAvailable(): boolean {
  return updateAvailable;
}

/** Marca a nova versão como disponível e notifica a UI (chamado pelo SW). */
export function notifyPWAUpdate(): void {
  updateAvailable = true;
  updateListeners.forEach((listener) => listener());
}

/** Consome o anúncio (usuário fechou o toast) — permite novo anúncio no futuro. */
export function consumePWAUpdate(): void {
  updateAvailable = false;
  updateListeners.forEach((listener) => listener());
}

/**
 * Força a busca por atualizações do Service Worker e recarrega a aplicação
 * com os assets mais recentes do PWA.
 */
export async function forceAppUpdate(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!isNativePlatform() && "serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      }
    } catch {
      // Ignora falha de verificação no Service Worker
    }
  }

  window.location.reload();
}

// ---------- Instalação (beforeinstallprompt) ----------

/** Evento `beforeinstallprompt` (Chromium) — fora do lib.dom padrão. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const installListeners = new Set<() => void>();
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

function isStandalone(): boolean {
  // jsdom não implementa matchMedia — sem suporte, nunca tratamos como standalone.
  if (typeof window.matchMedia !== "function") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOSPlatform = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOSPlatform || isIPadOS;
}

export function isStandaloneMode(): boolean {
  return isStandalone();
}

/**
 * Retorna se o dispositivo é um candidato à instalação PWA no ecossistema iOS/Safari.
 * No iOS, o navegador não dispara `beforeinstallprompt`, exigindo o fluxo manual
 * guiado de "Compartilhar > Adicionar à Tela de Início".
 */
export function getIsIOSInstallCandidate(): boolean {
  if (isNativePlatform()) return false;
  if (isStandalone()) return false;
  return isIOS();
}

/** Assina mudanças em "pode instalar" (evento recebido / instalado). */
export function subscribePWAInstall(listener: () => void): () => void {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
}

export function getCanInstallPWA(): boolean {
  if (isNativePlatform()) return false;
  if (isStandalone()) return false;
  return deferredInstallPrompt !== null || isIOS();
}

export interface PWAInstallSnapshot {
  canInstall: boolean;
  isNativePromptAvailable: boolean;
  isIOS: boolean;
  isInstalled: boolean;
}

function computeInstallSnapshot(): PWAInstallSnapshot {
  const installed = isStandalone();
  const nativePlatform = isNativePlatform();
  const isIOSDevice = isIOS();
  const iosCandidate = !nativePlatform && !installed && isIOSDevice;
  const nativePrompt = !nativePlatform && !installed && deferredInstallPrompt !== null;

  return {
    canInstall: nativePrompt || iosCandidate,
    isNativePromptAvailable: nativePrompt,
    isIOS: iosCandidate,
    isInstalled: installed,
  };
}

let cachedInstallSnapshot: PWAInstallSnapshot = computeInstallSnapshot();

/**
 * Snapshot estável para useSyncExternalStore. Retorna a mesma referência em
 * renders consecutivos até que ocorra um evento de instalação (beforeinstallprompt, appinstalled).
 */
export function getPWAInstallSnapshot(): PWAInstallSnapshot {
  return cachedInstallSnapshot;
}

/** Dispara o prompt nativo de instalação (uma única vez por evento). */
export async function promptPWAInstall(): Promise<void> {
  const promptEvent = deferredInstallPrompt;
  if (!promptEvent) return;
  deferredInstallPrompt = null;
  notifyInstallChange();
  await promptEvent.prompt();
  await promptEvent.userChoice;
}

/**
 * Força a reavaliação do snapshot de instalação PWA e notifica os listeners.
 * Útil para sincronização pós-bootstrap ou em testes que emulam alternância de dispositivos.
 */
export function refreshPWAInstallState(): void {
  notifyInstallChange();
}

function notifyInstallChange(): void {
  cachedInstallSnapshot = computeInstallSnapshot();
  installListeners.forEach((listener) => listener());
}

export function registerPWA(): void {
  // Isola Service Worker: não executa em plataformas nativas (ex: Android/iOS via Capacitor)
  if (isNativePlatform()) {
    return;
  }

  registerSW({
    immediate: true,
    onNeedReload: notifyPWAUpdate,
    onRegisterError: () => {
      // SW indisponível (navegador sem suporte) — o app segue Online First sem toast.
    },
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyInstallChange();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifyInstallChange();
  });
}
