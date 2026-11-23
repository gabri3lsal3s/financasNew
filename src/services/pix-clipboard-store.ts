/**
 * Store singleton síncrono e cache FNV-1a (Trava 1) para detecção de Pix via área de transferência.
 *
 * Regras de segurança e UX:
 * - Hash síncrono FNV-1a 32-bit (zero async em ações de dispensar/consumir).
 * - Nunca persiste texto bruto copiado no localStorage: salva apenas `{ hash, dismissedAt }`.
 * - Limite estrito de 30 itens por usuário com expiração automática após 24 horas.
 * - Cooldown compartilhado de 10s para leituras passivas no Android nativo (evita spam de toast).
 */

import type {
  ClipboardParsedCandidate,
  ResolvedMerchantIdentity,
} from "@/domain/notifications";
import {
  getActiveUserId,
  getUserStorageItem,
  removeUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

export interface DetectedPixTransaction {
  candidate: ClipboardParsedCandidate;
  identity: ResolvedMerchantIdentity;
  rawText: string;
}

interface DismissedClipboardEntry {
  hash: string;
  dismissedAt: number;
}

export const DISMISSED_CLIPBOARD_HASHES_KEY = "dismissed_clipboard_hashes";
export const MAX_DISMISSED_HASHES = 30;
export const DISMISSED_HASH_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
export const NATIVE_CLIPBOARD_COOLDOWN_MS = 10_000; // 10 segundos

let currentDetectedPix: DetectedPixTransaction | null = null;
let lastNativeClipboardCheckAt = 0;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

subscribeActiveUserId(() => {
  if (currentDetectedPix !== null) {
    currentDetectedPix = null;
    notifyListeners();
  }
  lastNativeClipboardCheckAt = 0;
});

/**
 * Calcula hash síncrono FNV-1a 32-bit após normalizar espaços em branco.
 */
export function fnv1aHash(rawText: string): string {
  const normalized = rawText.replace(/\s+/g, " ").trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readDismissedEntries(userId?: string | null): DismissedClipboardEntry[] {
  const raw = getUserStorageItem(DISMISSED_CLIPBOARD_HASHES_KEY, userId);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - DISMISSED_HASH_TTL_MS;
    return parsed.filter(
      (item): item is DismissedClipboardEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as DismissedClipboardEntry).hash === "string" &&
        typeof (item as DismissedClipboardEntry).dismissedAt === "number" &&
        (item as DismissedClipboardEntry).dismissedAt >= cutoff,
    );
  } catch {
    return [];
  }
}

function writeDismissedEntries(
  entries: DismissedClipboardEntry[],
  userId?: string | null,
): void {
  const capped = [...entries]
    .sort((a, b) => b.dismissedAt - a.dismissedAt)
    .slice(0, MAX_DISMISSED_HASHES);
  setUserStorageItem(DISMISSED_CLIPBOARD_HASHES_KEY, JSON.stringify(capped), userId);
}

/** Verifica sincronamente se o texto já foi dispensado ou lançado nas últimas 24h. */
export function isClipboardTextDismissed(
  rawText: string,
  userId?: string | null,
): boolean {
  const trimmed = rawText.trim();
  if (!trimmed) return false;
  const hash = fnv1aHash(trimmed);
  return readDismissedEntries(userId).some((entry) => entry.hash === hash);
}

/** Registra o hash FNV-1a do texto do clipboard no storage isolado do usuário (sem salvar texto bruto). */
export function markClipboardTextDismissed(
  rawText: string,
  userId?: string | null,
): void {
  const trimmed = rawText.trim();
  if (!trimmed) return;
  const hash = fnv1aHash(trimmed);
  const now = Date.now();
  const next = readDismissedEntries(userId).filter((entry) => entry.hash !== hash);
  next.unshift({ hash, dismissedAt: now });
  writeDismissedEntries(next, userId);
}

/** Limpa os hashes dispensados do usuário informado (ou ativo). */
export function clearDismissedClipboardHashes(userId?: string | null): void {
  removeUserStorageItem(DISMISSED_CLIPBOARD_HASHES_KEY, userId);
}

/** Retorna snapshot imutável do Pix detectado atualmente para `useSyncExternalStore`. */
export function getDetectedPixSnapshot(): DetectedPixTransaction | null {
  return currentDetectedPix;
}

/** Inscreve listener reativo para mudanças na detecção global do clipboard. */
export function subscribeDetectedPix(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Atualiza o estado global da sugestão detectada (deduplicando se rawText não mudou). */
export function setDetectedPixState(next: DetectedPixTransaction | null): void {
  if (
    currentDetectedPix?.rawText === next?.rawText &&
    Boolean(currentDetectedPix) === Boolean(next)
  ) {
    return;
  }
  currentDetectedPix = next;
  notifyListeners();
}

/** Dispensa a sugestão atual e grava seu hash FNV-1a em `user-storage`. */
export function dismissCurrentDetectedPix(userId?: string | null): void {
  if (currentDetectedPix?.rawText) {
    markClipboardTextDismissed(currentDetectedPix.rawText, userId ?? getActiveUserId());
  }
  if (currentDetectedPix !== null) {
    currentDetectedPix = null;
    notifyListeners();
  }
}

/** Consome a sugestão ao lançar/colar no Wizard e registra o hash FNV-1a para não reaparecer. */
export function consumeCurrentDetectedPix(
  rawTextOverride?: string,
  userId?: string | null,
): void {
  const targetText = rawTextOverride?.trim() || currentDetectedPix?.rawText;
  if (targetText) {
    markClipboardTextDismissed(targetText, userId ?? getActiveUserId());
  }
  if (currentDetectedPix !== null) {
    currentDetectedPix = null;
    notifyListeners();
  }
}

/** Informa se já passou o cooldown mínimo (padrão 10s) desde a última leitura passiva nativa. */
export function canTriggerNativeClipboardCheck(
  cooldownMs = NATIVE_CLIPBOARD_COOLDOWN_MS,
): boolean {
  return Date.now() - lastNativeClipboardCheckAt >= cooldownMs;
}

/** Registra o timestamp da leitura passiva nativa atual para aplicar cooldown. */
export function recordNativeClipboardCheck(): void {
  lastNativeClipboardCheckAt = Date.now();
}

/** Utilitário exclusivo para isolamento limpo em testes unitários. */
export function resetPixClipboardStoreForTests(): void {
  currentDetectedPix = null;
  lastNativeClipboardCheckAt = 0;
  clearDismissedClipboardHashes(getActiveUserId());
  clearDismissedClipboardHashes("user-1");
  clearDismissedClipboardHashes(null);
  notifyListeners();
}
