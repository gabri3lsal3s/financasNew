import { useSyncExternalStore } from "react";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
  getActiveUserId,
} from "@/services/user-storage";

/**
 * Densidade de listas/tabelas (F8 — Decisão 4): alternância entre
 * **Confortável** (padrão) e **Compacta**, persistida no storage do usuário
 * (`financas_${userId}_density`) e aplicada globalmente (TransactionRow, DataList).
 *
 * Store externa via useSyncExternalStore (padrão `src/app/pwa.ts`).
 */
export type Density = "comfortable" | "compact";

const STORAGE_KEY = "density";
const listeners = new Set<() => void>();
let density: Density = "comfortable";

function readStored(userId?: string | null): Density {
  const stored = getUserStorageItem(STORAGE_KEY, userId);
  return stored === "compact" ? "compact" : "comfortable";
}

// Inicializa a densidade com base no storage
density = readStored();

// Quando o usuário ativo muda (login / logout / switch), recarrega a densidade correspondente
if (typeof window !== "undefined") {
  subscribeActiveUserId((userId) => {
    density = readStored(userId);
    listeners.forEach((listener) => listener());
  });
}

function subscribeDensity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Lê a densidade ativa (storage do usuário é a fonte da verdade). */
export function getDensity(): Density {
  return density;
}

export function setDensity(next: Density, userId?: string | null): void {
  setUserStorageItem(STORAGE_KEY, next, userId);
  if (density !== next) {
    density = next;
    listeners.forEach((listener) => listener());
  }
}

export function toggleDensity(userId?: string | null): void {
  setDensity(getDensity() === "compact" ? "comfortable" : "compact", userId);
}

export function resetDensity(userId?: string | null): void {
  density = readStored(userId ?? getActiveUserId());
  listeners.forEach((listener) => listener());
}

/** Hook — componentes de lista/tabela leem a densidade ativa. */
export function useDensity(): Density {
  return useSyncExternalStore(subscribeDensity, getDensity, getDensity);
}
