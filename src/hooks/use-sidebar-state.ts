import { useCallback, useEffect, useState } from "react";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

const STORAGE_KEY = "sidebar_collapsed";

/** Lê a preferência persistida (default: expandida). */
function readCollapsed(userId?: string | null): boolean {
  return getUserStorageItem(STORAGE_KEY, userId) === "1";
}

/**
 * Estado da sidebar colapsável (F7.2) — persistência imediata no storage do usuário
 * (`financas_${userId}_sidebar_collapsed`), mesma estratégia do tema (escrita no handler,
 * sem setState em effect/render).
 */
export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => readCollapsed());

  useEffect(() => {
    const unsub = subscribeActiveUserId((userId) => {
      setIsCollapsed(readCollapsed(userId));
    });
    return unsub;
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      setUserStorageItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { isCollapsed, toggle };
}
