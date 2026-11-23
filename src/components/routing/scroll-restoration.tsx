import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";
import { resetPageScroll } from "@/services/scroll";

/**
 * Rotas públicas de apresentação que possuem rolagem programada automaticamente
 * para a seção de planos (`#precos`). Quando o usuário navega diretamente entre
 * essas rotas ou com um `#hash` explícito de seção, preservamos o comportamento
 * de âncora após o reset inicial.
 */
const SECTION_ANCHOR_ROUTES = new Set(["/precos", "/planos", "/vendas"]);

/**
 * Orquestrador global de restauração de rolagem (SPA Scroll Restoration).
 *
 * Em Single Page Applications, o navegador não recarrega o documento ao trocar de rota,
 * fazendo com que a nova página herde o `window.scrollY` ou `main.scrollTop` da página anterior
 * (ex.: clicar em "Assinar" no final da Landing Page e cair no rodapé do Checkout, ou trocar
 * de módulo na Sidebar/BottomNav e cair no meio da lista).
 *
 * Regras de Ouro implementadas:
 * 1. Executa sincronicamente via `useLayoutEffect` ANTES da pintura do navegador (`paint`),
 *    garantindo que a página nova já nasça em `top: 0` no primeiro frame visual.
 * 2. Dispara apenas quando `location.pathname` muda (ignora alterações puras de `location.search`
 *    como `?tab=goals` ou `?novo=transacao` na mesma rota para não saltar a tela durante filtros).
 * 3. Respeita âncoras explícitas (`location.hash`, ex.: `#precos`, `#simulador`), a menos que
 *    seja uma rota de hash legado público (`#/r/...`).
 * 4. Reseta simultaneamente `window`, `document.documentElement`, `#main-content` (PageShell)
 *    e `<main>` (AdminShell / páginas públicas).
 */
export function ScrollRestoration() {
  const { pathname, hash } = useLocation();
  const prevPathnameRef = useRef<string>(pathname);

  useLayoutEffect(() => {
    const pathnameChanged = prevPathnameRef.current !== pathname;
    prevPathnameRef.current = pathname;

    if (!pathnameChanged) {
      return;
    }

    // Se houver um hash de âncora de seção válido (ex: #precos) e não for hash-route (#/r/...),
    // ainda resetamos para o topo caso a transição venha de outra página antes da âncora rolar,
    // ou deixamos o elemento alvo assumir se já estiver presente no DOM.
    const isSectionHash = Boolean(hash && hash.length > 1 && !hash.startsWith("#/"));
    if (isSectionHash) {
      const targetId = hash.slice(1);
      const targetElement =
        typeof document !== "undefined" ? document.getElementById(targetId) : null;
      if (targetElement && typeof targetElement.scrollIntoView === "function") {
        targetElement.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }

    // Para rotas dedicadas de planos (/precos, /planos, /vendas), reseta o scroll para o topo
    // imediatamente para que o usuário não veja o fundo da página anterior, e o useEffect da
    // LandingPage conduz suavemente até #precos.
    if (SECTION_ANCHOR_ROUTES.has(pathname)) {
      resetPageScroll();
      return;
    }

    resetPageScroll();
  }, [pathname, hash]);

  return null;
}
