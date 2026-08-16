import { useSyncExternalStore } from "react";

/**
 * Densidade de listas/tabelas (F8 — Decisão 4): alternância entre
 * **Confortável** (padrão) e **Compacta**, persistida no localStorage
 * (`financas_density`) e aplicada globalmente (TransactionRow, DataList).
 *
 * Store externa via useSyncExternalStore (padrão `src/app/pwa.ts`).
 */
export type Density = "comfortable" | "compact";

const STORAGE_KEY = "financas_density";

const listeners = new Set<() => void>();
let density: Density = "comfortable";

function readStored(): Density {
  return window.localStorage.getItem(STORAGE_KEY) === "compact" ? "compact" : "comfortable";
}

function subscribeDensity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Lê a densidade ativa (localStorage é a fonte da verdade — sem cache). */
export function getDensity(): Density {
  density = readStored();
  return density;
}

export function setDensity(next: Density): void {
  window.localStorage.setItem(STORAGE_KEY, next);
  if (density !== next) {
    density = next;
    listeners.forEach((listener) => listener());
  }
}

export function toggleDensity(): void {
  setDensity(getDensity() === "compact" ? "comfortable" : "compact");
}

/** Hook — componentes de lista/tabela leem a densidade ativa. */
export function useDensity(): Density {
  return useSyncExternalStore(subscribeDensity, getDensity, getDensity);
}
