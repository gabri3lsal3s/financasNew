import { useSyncExternalStore } from "react";

/**
 * Modo Privacidade (F8 — Decisão 5): ofusca todos os valores monetários
 * instantaneamente (blur) para uso em locais públicos.
 *
 * Store externa via useSyncExternalStore (mesmo padrão de `src/app/pwa.ts` —
 * sem setState em effect/render). Estado de sessão: NÃO é persistido (volta ao
 * normal ao recarregar — comportamento intencional de privacidade).
 */

const listeners = new Set<() => void>();
let masked = false;

export function subscribePrivacyMask(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPrivacyMasked(): boolean {
  return masked;
}

export function setPrivacyMasked(next: boolean): void {
  if (masked === next) return;
  masked = next;
  listeners.forEach((listener) => listener());
}

export function togglePrivacyMask(): void {
  setPrivacyMasked(!masked);
}

/** Hook — componentes de valor (KpiCard, TransactionRow, MoneyInput…) leem o modo. */
export function usePrivacyMask(): boolean {
  return useSyncExternalStore(subscribePrivacyMask, getPrivacyMasked, getPrivacyMasked);
}
