import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from "@/services/user-storage";
import { setAppLocked } from "./app-lock";

const KEY_PIN_HASH = "app_pin_hash";
const KEY_PIN_SALT = "app_pin_salt";

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
}

/**
 * Tenta desbloquear o aplicativo através do PIN numérico.
 */
export async function unlockAppWithPin(pin: string, userId?: string | null): Promise<boolean> {
  const isValid = await verifyPinLock(pin, userId);
  if (isValid) {
    setAppLocked(false);
    return true;
  }
  return false;
}
