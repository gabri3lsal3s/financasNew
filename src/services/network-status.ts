/**
 * Monitor de conectividade e status de rede (Fase 83).
 *
 * Utiliza o padrão pub/sub com useSyncExternalStore (sem setState em effect)
 * para fornecer o estado de conectividade (`isOnline`) em tempo real.
 */

type NetworkListener = (isOnline: boolean) => void;

const listeners = new Set<NetworkListener>();

function getInitialStatus(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }
  return navigator.onLine;
}

let isOnlineState = getInitialStatus();

function handleOnline(): void {
  isOnlineState = true;
  for (const listener of listeners) {
    listener(true);
  }
}

function handleOffline(): void {
  isOnlineState = false;
  for (const listener of listeners) {
    listener(false);
  }
}

let initialized = false;

function ensureListeners(): void {
  if (initialized || typeof window === "undefined") return;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  initialized = true;
}

/** Retorna o snapshot síncrono do status de conectividade atual */
export function getIsOnlineSnapshot(): boolean {
  return isOnlineState;
}

/** Inscreve um ouvinte para alterações de conectividade */
export function subscribeNetworkStatus(listener: NetworkListener): () => void {
  ensureListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reseta estado para testes */
export function resetNetworkStatusForTesting(initialValue = true): void {
  isOnlineState = initialValue;
  listeners.clear();
}
