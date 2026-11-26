import { registerSW } from "virtual:pwa-register";
import { hasActiveDialogInDom, isLaunchWizardActive } from "@/hooks/use-active-overlays";
import { isNativePlatform } from "@/services/native/platform";

/**
 * Registro do Service Worker + fluxo de instalação/atualização (PWA_GUIDELINES §6).
 * O SW cacheia apenas o App Shell e assets estáticos; dados seguem Online First.
 *
 * Com `registerType: "autoUpdate"`, o SW novo assume sozinho (skipWaiting +
 * clientsClaim); interceptamos o reload via `onNeedReload` e aplicamos atualização
 * silenciosa em momentos seguros (boot, segundo plano, telas de credenciais,
 * reabertura do app, login/logout e trocas de rota sem edição ativa), mantendo o
 * toast como fallback não-intrusivo quando o usuário está editando algo.
 */

// ---------- Atualização automática inteligente (autoUpdate) ----------

const updateListeners = new Set<() => void>();
let updateAvailable = false;
let isUpdating = false;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let appBootTime = typeof Date !== "undefined" ? Date.now() : 0;
let lastUpdateCheckAt = 0;
let inFlightUpdateCheck: Promise<void> | null = null;
let hasRegisteredLifecycleListeners = false;

const BOOT_AUTO_UPDATE_WINDOW_MS = 12_000;
const BACKGROUND_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const VISIBILITY_CHECK_THROTTLE_MS = 60 * 1000;
export const ROUTE_CHECK_THROTTLE_MS = 2 * 60 * 1000;
const AUTO_RELOAD_COOLDOWN_MS = 15_000;
const AUTO_RELOAD_STORAGE_KEY = "axir:pwa_last_auto_reload_at";

const CREDENTIAL_ROUTE_PREFIXES = [
  "/entrar",
  "/cadastro",
  "/cadastrar",
  "/criar-conta",
  "/recuperar-senha",
  "/admin/login",
];

const SENSITIVE_NO_RELOAD_PREFIXES = [
  "/assinatura",
  "/assinar",
  "/redefinir-senha",
  "/atualizar-senha",
  "/share-target",
];

function getCurrentPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

