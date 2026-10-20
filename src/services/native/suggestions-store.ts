import { useSyncExternalStore } from "react";
import {
  areMerchantsCompatible,
  DEDUPLICATION_WINDOW_MS,
  isCardBrand,
  isDigitalWallet,
  isWithinTemporalWindow,
  mergeWalletWithBank,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

const STORAGE_KEY = "pending_suggestions";
const MAX_SUGGESTIONS = 20;

/** TTL de 7 dias para expiração automática de notificações bancárias na fila. */
const SUGGESTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
function getSuggestionCompositeKey(s: ParsedBankTransaction): string {
  const bank = (s.bankName || "").toLowerCase().trim();
  const cents = s.amountCents;
  const date = (s.date || "").trim();
  const merchant = (s.merchant || s.description || "").toLowerCase().trim();
  return `${bank}_${cents}_${date}_${merchant}`;
}

/**
 * Determina se uma sugestão já atingiu a janela de expiração (TTL de 7 dias).
 */
function isSuggestionExpired(
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
          typeof item.bankName === "string" &&
          item.bankName.trim().toLowerCase() !== "banco" &&
          item.bankName.trim() !== "" &&
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

  // Rejeita sugestões com banco genérico, inválido ou ausente
  if (!suggestion.bankName || suggestion.bankName.trim().toLowerCase() === "banco") {
    return;
  }

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

  // 2. Motor de Fusão Temporal e Deduplicação Inteligente (Janela de tolerância de 5 minutos)
  const incomingIsWallet = isDigitalWallet(suggestion.bankName);

  for (let i = 0; i < memorySuggestions.length; i++) {
    const existing = memorySuggestions[i]!;

    // Tolerância temporal de 5 minutos (300.000 ms) e valor rigorosamente idêntico (+- 0 centavos)
    const isSameAmount = existing.amountCents === suggestion.amountCents;
    const isSameWindow = isWithinTemporalWindow(existing, suggestion, DEDUPLICATION_WINDOW_MS);

    if (isSameAmount && isSameWindow && areMerchantsCompatible(existing, suggestion)) {
      const existingIsWallet = isDigitalWallet(existing.bankName);

      // CASO A: A notificação da Carteira Digital chegou primeiro e dentro de 5 min chega a do Banco Oficial
      // -> Fazer o merge: atribuir a transação ao banco oficial e manter a bandeira e dígitos do cartão
      if (existingIsWallet && !incomingIsWallet) {
        const merged = mergeWalletWithBank(existing, suggestion);
        memorySuggestions[i] = merged;
        saveToStorage();
        notify();
        return;
      }

      // CASO B: A notificação do Banco Oficial chegou primeiro e dentro de 5 min chega a da Carteira Digital
      // -> Rejeitar a notificação subsequente da carteira como duplicata (e enriquecer bandeira/dígitos se faltavam)
      if (!existingIsWallet && incomingIsWallet) {
        let enriched = false;
        if (!existing.cardBrand && (suggestion.cardBrand || isCardBrand(suggestion.issuerBank))) {
          existing.cardBrand =
            suggestion.cardBrand ||
            (isCardBrand(suggestion.issuerBank) ? suggestion.issuerBank : undefined);
          enriched = true;
        }
        if (!existing.cardLastDigits && suggestion.cardLastDigits) {
          existing.cardLastDigits = suggestion.cardLastDigits;
          enriched = true;
        }
        if (enriched) {
          saveToStorage();
          notify();
        }
        return; // Rejeitada como duplicata
      }

      // CASO C: Ambas são do mesmo banco emissor ou ambas são de carteiras digitais dentro da janela de 5 min
      // -> Rejeitar como duplicata
      if (
        existing.bankName.toLowerCase() === suggestion.bankName.toLowerCase() ||
        (existingIsWallet && incomingIsWallet)
      ) {
        return;
      }
    }
  }

  // 3. Adiciona ao topo e limita ao máximo configurado
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

export {
  areMerchantsCompatible,
  DEDUPLICATION_WINDOW_MS,
  isCardBrand,
  isDigitalWallet,
  isWithinTemporalWindow,
  mergeWalletWithBank,
};
