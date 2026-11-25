import type {
  ParsedBankTransaction,
  ReceiptUserContext,
  ResolvedMerchantIdentity,
} from "@/domain/notifications";
import { computeSha256Hex } from "@/services/sha256-fallback";
import {
  getUserStorageItem,
  removeUserStorageItem,
  setUserStorageItem,
} from "@/services/user-storage";

const RECEIPT_SCAN_CACHE_STORAGE_KEY = "receipt_scan_cache_v1";
const RECEIPT_SCAN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const RECEIPT_SCAN_CACHE_MAX_ENTRIES = 50;

export interface CachedReceiptScanEntry {
  sha256: string;
  contextSig: string;
  cachedAt: number;
  parsed: Omit<ParsedBankTransaction, "rawText">;
  identity: ResolvedMerchantIdentity;
  kindLabel: string;
}

export function buildContextSignature(userContext?: ReceiptUserContext): string {
  const normalizedName = (userContext?.userFullName ?? "").trim().toLowerCase();
  const hasCpf = Boolean(userContext?.userCpf && userContext.userCpf.trim().length > 0);
  if (!normalizedName && !hasCpf) return "";
  const input = `${normalizedName}|${hasCpf ? "cpf1" : "cpf0"}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function readLocalCacheEntries(userId?: string | null): CachedReceiptScanEntry[] {
  const raw = getUserStorageItem(RECEIPT_SCAN_CACHE_STORAGE_KEY, userId);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RECEIPT_SCAN_CACHE_TTL_MS;
    return parsed.filter(
      (item): item is CachedReceiptScanEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CachedReceiptScanEntry).sha256 === "string" &&
        typeof (item as CachedReceiptScanEntry).cachedAt === "number" &&
        (item as CachedReceiptScanEntry).cachedAt >= cutoff &&
        typeof (item as CachedReceiptScanEntry).parsed === "object" &&
        (item as CachedReceiptScanEntry).parsed !== null &&
        typeof (item as CachedReceiptScanEntry).identity === "object" &&
        (item as CachedReceiptScanEntry).identity !== null,
    );
  } catch {
    return [];
  }
}

function writeLocalCacheEntries(
  entries: CachedReceiptScanEntry[],
  userId?: string | null,
): void {
  const trimmed = [...entries]
    .sort((a, b) => b.cachedAt - a.cachedAt)
    .slice(0, RECEIPT_SCAN_CACHE_MAX_ENTRIES);
  setUserStorageItem(RECEIPT_SCAN_CACHE_STORAGE_KEY, JSON.stringify(trimmed), userId);
}

export function lookupLocalReceiptCache(
  sha256: string,
  userContext?: ReceiptUserContext,
  userId?: string | null,
): CachedReceiptScanEntry | null {
  const contextSig = buildContextSignature(userContext);
  const validEntries = readLocalCacheEntries(userId);
  const match = validEntries.find(
    (entry) => entry.sha256 === sha256 && entry.contextSig === contextSig,
  );
  return match ?? null;
}

export function saveLocalReceiptCache(
  sha256: string,
  resolved: {
    parsed: ParsedBankTransaction;
    identity: ResolvedMerchantIdentity;
    kindLabel: string;
  },
  userContext?: ReceiptUserContext,
  userId?: string | null,
): void {
  const contextSig = buildContextSignature(userContext);
  // Política LGPD: nunca persistir rawText nem conteúdo bruto de imagem no localStorage
  const parsedWithoutRawText = { ...resolved.parsed };
  delete (parsedWithoutRawText as { rawText?: string }).rawText;

  const nextEntry: CachedReceiptScanEntry = {
    sha256,
    contextSig,
    cachedAt: Date.now(),
    parsed: parsedWithoutRawText,
    identity: resolved.identity,
    kindLabel: resolved.kindLabel,
  };

  const existing = readLocalCacheEntries(userId).filter(
    (entry) => !(entry.sha256 === sha256 && entry.contextSig === contextSig),
  );
  existing.unshift(nextEntry);
  writeLocalCacheEntries(existing, userId);
}

/**
 * Remove entradas armazenadas em cache local para o usuário ativo (ou userId informado).
 */
export function clearLocalReceiptScanCache(userId?: string | null): void {
  removeUserStorageItem(RECEIPT_SCAN_CACHE_STORAGE_KEY, userId);
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível ler os bytes do arquivo."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha de leitura."));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Calcula o hash SHA-256 em hexadecimal minúsculo de um arquivo ou Blob.
 * Retorna `null` silenciosamente caso Web Crypto Subtle não esteja disponível.
 */
export async function computeFileSha256(file: Blob): Promise<string | null> {
  try {
    const buffer = await readBlobAsArrayBuffer(file);
    return await computeSha256Hex(new Uint8Array(buffer));
  } catch {
    return null;
  }
}