export function isCredentialRoute(pathname: string = getCurrentPathname()): boolean {
  return CREDENTIAL_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSensitiveRoute(pathname: string = getCurrentPathname()): boolean {
  return SENSITIVE_NO_RELOAD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Detecta se o usuário está digitando ou editando ativamente um campo de formulário.
 * Garante que atualizações automáticas nunca interrompam digitação de dados ou credenciais.
 */
export function isUserEditingField(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;

  if (active.isContentEditable || active.getAttribute("contenteditable") === "true") {
    return true;
  }

  const tag = active.tagName?.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  if (tag === "INPUT") {
    const inputType = (active as HTMLInputElement).type?.toLowerCase() ?? "text";
    const nonTextTypes = new Set(["button", "submit", "reset", "checkbox", "radio", "hidden"]);
    return !nonTextTypes.has(inputType);
  }

  return false;
}

function canTriggerAutoReloadByCooldown(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage?.getItem(AUTO_RELOAD_STORAGE_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return now - last >= AUTO_RELOAD_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markAutoReloadTriggered(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(AUTO_RELOAD_STORAGE_KEY, String(now));
  } catch {
    // Storage indisponível — segue sem persistir cooldown
  }
}

/**
 * Avalia se a interface está em um ponto seguro e confortável para recarregar
 * silenciosamente o PWA sem atrapalhar o usuário:
 * - Online e fora de ambiente nativo;
 * - Fora de fluxos sensíveis (checkout/assinatura, redefinição de senha, share target);
 * - Sem modais/diálogos abertos ou LaunchWizard ativo;
 * - Sem campo de texto/formulário em foco;
 * - Respeitando cooldown anti-loop (15s).
 */
export function isSafeForAutoReload(): boolean {
  if (typeof window === "undefined" || isNativePlatform() || isUpdating) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  if (isSensitiveRoute()) {
    return false;
  }
  if (hasActiveDialogInDom() || isLaunchWizardActive()) {
    return false;
  }
  if (isUserEditingField()) {
    return false;
  }
  if (!canTriggerAutoReloadByCooldown()) {
    return false;
  }
  return true;
}

/**
 * Aplica imediatamente uma atualização PWA já detectada caso a UI esteja em um ponto seguro.
 * Retorna `true` se o recarregamento silencioso foi iniciado.
 */
export function applyPendingPWAUpdateIfSafe(): boolean {
  if (!updateAvailable || !isSafeForAutoReload()) {
    return false;
  }
  markAutoReloadTriggered();
  void applyPWAUpdate();
  return true;
}

/**
 * Trata o anúncio de nova versão emitido pelo Service Worker.
 * - Durante o boot (primeiros 12s), com a aba oculta ou em telas de credenciais
 *   sem digitação ativa: aplica a atualização silenciosamente;
 * - Durante o uso ativo em primeiro plano: marca atualização disponível (toast +
 *   aplicação automática na próxima transição segura de rota ou retorno do background).
 */
export function handleSWNeedReload(): void {
  if (isNativePlatform()) return;

  const isBootWindow = Date.now() - appBootTime < BOOT_AUTO_UPDATE_WINDOW_MS;
  const isBackgroundTab = typeof document !== "undefined" && document.visibilityState === "hidden";

  if ((isBootWindow || isBackgroundTab || isCredentialRoute()) && isSafeForAutoReload()) {
    markAutoReloadTriggered();
    void applyPWAUpdate();
    return;
  }

  notifyPWAUpdate();
}

export interface CheckPWAUpdateOptions {
  /** Ignora o throttle e consulta o servidor imediatamente. */
  force?: boolean;
  /** Intervalo mínimo entre checagens quando `force` não é true. */
  throttleMs?: number;
  /** Quando true, aplica o reload silencioso se houver atualização pronta e a UI estiver segura. */
  applyIfSafe?: boolean;
}

/**
 * Verifica ativamente se há uma nova versão do Service Worker no servidor.
 * Deduplica chamadas concorrentes e, opcionalmente, aplica atualizações prontas
 * quando a interface está em momento seguro.
 */
export async function checkPWAUpdateNow(options: CheckPWAUpdateOptions = {}): Promise<void> {
  if (typeof window === "undefined" || isNativePlatform() || !("serviceWorker" in navigator)) {
    return;
  }
  if (navigator.onLine === false) {
    return;
  }

  if (options.applyIfSafe && updateAvailable && applyPendingPWAUpdateIfSafe()) {
    return;
  }

  const now = Date.now();
  const throttleMs = options.throttleMs ?? VISIBILITY_CHECK_THROTTLE_MS;
  if (!options.force && now - lastUpdateCheckAt < throttleMs) {
    return;
  }

  if (inFlightUpdateCheck) {
    await inFlightUpdateCheck;
    if (options.applyIfSafe && updateAvailable) {
      applyPendingPWAUpdateIfSafe();
    }
    return;
  }

  lastUpdateCheckAt = now;
  inFlightUpdateCheck = (async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      if (reg.waiting) {
        notifyPWAUpdate();
        if (options.applyIfSafe && applyPendingPWAUpdateIfSafe()) {
          return;
        }
      }

      await reg.update();

      if (reg.waiting) {
        notifyPWAUpdate();
        if (options.applyIfSafe) {
          applyPendingPWAUpdateIfSafe();
        }
      }
    } catch {
      // Falha silenciosa de rede/SW — o app segue Online First normalmente.
    } finally {
      inFlightUpdateCheck = null;
    }
  })();

  await inFlightUpdateCheck;
}

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
 * Aguarda um Service Worker em estado `installing` concluir o download do precache
 * (`installed`, `activated` ou `redundant`) com timeout defensivo.
 */
function waitForInstallingWorker(worker: ServiceWorker, timeoutMs = 8000): Promise<void> {
  if (
    worker.state === "installed" ||
    worker.state === "activated" ||
    worker.state === "redundant"
  ) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        if (timer) clearTimeout(timer);
        worker.removeEventListener("statechange", onStateChange);
        resolve();
      }
    };

    const onStateChange = () => {
      if (
        worker.state === "installed" ||
        worker.state === "activated" ||
        worker.state === "redundant"
      ) {
        cleanup();
      }
    };

    worker.addEventListener("statechange", onStateChange);
    timer = setTimeout(cleanup, timeoutMs);
  });
}

/**
 * Executa a atualização atômica e sincronizada do PWA:
 * 1. Invoca o callback retornado pelo registerSW (updateSW(true));
 * 2. Se houver worker em `installing`, aguarda a conclusão do download do precache;
 * 3. Envia SKIP_WAITING para o worker em `waiting` e aguarda `controllerchange`;
 * 4. Remove caches dinâmicos legados via `purgeLegacyCaches()`;
 * 5. Recarrega a aplicação (`window.location.reload()`) mantendo a integridade do App Shell.
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
          if (reg.installing && typeof reg.installing.addEventListener === "function") {
            await waitForInstallingWorker(reg.installing, 8000);
          }

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
 * Verificação manual acionada pelo usuário em Configurações ("Verificar atualizações").
 * Diferente da checagem passiva, aguarda um Service Worker recém-descoberto em `installing`
 * concluir o download do precache antes de responder, garantindo detecção confiável mesmo
 * em deploys sem incremento de número de versão no `version.json`.
 */
