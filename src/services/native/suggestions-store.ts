import { useSyncExternalStore } from "react";
import type { ParsedBankTransaction } from "@/domain/notifications";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

const STORAGE_KEY = "pending_suggestions";
const MAX_SUGGESTIONS = 20;

let memorySuggestions: ParsedBankTransaction[] = [];
let isLoaded = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function loadFromStorage(): void {
  const raw = getUserStorageItem(STORAGE_KEY);
  if (!raw) {
    memorySuggestions = [];
    isLoaded = true;
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memorySuggestions = parsed.filter(
        (item): item is ParsedBankTransaction =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.amountCents === "number" &&
          typeof item.description === "string" &&
          typeof item.date === "string",
      );
    } else {
      memorySuggestions = [];
    }
  } catch {
    memorySuggestions = [];
  }
  isLoaded = true;
}

function saveToStorage(): void {
  try {
    setUserStorageItem(STORAGE_KEY, JSON.stringify(memorySuggestions));
  } catch {
    // quota exceeded or storage disabled
  }
}

function ensureLoaded(): void {
  if (!isLoaded) {
    loadFromStorage();
  }
}

// Ao trocar de usuário ativo, recarrega o store
subscribeActiveUserId(() => {
  loadFromStorage();
  notify();
});

export function getPendingSuggestions(): ParsedBankTransaction[] {
  ensureLoaded();
  return memorySuggestions;
}

export function addPendingSuggestion(suggestion: ParsedBankTransaction): void {
  ensureLoaded();
  // Deduplicação: se já existe pelo id ou pelo rawText, não duplica
  const exists = memorySuggestions.some(
    (s) => s.id === suggestion.id || (s.rawText && s.rawText === suggestion.rawText),
  );
  if (exists) return;

  // Adiciona ao topo e limita ao máximo configurado
  memorySuggestions = [suggestion, ...memorySuggestions].slice(0, MAX_SUGGESTIONS);
  saveToStorage();
  notify();
}

export function dismissPendingSuggestion(id: string): void {
  ensureLoaded();
  const next = memorySuggestions.filter((s) => s.id !== id);
  if (next.length !== memorySuggestions.length) {
    memorySuggestions = next;
    saveToStorage();
    notify();
  }
}

export function clearPendingSuggestions(): void {
  ensureLoaded();
  if (memorySuggestions.length > 0) {
    memorySuggestions = [];
    saveToStorage();
    notify();
  }
}

export function subscribePendingSuggestions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingSuggestions(): ParsedBankTransaction[] {
  return useSyncExternalStore(
    subscribePendingSuggestions,
    getPendingSuggestions,
    getPendingSuggestions,
  );
}
