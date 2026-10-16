import { useSyncExternalStore } from "react";
import type { ParsedBankTransaction } from "@/domain/notifications";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

const STORAGE_KEY = "pending_suggestions";
const MAX_SUGGESTIONS = 20;

/** TTL de 7 dias para expiração automática de notificações bancárias na fila. */
export const SUGGESTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let memorySuggestions: ParsedBankTransaction[] = [];
let isLoaded = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Gera chave composta para identificação unívoca anti-duplicação:
 * `bankName + amountCents + date + merchant`
 */
export function getSuggestionCompositeKey(s: ParsedBankTransaction): string {
  const bank = (s.bankName || "").toLowerCase().trim();
  const cents = s.amountCents;
  const date = (s.date || "").trim();
  const merchant = (s.merchant || s.description || "").toLowerCase().trim();
  return `${bank}_${cents}_${date}_${merchant}`;
}

/**
 * Determina se uma sugestão já atingiu a janela de expiração (TTL de 7 dias).
 */
export function isSuggestionExpired(
  suggestion: ParsedBankTransaction,
  now = Date.now(),
): boolean {
  if (suggestion.timestamp && typeof suggestion.timestamp === "number") {
    return now - suggestion.timestamp > SUGGESTION_TTL_MS;
  }
  if (suggestion.date) {
    const parsedDateMs = new Date(`${suggestion.date}T23:59:59`).getTime();
    if (!Number.isNaN(parsedDateMs)) {
      return now - parsedDateMs > SUGGESTION_TTL_MS;
    }
  }
  return false;
}

/**
 * Remove sugestões com mais de 7 dias da memória e sincroniza no storage.
 */
function purgeExpiredSuggestions(now = Date.now()): boolean {
  const active = memorySuggestions.filter((s) => !isSuggestionExpired(s, now));
  if (active.length !== memorySuggestions.length) {
    memorySuggestions = active;
    saveToStorage();
    return true;
  }
  return false;
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
      const now = Date.now();
      memorySuggestions = parsed.filter(
        (item): item is ParsedBankTransaction =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.amountCents === "number" &&
          typeof item.description === "string" &&
          typeof item.date === "string" &&
          !isSuggestionExpired(item, now),
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
  purgeExpiredSuggestions();
  return memorySuggestions;
}

export function addPendingSuggestion(suggestion: ParsedBankTransaction): void {
  ensureLoaded();
  purgeExpiredSuggestions();

  // Não adiciona sugestões que já estejam expiradas
  if (isSuggestionExpired(suggestion)) return;

  const targetCompositeKey = getSuggestionCompositeKey(suggestion);

  // Deduplicação: ID, rawText idêntico ou mesma chave composta (bank + cents + date + merchant)
  const exists = memorySuggestions.some((s) => {
    if (s.id === suggestion.id) return true;
    if (s.rawText && suggestion.rawText && s.rawText === suggestion.rawText) return true;
    if (getSuggestionCompositeKey(s) === targetCompositeKey) return true;
    return false;
  });

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
