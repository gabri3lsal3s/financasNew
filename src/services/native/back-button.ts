import { App } from "@capacitor/app";
import { isCalculatorOpen, setCalculatorOpen } from "@/services/calculator-open";
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
 * 1. Handlers prioritários registrados via `registerBackHandler`;
 * 2. Calculadora flutuante aberta;
 * 3. Modais, popovers ou gavetas abertas no DOM (via evento Escape);
 * 4. Navegação do histórico (se não estiver na raiz `/`);
 * 5. Minimizar o app nativo caso esteja na raiz.
 */
export async function handleHardwareBackButton(canGoBack = false): Promise<void> {
  // 1. Handlers customizados (LIFO - mais recente primeiro)
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    const handler = backHandlers[i];
    if (handler && handler()) {
      return;
    }
  }

  // 2. Calculadora flutuante aberta
  if (isCalculatorOpen()) {
    setCalculatorOpen(false);
    return;
  }

  // 3. Modais / Diálogos / Popovers abertos no DOM
  if (typeof document !== "undefined") {
    const activeOverlay = document.querySelector<HTMLElement>(
      '[role="dialog"], [data-state="open"][role="dialog"], [data-radix-popper-content-wrapper]',
    );
    if (activeOverlay) {
      const escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });
      (document.activeElement ?? document).dispatchEvent(escapeEvent);
      return;
    }
  }

  // 4. Histórico de navegação
  if (typeof window !== "undefined") {
    const isRoot = window.location.pathname === "/" || window.location.pathname === "";
    if (!isRoot && (canGoBack || window.history.length > 1)) {
      window.history.back();
      return;
    }
  }

  // 5. Na raiz ou sem histórico: minimiza o aplicativo sem fechar abruptamente a sessão
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