export async function checkPWAUpdateManually(): Promise<boolean> {
  if (typeof window === "undefined" || isNativePlatform() || !("serviceWorker" in navigator)) {
    return updateAvailable;
  }
  if (navigator.onLine === false) {
    return updateAvailable;
  }

  let detectedNewWorker = updateAvailable;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.update();

      if (reg.installing) {
        detectedNewWorker = true;
        if (typeof reg.installing.addEventListener === "function") {
          await waitForInstallingWorker(reg.installing, 8000);
        }
      }

      if (reg.waiting) {
        detectedNewWorker = true;
      }
    }
  } catch {
    // Fallback gracioso em caso de erro de rede/SW
  }

  if (detectedNewWorker && !updateAvailable) {
    notifyPWAUpdate();
  }

  return updateAvailable || detectedNewWorker;
}

export interface ForceAppUpdateOptions {
  /**
   * Quando true, se nenhum worker `waiting`/`installing` for encontrado após `reg.update()`
   * (cenário de SW antigo/travado quando o servidor acusa versão mais nova), desregistra
   * o SW preso e limpa os caches antes de recarregar direto da rede.
   */
  hardResetIfNoWorker?: boolean;
}

/**
 * Força a busca por atualizações do Service Worker e recarrega a aplicação
 * com os assets mais recentes do PWA de forma atômica e sincronizada.
 */
export async function forceAppUpdate(options: ForceAppUpdateOptions = {}): Promise<void> {
  if (typeof window === "undefined") return;

  if (!isNativePlatform() && "serviceWorker" in navigator) {
    let foundPendingWorker = updateAvailable;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
        if (reg.installing) {
          foundPendingWorker = true;
          if (typeof reg.installing.addEventListener === "function") {
            await waitForInstallingWorker(reg.installing, 8000);
          }
        }
        if (reg.waiting) {
          foundPendingWorker = true;
        }
      }

      // Auto-recuperação: servidor reportou versão nova, mas o SW local está preso/zumbi
      if (options.hardResetIfNoWorker && !foundPendingWorker && registrations.length > 0) {
        await Promise.allSettled(registrations.map((reg) => reg.unregister()));
        if ("caches" in window) {
          try {
            const keys = await window.caches.keys();
            await Promise.allSettled(keys.map((key) => window.caches.delete(key)));
          } catch {
            // CacheStorage indisponível
          }
        }
        window.location.reload();
        return;
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

  // Se já houver um Service Worker novo aguardando na inicialização, aplica atualização atômica no loading
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg?.waiting) {
          notifyPWAUpdate();
          if (!applyPendingPWAUpdateIfSafe()) {
            void applyPWAUpdate();
          }
        } else if (reg) {
          void checkPWAUpdateNow({ force: true, applyIfSafe: true });
        }
      })
      .catch(() => {});
  }

  updateSWFn = registerSW({
    immediate: true,
    onNeedReload: handleSWNeedReload,
    onRegisterError: () => {
      // SW indisponível (navegador sem suporte) — o app segue Online First sem toast.
    },
  });

  if (typeof window !== "undefined" && !hasRegisteredLifecycleListeners) {
    hasRegisteredLifecycleListeners = true;

    // Verificação periódica a cada 5 minutos enquanto online
    setInterval(() => {
      void checkPWAUpdateNow({ force: true, applyIfSafe: false });
    }, BACKGROUND_CHECK_INTERVAL_MS);

    // Retorno ao app (aba/PWA voltou ao primeiro plano):
    // 1. Se já havia atualização pendente baixada, aplica imediatamente em ponto seguro;
    // 2. Caso contrário, consulta o servidor respeitando throttle enxuto de 60s.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (!applyPendingPWAUpdateIfSafe()) {
          void checkPWAUpdateNow({
            throttleMs: VISIBILITY_CHECK_THROTTLE_MS,
            applyIfSafe: true,
          });
        }
      }
    });

    // Retorno do bfcache (iOS Safari / Android Chrome standalone)
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        if (!applyPendingPWAUpdateIfSafe()) {
          void checkPWAUpdateNow({ force: true, applyIfSafe: true });
        }
      }
    });

    // Reconexão de rede
    window.addEventListener("online", () => {
      void checkPWAUpdateNow({ force: true, applyIfSafe: false });
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
}

/** Apenas para uso em testes unitários automatizados. */
export function _setUpdateSWFnForTesting(fn: ((reloadPage?: boolean) => Promise<void>) | null): void {
  updateSWFn = fn;
}

export function _setAppBootTimeForTesting(timestamp: number): void {
  appBootTime = timestamp;
}

export function _resetPWAStateForTesting(): void {
  updateAvailable = false;
  isUpdating = false;
  updateSWFn = null;
  lastUpdateCheckAt = 0;
  inFlightUpdateCheck = null;
  appBootTime = Date.now();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage?.removeItem(AUTO_RELOAD_STORAGE_KEY);
    } catch {
      // no-op
    }
  }
}

