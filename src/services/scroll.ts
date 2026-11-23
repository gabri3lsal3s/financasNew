/**
 * Utilitário de rolagem de página / contêiner principal.
 *
 * Suporta o contêiner `<main id="main-content">` do PageShell, `<main id="admin-main-content">`
 * do AdminShell, qualquer `<main>` ativo e `window` como fallback,
 * respeitando a preferência de acessibilidade `prefers-reduced-motion`.
 */

import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { triggerSensory } from "./sensory";

export interface ScrollToTopOptions {
  /** Se deve emitir feedback sensorial tátil (padrão: false). */
  sensoryFeedback?: boolean;
  /** Elemento customizado para rolagem ou ID de busca (padrão: "main-content"). */
  containerId?: string;
  /** Força comportamento imediato ou suave. Se omitido, respeita prefers-reduced-motion. */
  behavior?: ScrollBehavior;
}

export interface ResetPageScrollOptions {
  /** ID do contêiner prioritário (padrão: "main-content"). */
  containerId?: string;
}

/**
 * Rola suavemente o contêiner principal da página (ou window) até o topo.
 * Usado para interações do usuário na mesma página (botão BackToTop, re-clique na rota ativa).
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

  const reducedMotion =
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false) ||
    getVisualCustomization().motionLevel === "reduced";
  const scrollBehavior: ScrollBehavior = behavior ?? (reducedMotion ? "auto" : "smooth");

  const container = document.getElementById(containerId) ?? document.querySelector("main");
  let didScroll = false;

  if (container && container.scrollTop > 0) {
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0, behavior: scrollBehavior });
    } else {
      container.scrollTop = 0;
    }
    didScroll = true;
  }

  if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: scrollBehavior });
    } else {
      document.documentElement.scrollTop = 0;
    }
    didScroll = true;
  }

  if (didScroll && sensoryFeedback) {
    triggerSensory("selection", { skipSound: true });
  }

  return didScroll;
}

/**
 * Reseta instantaneamente a posição de rolagem de todos os contêineres de página ativos
 * (`window`, `document.documentElement`, `document.body`, `#main-content` e elementos `<main>`).
 *
 * Projetado para transições de rota (SPA Scroll Restoration): executa de forma síncrona
 * com `behavior: "instant"` no mesmo frame de layout antes da pintura da nova página,
 * evitando que a nova rota herde a coordenada Y da tela anterior.
 */
export function resetPageScroll(options: ResetPageScrollOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const { containerId = "main-content" } = options;

  // 1. Reset da janela global e documento raiz (Landing, Checkout, Ferramentas, Legal, Auth)
  if (typeof window.scrollTo === "function") {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }
  if (document.documentElement.scrollTop !== 0) {
    document.documentElement.scrollTop = 0;
  }
  if (document.body && document.body.scrollTop !== 0) {
    document.body.scrollTop = 0;
  }

  // 2. Reset do contêiner principal nomeado (#main-content no PageShell) e quaisquer <main> roláveis (AdminShell)
  const namedContainer = document.getElementById(containerId);
  const mainElements = Array.from(document.querySelectorAll("main"));
  const targets = new Set<HTMLElement>();

  if (namedContainer) {
    targets.add(namedContainer);
  }
  for (const el of mainElements) {
    targets.add(el);
  }

  for (const el of targets) {
    if (el.scrollTop !== 0) {
      el.scrollTop = 0;
    }
    if (typeof el.scrollTo === "function") {
      try {
        el.scrollTo({ top: 0, left: 0, behavior: "instant" });
      } catch {
        el.scrollTo(0, 0);
      }
    }
  }
}
