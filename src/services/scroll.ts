/**
/**
 * Utilitário de rolagem de página / contêiner principal.
 *
 * Suporta o contêiner `<main id="main-content">` do PageShell e `window` como fallback,
 * respeitando a preferência de acessibilidade `prefers-reduced-motion`.
 */

import { triggerSensory } from "./sensory";

export interface ScrollToTopOptions {
  /** Se deve emitir feedback sensorial tátil (padrão: false). */
  sensoryFeedback?: boolean;
  /** Elemento customizado para rolagem ou ID de busca (padrão: "main-content"). */
  containerId?: string;
  /** Força comportamento imediato ou suave. Se omitido, respeita prefers-reduced-motion. */
  behavior?: ScrollBehavior;
}

/**
 * Rola suavemente o contêiner principal da página (ou window) até o topo.
 * Retorna `true` se havia rolagem ativa e o scroll foi disparado; `false` se já estava no topo.
 */
export function scrollToTop(options: ScrollToTopOptions = {}): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const {
    sensoryFeedback = false,
    containerId = "main-content",
    behavior,
  } = options;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const scrollBehavior: ScrollBehavior = behavior ?? (reducedMotion ? "auto" : "smooth");

  const container = document.getElementById(containerId) ?? document.querySelector("main");
  let didScroll = false;

  if (container && container.scrollTop > 0) {
    container.scrollTo({ top: 0, behavior: scrollBehavior });
    didScroll = true;
  }

  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior: scrollBehavior });
    didScroll = true;
  }

  if (didScroll && sensoryFeedback) {
    triggerSensory("selection", { skipSound: true });
  }

  return didScroll;
}
