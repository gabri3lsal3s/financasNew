import { useCallback, useState } from "react";

const STORAGE_KEY = "financas_sidebar_collapsed";

/** Lê a preferência persistida (default: expandida). */
function readCollapsed(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/**
 * Estado da sidebar colapsável (F7.2) — persistência imediata no localStorage
 * (`financas_sidebar_collapsed`), mesma estratégia do tema (escrita no handler,
 * sem setState em effect/render).
 */
export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(readCollapsed);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { isCollapsed, toggle };
}
