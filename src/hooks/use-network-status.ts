import { useSyncExternalStore } from "react";
import { getIsOnlineSnapshot, subscribeNetworkStatus } from "@/services/network-status";

/**
 * Hook de monitoramento reativo de conectividade (Fase 83).
 * Utiliza useSyncExternalStore para atualização em tempo real sem re-renders desnecessários.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const isOnline = useSyncExternalStore(
    subscribeNetworkStatus,
    getIsOnlineSnapshot,
    getIsOnlineSnapshot,
  );

  return { isOnline };
}
