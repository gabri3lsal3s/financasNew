import { useEffect } from "react";
import { useLocation } from "react-router";
import { prefetchPageChunks } from "@/app/routes";
import { navItems } from "@/components/layout";

/** Rotas primárias da BottomNav — pré-carregadas no primeiro idle da sessão. */
const PRIMARY_PATHS = ["/", "/transacoes", "/cartoes", "/relatorios", "/investments"] as const;

const NAV_PATHS = navItems.map((item) => item.path);

/** Vizinhos (anterior/próximo) da rota atual na ordem da navegação. */
function adjacentPaths(current: string): string[] {
  const index = NAV_PATHS.indexOf(current);
  if (index === -1) return [];
  const neighbors = [NAV_PATHS[index - 1], NAV_PATHS[index + 1]];
  return neighbors.filter((path): path is string => Boolean(path));
}

/**
 * Pre-fetching de rotas vizinhas (F23, entrega 3).
 *
 * Agenda o carregamento discreto dos chunks de código das rotas primárias e
 * das vizinhas da atual para o próximo idle do navegador — sem competir com o
 * primeiro paint e sem custo adicional em trocas rápidas de aba (o `import()`
 * cacheia). Não pré-carrega queries: a consistência é garantida pela política
 * de cache (F23, entrega 2) + invalidação por mutação.
 */
export function useRoutePrefetch(): void {
  const location = useLocation();

  useEffect(() => {
    const schedule = (): void => {
      const paths = [...new Set([...PRIMARY_PATHS, ...adjacentPaths(location.pathname)])].filter(
        (path) => path !== location.pathname,
      );
      prefetchPageChunks(paths);
    };

    let handle: number;
    if (typeof window.requestIdleCallback === "function") {
      handle = window.requestIdleCallback(schedule, { timeout: 2_000 });
    } else {
      handle = window.setTimeout(schedule, 1_000);
    }

    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [location.pathname]);
}
