import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from "@/services/user-storage";
import { setAppLocked } from "./app-lock";

const KEY_PIN_HASH = "app_pin_hash";
const KEY_PIN_SALT = "app_pin_salt";
const KEY_PIN_LOCKOUT = "app_pin_lockout";

export interface PinLockoutState {
  failedAttempts: number;
  lockedUntilMs: number | null;
}

const EMPTY_LOCKOUT_STATE: PinLockoutState = {
  failedAttempts: 0,
  lockedUntilMs: null,
};

function bufToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function derivePinHash(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  const keyBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return bufToHex(keyBuffer);
}

/**
 * Regra pura de cálculo de backoff progressivo para tentativas falhas de PIN:
 * - 1 a 4 erros: sem espera (`lockedUntilMs: null`)
 * - 5 a 9 erros: espera progressiva a partir de 30s (`30s * (tentativa - 4)`)
 * - >= 10 erros: espera de 5 minutos (`300s`)
 */
export function computePinLockoutAfterFailure(
  currentFailedAttempts: number,
  nowMs = Date.now(),
): PinLockoutState {
  const nextAttempts = Math.max(0, currentFailedAttempts) + 1;
  if (nextAttempts < 5) {
    return { failedAttempts: nextAttempts, lockedUntilMs: null };
  }
  if (nextAttempts >= 10) {
    return { failedAttempts: nextAttempts, lockedUntilMs: nowMs + 5 * 60 * 1000 };
  }
  const durationMs = 30_000 * (nextAttempts - 4);
  return { failedAttempts: nextAttempts, lockedUntilMs: nowMs + durationMs };
}

/**
 * Lê o estado persistido de lockout de PIN isolado por `userId`.
 */
export function getPinLockoutState(userId?: string | null): PinLockoutState {
  const raw = getUserStorageItem(KEY_PIN_LOCKOUT, userId);
  if (!raw) return { ...EMPTY_LOCKOUT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<PinLockoutState>;
    const failedAttempts =
      typeof parsed.failedAttempts === "number" && Number.isFinite(parsed.failedAttempts)
        ? Math.max(0, parsed.failedAttempts)
        : 0;
    const lockedUntilMs =
      typeof parsed.lockedUntilMs === "number" && Number.isFinite(parsed.lockedUntilMs)
        ? parsed.lockedUntilMs
        : null;
    return { failedAttempts, lockedUntilMs };
  } catch {
    return { ...EMPTY_LOCKOUT_STATE };
  }
}

/**
 * Retorna os segundos restantes de bloqueio temporário por excesso de tentativas.
 */
export function getRemainingPinLockoutSeconds(
  userId?: string | null,
  nowMs = Date.now(),
): number {
  const { lockedUntilMs } = getPinLockoutState(userId);
  if (!lockedUntilMs || lockedUntilMs <= nowMs) return 0;
  return Math.ceil((lockedUntilMs - nowMs) / 1000);
}

/**
 * Registra uma falha de PIN e persiste o estado de backoff em `user-storage`.
 */
export function recordPinFailure(
  userId?: string | null,
  nowMs = Date.now(),
): PinLockoutState {
  const current = getPinLockoutState(userId);
  const next = computePinLockoutAfterFailure(current.failedAttempts, nowMs);
  setUserStorageItem(KEY_PIN_LOCKOUT, JSON.stringify(next), userId);
  return next;
}

/**
 * Limpa o contador de tentativas falhas e o bloqueio temporário do PIN.
 */
export function clearPinLockout(userId?: string | null): void {
  removeUserStorageItem(KEY_PIN_LOCKOUT, userId);
}

/**
 * Verifica se o usuário possui um PIN numérico local configurado.
 */
export function isPinLockConfigured(userId?: string | null): boolean {
  const hash = getUserStorageItem(KEY_PIN_HASH, userId);
  return Boolean(hash && hash.length > 0);
}

/**
 * Configura ou atualiza o PIN local (de 4 a 6 dígitos numéricos) utilizando PBKDF2/SHA-256.
 */
export async function setPinLock(pin: string, userId?: string | null): Promise<void> {
  const cleanPin = pin.trim();
  if (!/^\d{4,6}$/.test(cleanPin)) {
    throw new Error("O PIN deve conter entre 4 e 6 dígitos numéricos.");
  }

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const hash = await derivePinHash(cleanPin, salt);
  const saltHex = bufToHex(salt.buffer);

  setUserStorageItem(KEY_PIN_SALT, saltHex, userId);
  setUserStorageItem(KEY_PIN_HASH, hash, userId);
  clearPinLockout(userId);
}

/**
 * Valida se o PIN informado confere com o hash armazenado.
 */
export async function verifyPinLock(pin: string, userId?: string | null): Promise<boolean> {
  const cleanPin = pin.trim();
  if (!/^\d{4,6}$/.test(cleanPin)) {
    return false;
  }

  const storedHash = getUserStorageItem(KEY_PIN_HASH, userId);
  const storedSaltHex = getUserStorageItem(KEY_PIN_SALT, userId);

  if (!storedHash || !storedSaltHex) {
    return false;
  }

  try {
    const salt = hexToBuf(storedSaltHex);
    const computedHash = await derivePinHash(cleanPin, salt);
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

/**
 * Remove o PIN local configurado.
 */
export function removePinLock(userId?: string | null): void {
  removeUserStorageItem(KEY_PIN_HASH, userId);
  removeUserStorageItem(KEY_PIN_SALT, userId);
  clearPinLockout(userId);
}

/**
 * Tenta desbloquear o aplicativo através do PIN numérico, aplicando o backoff persistido.
 */
export async function unlockAppWithPin(pin: string, userId?: string | null): Promise<boolean> {
  const remainingSec = getRemainingPinLockoutSeconds(userId);
  if (remainingSec > 0) {
    throw new Error(`Muitas tentativas incorretas. Aguarde ${remainingSec}s para tentar novamente.`);
  }

  const isValid = await verifyPinLock(pin, userId);
  if (isValid) {
    clearPinLockout(userId);
    setAppLocked(false);
    return true;
  }

  recordPinFailure(userId);
  return false;
}
