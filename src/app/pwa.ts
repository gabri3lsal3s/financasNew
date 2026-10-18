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
let isUpdating = false;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

/** Assina mudanças no estado "nova versão disponível" ou "atualização em andamento". */
export function subscribePWAUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

export function getPWAUpdateAvailable(): boolean {
  return updateAvailable;
}

export function getIsPWAUpdating(): boolean {
  return isUpdating;
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
 * Aguarda o novo Service Worker assumir o controle dos clientes ativos (clientsClaim / controllerchange).
 * Possui timeout defensivo de 4 segundos para evitar travamentos em plataformas com suporte parcial.
 */
export function waitForControllerChange(timeoutMs = 4000): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onControllerChange = () => {
      if (!resolved) {
        resolved = true;
        if (timer) clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        resolve();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        resolve();
      }
    }, timeoutMs);
  });
}

/**
 * Remove caches de runtime obsoletos (imagens e assets estáticos dinâmicos) durante atualizações.
 * O cache de precache do Workbox (workbox-precache) é estritamente preservado para garantir
 * que a navegação do App Shell (/index.html) e rotas internas permaneçam funcionais após o reload.
 * O Workbox já gerencia sua própria purga de revisões antigas via cleanupOutdatedCaches: true.
 */
export async function purgeLegacyCaches(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const keys = await window.caches.keys();
    const cachesToPurge = keys.filter((key) => {
      // Nunca purgar workbox-precache pelo cliente: isso quebra o NavigationRoute (/index.html) no reload
      if (key.includes("workbox-precache")) return false;

      return (
        key.includes("static-images") ||
        key.includes("pwa-brand-assets")
      );
    });
    await Promise.all(cachesToPurge.map((key) => window.caches.delete(key)));
  } catch {
    // Silencioso se o CacheStorage estiver inacessível
  }
}

/**
 * Executa a atualização atômica e sincronizada do PWA:
 * 1. Invoca o callback retornado pelo registerSW (updateSW(true)) e envia SKIP_WAITING para a registration ativa;
 * 2. Escuta e aguarda o evento `controllerchange` em `navigator.serviceWorker` (apenas se houver worker pendente);
 * 3. Varrer e remove caches dinâmicos legados via `purgeLegacyCaches()`;
 * 4. Recarrega a aplicação (`window.location.reload()`) de forma segura mantendo a integridade do App Shell.
 */
export async function applyPWAUpdate(): Promise<void> {
  if (typeof window === "undefined") return;

  if (isUpdating) return;
  isUpdating = true;
  updateListeners.forEach((listener) => listener());

  try {
    if (updateSWFn) {
      try {
        await updateSWFn(true);
      } catch {
        // Fallback para postMessage direto se o wrapper falhar
      }
    }

    if (!isNativePlatform() && "serviceWorker" in navigator) {
      let hasPendingWorker = false;
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.waiting) {
            hasPendingWorker = true;
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } else if (reg.installing) {
            hasPendingWorker = true;
          }
        }
      } catch {
        // Ignora falha de comunicação com Service Worker
      }

      if (hasPendingWorker) {
        await waitForControllerChange(4000);
      }
    }

    await purgeLegacyCaches();
  } catch {
    // Prossegue com o recarregamento mesmo em caso de erro inesperado
  } finally {
    window.location.reload();
  }
}

/**
 * Força a busca por atualizações do Service Worker e recarrega a aplicação
 * com os assets mais recentes do PWA de forma atômica e sincronizada.
 */
export async function forceAppUpdate(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!isNativePlatform() && "serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
    } catch {
      // Ignora falha de verificação no Service Worker
    }
  }

  await applyPWAUpdate();
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

  updateSWFn = registerSW({
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

/** Apenas para uso em testes unitários automatizados. */
export function _setUpdateSWFnForTesting(fn: ((reloadPage?: boolean) => Promise<void>) | null): void {
  updateSWFn = fn;
}

export function _resetPWAStateForTesting(): void {
  updateAvailable = false;
  isUpdating = false;
  updateSWFn = null;
}

