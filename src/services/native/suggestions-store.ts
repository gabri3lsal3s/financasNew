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

/** Janela temporal de 10 minutos (600.000 ms) para deduplicação cruzada entre comprovantes compartilhados e notificações push atrasadas. */
export const RECEIPT_DEDUPLICATION_WINDOW_MS = 10 * 60 * 1000;

export interface ReceiptDeduplicationRecord {
  amountCents: number;
  date: string;
  merchant?: string;
  taxId?: string;
  txId?: string;
  timestamp: number;
  rawText?: string;
  transaction?: ParsedBankTransaction;
}

let recentReceipts: ReceiptDeduplicationRecord[] = [];

export function clearRecentReceipts(): void {
  recentReceipts = [];
}

export function getRecentReceipts(): ReceiptDeduplicationRecord[] {
  return [...recentReceipts];
}

function purgeRecentReceipts(now = Date.now()): void {
  recentReceipts = recentReceipts.filter(
    (r) => Math.abs(now - r.timestamp) <= RECEIPT_DEDUPLICATION_WINDOW_MS,
  );
}

export function registerReceiptDeduplication(receipt: ParsedBankTransaction): void {
  purgeRecentReceipts();
  const timestamp = receipt.timestamp || Date.now();
  const alreadyRegistered = recentReceipts.some(
    (r) =>
      r.amountCents === receipt.amountCents &&
      Math.abs(r.timestamp - timestamp) <= RECEIPT_DEDUPLICATION_WINDOW_MS &&
      (r.txId === receipt.txId || r.merchant === (receipt.merchant || receipt.description)),
  );
  if (alreadyRegistered) return;

  recentReceipts.push({
    amountCents: receipt.amountCents,
    date: receipt.date,
    merchant: receipt.merchant || receipt.description,
    taxId: receipt.taxId,
    txId: receipt.txId,
    timestamp,
    rawText: receipt.rawText,
    transaction: receipt,
  });
}

/**
 * Avalia se uma notificação push colide com um comprovante já registrado dentro da janela de 10 minutos.
 */
export function isPushDuplicateOfReceipt(
  push: ParsedBankTransaction,
  now = Date.now(),
): boolean {
  purgeRecentReceipts(now);

  // 1. Checa no registro em memória de comprovantes recentes
  for (const record of recentReceipts) {
    if (record.amountCents !== push.amountCents) continue;

    const dummyReceiptTx: ParsedBankTransaction = record.transaction ?? {
      id: "receipt_record",
      bankName: "Comprovante",
      nature: push.nature,
      type: push.type,
      amountCents: record.amountCents,
      description: record.merchant || "",
      merchant: record.merchant,
      date: record.date,
      rawText: record.rawText || "",
      timestamp: record.timestamp,
      taxId: record.taxId,
      txId: record.txId,
      source: "receipt",
    };

    if (!isWithinTemporalWindow(dummyReceiptTx, push, RECEIPT_DEDUPLICATION_WINDOW_MS)) {
      continue;
    }

    if (push.txId && record.txId && push.txId === record.txId) {
      return true;
    }

    if (push.taxId && record.taxId && push.taxId === record.taxId) {
      return true;
    }

    if (areMerchantsCompatible(dummyReceiptTx, push)) {
      return true;
    }

    if (record.merchant && push.rawText) {
      const normPushRaw = push.rawText.toLowerCase();
      const normMerchant = record.merchant.toLowerCase();
      if (normPushRaw.includes(normMerchant)) {
        return true;
      }
    }
  }

  // 2. Checa em memorySuggestions caso haja um comprovante ativo persistido
  for (const item of memorySuggestions) {
    const itemIsReceipt = item.source === "receipt" || item.id.startsWith("pix_");
    if (!itemIsReceipt) continue;

    if (item.amountCents !== push.amountCents) continue;

    if (!isWithinTemporalWindow(item, push, RECEIPT_DEDUPLICATION_WINDOW_MS)) {
      continue;
    }

    if (push.txId && item.txId && push.txId === item.txId) {
      return true;
    }

    if (push.taxId && item.taxId && push.taxId === item.taxId) {
      return true;
    }

    if (areMerchantsCompatible(item, push)) {
      return true;
    }

    if (item.merchant && push.rawText) {
      const normPushRaw = push.rawText.toLowerCase();
      const normMerchant = item.merchant.toLowerCase();
      if (normPushRaw.includes(normMerchant)) {
        return true;
      }
    }
  }

  return false;
}

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
 * `source + bankName + amountCents + date + merchant`
 */
function getSuggestionCompositeKey(s: ParsedBankTransaction): string {
  const source = s.source || (s.id.startsWith("pix_") ? "receipt" : "notification");
  const bank = (s.bankName || "").toLowerCase().trim();
  const cents = s.amountCents;
  const date = (s.date || "").trim();
  const merchant = (s.merchant || s.description || "").toLowerCase().trim();
  return `${source}_${bank}_${cents}_${date}_${merchant}`;
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

  const isReceipt = suggestion.source === "receipt" || suggestion.id.startsWith("pix_");

  if (isReceipt) {
    registerReceiptDeduplication(suggestion);

    // Se já existia uma notificação push prévia para esta mesma transação na lista,
    // substitui a notificação pelo comprovante mais rico
    const existingPushIndex = memorySuggestions.findIndex((existing) => {
      if (existing.source === "receipt" || existing.id.startsWith("pix_")) return false;
      const isSameAmount = existing.amountCents === suggestion.amountCents;
      const isSameWindow = isWithinTemporalWindow(existing, suggestion, RECEIPT_DEDUPLICATION_WINDOW_MS);
      return (
        isSameAmount &&
        isSameWindow &&
        (areMerchantsCompatible(existing, suggestion) ||
          (Boolean(existing.taxId) && Boolean(suggestion.taxId) && existing.taxId === suggestion.taxId) ||
          (Boolean(existing.txId) && Boolean(suggestion.txId) && existing.txId === suggestion.txId))
      );
    });

    if (existingPushIndex !== -1) {
      memorySuggestions[existingPushIndex] = suggestion;
      saveToStorage();
      notify();
      return;
    }
  } else {
    // É uma notificação push: descarta silenciosamente se colidir com comprovante recente
    if (isPushDuplicateOfReceipt(suggestion)) {
      return;
    }
  }

  const targetCompositeKey = getSuggestionCompositeKey(suggestion);

  // Deduplicação: ID, rawText idêntico ou mesma chave composta (bank + cents + date + merchant)
  const exists = memorySuggestions.some((s) => {
    if (s.id === suggestion.id) return true;
    if (s.rawText && suggestion.rawText && s.rawText === suggestion.rawText) return true;
    if (getSuggestionCompositeKey(s) === targetCompositeKey) {
      if (
        typeof s.timestamp === "number" &&
        typeof suggestion.timestamp === "number" &&
        Math.abs(s.timestamp - suggestion.timestamp) > RECEIPT_DEDUPLICATION_WINDOW_MS
      ) {
        return false;
      }
      return true;
    }
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
  clearRecentReceipts();
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
