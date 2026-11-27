/**
 * Utilitários criptográficos Web Crypto (AES-GCM 256-bit com rotação de chave
 * e geração de identificadores opacos de alta entropia).
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateOpaqueToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key.trim());
  if (raw.byteLength !== 32) {
    throw new Error("Chave AES-GCM deve ter exatamente 32 bytes (256 bits).");
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptTokenPayload(
  plaintext: string,
  currentKeyBase64: string,
  keyVersion = "current",
): Promise<string> {
  const key = await importAesKey(currentKeyBase64);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext),
  );
  const cipherBytes = new Uint8Array(cipherBuffer);
  return `v1:${keyVersion}:${toBase64(iv)}:${toBase64(cipherBytes)}`;
}

export async function decryptTokenPayload(
  envelope: string,
  currentKeyBase64: string,
  previousKeyBase64?: string,
): Promise<string> {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Envelope criptográfico inválido.");
  }

  const [, keyVersion, ivB64, cipherB64] = parts;
  const iv = fromBase64(ivB64);
  const cipherBytes = fromBase64(cipherB64);

  const candidates: string[] = [];
  if (keyVersion === "previous" && previousKeyBase64?.trim()) {
    candidates.push(previousKeyBase64, currentKeyBase64);
  } else {
    candidates.push(currentKeyBase64);
    if (previousKeyBase64?.trim()) {
      candidates.push(previousKeyBase64);
    }
  }

  for (const candidate of candidates) {
    try {
      const key = await importAesKey(candidate);
      const plainBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherBytes,
      );
      return textDecoder.decode(plainBuffer);
    } catch {
      // Tenta a chave anterior se configurada
    }
  }

  throw new Error("Falha ao decifrar credencial custodiada.");
}
