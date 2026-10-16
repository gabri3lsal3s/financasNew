import { App } from "@capacitor/app";
import { isCalculatorOpen, setCalculatorOpen } from "@/services/calculator-open";
import { isAppLocked } from "./app-lock";
import { isNativePlatform } from "./platform";

type BackHandler = () => boolean;

const backHandlers: BackHandler[] = [];

/**
 * Registra um interceptador prioritário para o botão voltar físico do Android.
 * Se o handler retornar `true`, a ação foi consumida e interrompe a propagação.
 * Retorna uma função para cancelar o registro.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.indexOf(handler);
    if (index !== -1) {
      backHandlers.splice(index, 1);
    }
  };
}

/**
 * Processa o clique no botão voltar de hardware respeitando a hierarquia:
 * 1. Escudo de bloqueio do app ativo (AppLock): minimiza o app sem desproteger os dados;
 * 2. Handlers customizados registrados via `registerBackHandler` (LIFO);
 * 3. Calculadora flutuante aberta;
 * 4. Modais, popovers, drawers, sheets ou diálogos abertos no DOM (via evento Escape no topo);
 * 5. Navegação do histórico (se não estiver na raiz `/`);
 * 6. Minimizar o app nativo caso esteja na raiz.
 */
export async function handleHardwareBackButton(canGoBack = false): Promise<void> {
  // 1. Escudo de bloqueio biométrico ativo: nunca sai da tela de bloqueio nem volta no histórico
  if (isAppLocked()) {
    try {
      await App.minimizeApp();
    } catch {
      // Ignora em ambientes sem suporte
    }
    return;
  }

  // 2. Handlers customizados (LIFO - mais recente primeiro)
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    const handler = backHandlers[i];
    if (handler && handler()) {
      return;
    }
  }

  // 3. Calculadora flutuante aberta
  if (isCalculatorOpen()) {
    setCalculatorOpen(false);
    return;
  }

  // 4. Modais / Diálogos / Popovers / Bottom Sheets abertos no DOM
  if (typeof document !== "undefined") {
    const openOverlays = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"]:not([data-state="closed"]):not([data-lock-overlay]), ' +
        '[role="alertdialog"]:not([data-state="closed"]):not([data-lock-overlay]), ' +
        '[data-radix-popper-content-wrapper], ' +
        '[data-radix-menu-content], ' +
        '[data-mobile-menu="open"]',
      ),
    );

    const topmostOverlay = openOverlays[openOverlays.length - 1];
    if (topmostOverlay) {
      const escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });

      const activeEl = document.activeElement;
      if (activeEl && topmostOverlay.contains(activeEl)) {
        activeEl.dispatchEvent(escapeEvent);
      } else {
        topmostOverlay.dispatchEvent(escapeEvent);
        document.dispatchEvent(escapeEvent);
      }
      return;
    }
  }

  // 5. Histórico de navegação
  if (typeof window !== "undefined") {
    const isRoot = window.location.pathname === "/" || window.location.pathname === "";
    if (!isRoot && (canGoBack || window.history.length > 1)) {
      window.history.back();
      return;
    }
  }

  // 6. Na raiz ou sem histórico: minimiza o aplicativo sem fechar abruptamente a sessão
  try {
    await App.minimizeApp();
  } catch {
    // Ignora em ambientes sem suporte
  }
}

let isInitialized = false;

/**
 * Inicializa a escuta do botão voltar de hardware do Android.
 * Em Web/PWA, opera como no-op seguro.
 */
export function initHardwareBackButton(): () => void {
  if (!isNativePlatform() || isInitialized) {
    return () => {};
  }

  isInitialized = true;
  const listenerPromise = App.addListener("backButton", ({ canGoBack }) => {
    void handleHardwareBackButton(canGoBack);
  });

  return () => {
    isInitialized = false;
    void listenerPromise.then((handle) => handle.remove());
  };
}
