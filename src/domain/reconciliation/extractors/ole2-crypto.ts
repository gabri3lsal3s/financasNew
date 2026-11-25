/**
 * Leitor de container OLE2/CFBF e descriptografia client-side MS-OFFCRYPTO
 * (Agile Encryption AES-128/256-CBC + SHA-1/256/512 e Standard Encryption AES-128/256-ECB + SHA-1).
 * 100% browser-native via Web Crypto API (`crypto.subtle`), zero dependências externas.
 */

import {
  computeSyncHash,
  normalizeHashAlgorithmName,
  sha1Sync,
  type SyncHashAlgorithm,
} from "./sync-hash";

const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;

const AGILE_VERIFIER_INPUT_BLOCK_KEY = new Uint8Array([
  0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79,
]);
const AGILE_VERIFIER_HASH_BLOCK_KEY = new Uint8Array([
  0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e,
]);
const AGILE_ENCRYPTED_KEY_BLOCK_KEY = new Uint8Array([
  0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6,
]);

export type EncryptedSpreadsheetErrorCode =
  | "ENCRYPTED_SPREADSHEET"
  | "INVALID_SPREADSHEET_PASSWORD"
  | "UNSUPPORTED_SPREADSHEET_ENCRYPTION";

export class EncryptedSpreadsheetError extends Error {
  readonly code: EncryptedSpreadsheetErrorCode;

  constructor(
    code: EncryptedSpreadsheetErrorCode = "ENCRYPTED_SPREADSHEET",
    message?: string,
  ) {
    const defaultMessage =
      code === "INVALID_SPREADSHEET_PASSWORD"
        ? "Senha incorreta para a planilha. Verifique e tente novamente."
        : code === "UNSUPPORTED_SPREADSHEET_ENCRYPTION"
          ? "Esta planilha usa uma criptografia legada não suportada no navegador. Remova a proteção ou exporte em PDF/CSV."
          : "Esta planilha está protegida por senha. Digite a senha para continuar.";
    super(message ?? defaultMessage);
    this.name = "EncryptedSpreadsheetError";
    this.code = code;
  }
}

export function isEncryptedSpreadsheetError(err: unknown): err is EncryptedSpreadsheetError {
  if (!err || typeof err !== "object") return false;
  if (err instanceof EncryptedSpreadsheetError) return true;
  const candidate = err as { name?: unknown; code?: unknown };
  return (
    candidate.name === "EncryptedSpreadsheetError" ||
    candidate.code === "ENCRYPTED_SPREADSHEET" ||
    candidate.code === "INVALID_SPREADSHEET_PASSWORD" ||
    candidate.code === "UNSUPPORTED_SPREADSHEET_ENCRYPTION"
  );
}

export function isSpreadsheetPasswordPromptError(err: unknown): boolean {
  if (!isEncryptedSpreadsheetError(err)) return false;
  return (
    err.code === "ENCRYPTED_SPREADSHEET" ||
    err.code === "INVALID_SPREADSHEET_PASSWORD"
  );
}

export interface Ole2DirectoryEntry {
  name: string;
  lowerName: string;
  entryType: number;
  startSector: number;
  streamSize: number;
}

export interface Ole2Container {
  entries: Ole2DirectoryEntry[];
  readStream: (entry: Ole2DirectoryEntry) => Uint8Array;
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function decodeUtf16Le(bytes: Uint8Array, offset: number, charCount: number): string {
  const out: string[] = [];
  const maxChars = Math.min(charCount, Math.floor((bytes.length - offset) / 2));
  for (let i = 0; i < maxChars; i++) {
    out.push(String.fromCharCode(u16(bytes, offset + i * 2)));
  }
  return out.join("");
}

export function hasOle2Magic(bytes: Uint8Array): boolean {
  if (bytes.length < OLE2_MAGIC.length) return false;
  for (let i = 0; i < OLE2_MAGIC.length; i++) {
    if (bytes[i] !== OLE2_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Abre um container OLE2 / CFBF e devolve as entradas de diretório + leitor de streams (FAT e MiniFAT).
 */
export function openOle2Container(bytes: Uint8Array): Ole2Container | null {
  if (bytes.length < 512 || !hasOle2Magic(bytes)) return null;

  const sectorShift = u16(bytes, 30);
  const sectorSize = 1 << sectorShift;
  const miniSectorShift = u16(bytes, 32);
  const miniSectorSize = 1 << miniSectorShift;
  const numFatSectors = u32(bytes, 44);
  const firstDirSector = u32(bytes, 48);
  const miniCutoff = u32(bytes, 56);
  const firstMiniFatSector = u32(bytes, 60);
  const numMiniFatSectors = u32(bytes, 64);
  const firstDifatSector = u32(bytes, 68);
  const numDifatSectors = u32(bytes, 72);

  if (sectorSize !== 512 && sectorSize !== 4096) return null;
  if (miniSectorSize <= 0 || miniSectorSize > sectorSize) return null;

  const sectorOffset = (sec: number) => 512 + sec * sectorSize;
  const readSector = (sec: number): Uint8Array => {
    const off = sectorOffset(sec);
    if (off < 0 || off + sectorSize > bytes.length) return new Uint8Array(0);
    return bytes.subarray(off, off + sectorSize);
  };

  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < numFatSectors; i++) {
    const s = u32(bytes, 76 + i * 4);
    if (s < FATSECT) fatSectors.push(s);
  }
  let difatSec = firstDifatSector;
  let difatGuard = 0;
  while (
    difatSec < FATSECT &&
    fatSectors.length < numFatSectors &&
    difatGuard++ < numDifatSectors + 2
  ) {
    const secData = readSector(difatSec);
    if (secData.length < sectorSize) break;
    const perSec = sectorSize / 4 - 1;
    for (let i = 0; i < perSec && fatSectors.length < numFatSectors; i++) {
      const s = u32(secData, i * 4);
      if (s < FATSECT) fatSectors.push(s);
    }
    difatSec = u32(secData, sectorSize - 4);
  }

  const fat: number[] = [];
  for (const s of fatSectors) {
    const secData = readSector(s);
    for (let o = 0; o + 4 <= secData.length; o += 4) {
      fat.push(u32(secData, o));
    }
  }

  const readChain = (startSec: number, expectedLen?: number): Uint8Array => {
    if (startSec >= FATSECT) return new Uint8Array(0);
    const chunks: Uint8Array[] = [];
    const visited = new Set<number>();
    let cur = startSec;
    while (cur < FATSECT && !visited.has(cur)) {
      visited.add(cur);
      const chunk = readSector(cur);
      if (chunk.length === 0) break;
      chunks.push(chunk);
      cur = fat[cur] ?? ENDOFCHAIN;
    }
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(
      expectedLen !== undefined ? Math.min(expectedLen, total) : total,
    );
    let pos = 0;
    for (const c of chunks) {
      const copyLen = Math.min(c.length, out.length - pos);
      if (copyLen <= 0) break;
      out.set(c.subarray(0, copyLen), pos);
      pos += copyLen;
    }
    return out;
  };

  const dirData = readChain(firstDirSector);
  if (dirData.length < 128) return null;

  let rootStart = ENDOFCHAIN;
  let rootSize = 0;
  const entries: Ole2DirectoryEntry[] = [];

  for (let off = 0; off + 128 <= dirData.length; off += 128) {
    const entryType = dirData[off + 66] ?? 0;
    if (entryType === 0) continue;
    const nameLen = u16(dirData, off + 64);
    if (nameLen < 2 || nameLen > 64) continue;
    const chars = Math.max(0, Math.floor((nameLen - 2) / 2));
    const name = decodeUtf16Le(dirData, off, chars);
    const startSector = u32(dirData, off + 116);
    const streamSize = u32(dirData, off + 120);

    if (entryType === 5) {
      rootStart = startSector;
      rootSize = streamSize;
    }
    entries.push({
      name,
      lowerName: name.toLowerCase(),
      entryType,
      startSector,
      streamSize,
    });
  }

  let cachedMiniStream: Uint8Array | null = null;
  let cachedMiniFat: number[] | null = null;

  const readStream = (entry: Ole2DirectoryEntry): Uint8Array => {
    if (entry.streamSize === 0) return new Uint8Array(0);
    if (entry.streamSize >= miniCutoff) {
      return readChain(entry.startSector, entry.streamSize);
    }
    if (!cachedMiniStream) {
      cachedMiniStream = readChain(rootStart, rootSize);
    }
    if (!cachedMiniFat) {
      const miniFatRaw =
        firstMiniFatSector < FATSECT && numMiniFatSectors > 0
          ? readChain(firstMiniFatSector)
          : new Uint8Array(0);
      cachedMiniFat = [];
      for (let o = 0; o + 4 <= miniFatRaw.length; o += 4) {
        cachedMiniFat.push(u32(miniFatRaw, o));
      }
    }
    const out = new Uint8Array(entry.streamSize);
    const visited = new Set<number>();
    let cur = entry.startSector;
    let pos = 0;
    while (cur < FATSECT && !visited.has(cur) && pos < out.length) {
      visited.add(cur);
      const off = cur * miniSectorSize;
      if (off >= cachedMiniStream.length) break;
      const copyLen = Math.min(miniSectorSize, out.length - pos, cachedMiniStream.length - off);
      out.set(cachedMiniStream.subarray(off, off + copyLen), pos);
      pos += copyLen;
      cur = cachedMiniFat[cur] ?? ENDOFCHAIN;
    }
    return out.subarray(0, pos);
  };

  return { entries, readStream };
}

/**
 * Identifica se um container OLE2 corresponde a um pacote OOXML criptografado
 * (`EncryptionInfo` + `EncryptedPackage`, padrão MS-OFFCRYPTO usado por BTG/Office).
 */
export function isEncryptedOle2OfficeFile(bytes: Uint8Array): boolean {
  const container = openOle2Container(bytes);
  if (!container) return false;
  const streamNames = new Set(
    container.entries.filter((e) => e.entryType === 2).map((e) => e.lowerName),
  );
  return streamNames.has("encryptioninfo") && streamNames.has("encryptedpackage");
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, "");
  if (typeof atob === "function") {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  const buf = Buffer.from(clean, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function encodeUtf16Le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = (code >>> 8) & 0xff;
  }
  return out;
}

function resizeWithBytePad(bytes: Uint8Array, targetLen: number, padByte: number): Uint8Array {
  const out = new Uint8Array(targetLen);
  if (bytes.length >= targetLen) {
    out.set(bytes.subarray(0, targetLen));
  } else {
    out.set(bytes);
    out.fill(padByte, bytes.length);
  }
  return out;
}

function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new EncryptedSpreadsheetError(
      "UNSUPPORTED_SPREADSHEET_ENCRYPTION",
      "Este navegador não oferece Web Crypto API para descriptografar planilhas protegidas.",
    );
  }
  return subtle;
}

async function importAesCbcKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.length !== 16 && rawKey.length !== 32) {
    throw new EncryptedSpreadsheetError(
      "UNSUPPORTED_SPREADSHEET_ENCRYPTION",
      `Tamanho de chave AES (${rawKey.length * 8} bits) não suportado no navegador.`,
    );
  }
  return getSubtleCrypto().importKey(
    "raw",
    toBufferSource(rawKey),
    { name: "AES-CBC" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Decifra ciphertext AES-CBC sem PKCS#7 padding via Web Crypto API nativa:
 * gera um bloco final de padding PKCS#7 (16 bytes de 0x10) encadeado ao último bloco de ciphertext,
 * permitindo que `subtle.decrypt("AES-CBC")` devolva exatamente o plaintext sem padding.
 */
async function aesCbcDecryptNoPad(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  if (ciphertext.length === 0) return new Uint8Array(0);
  const paddedLen = Math.ceil(ciphertext.length / 16) * 16;
  const aligned = new Uint8Array(paddedLen);
  aligned.set(ciphertext);

  const lastCipherBlock = aligned.subarray(aligned.length - 16);
  const subtle = getSubtleCrypto();
  const padBlockBuf = await subtle.encrypt(
    { name: "AES-CBC", iv: toBufferSource(lastCipherBlock) },
    key,
    new ArrayBuffer(0),
  );
  const padBlock = new Uint8Array(padBlockBuf);

  const extended = new Uint8Array(aligned.length + 16);
  extended.set(aligned, 0);
  extended.set(padBlock, aligned.length);

  const decryptedBuf = await subtle.decrypt(
    { name: "AES-CBC", iv: toBufferSource(iv) },
    key,
    toBufferSource(extended),
  );
  return new Uint8Array(decryptedBuf);
}

/**
 * Decifra AES-ECB (usado pelo MS-OFFCRYPTO Standard Encryption) bloco a bloco via AES-CBC com IV zerado.
 */
async function aesEcbDecryptNoPad(
  key: CryptoKey,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const blockCount = Math.floor(ciphertext.length / 16);
  const out = new Uint8Array(blockCount * 16);
  const zeroIv = new Uint8Array(16);
  for (let i = 0; i < blockCount; i++) {
    const block = ciphertext.subarray(i * 16, (i + 1) * 16);
    const plainBlock = await aesCbcDecryptNoPad(key, zeroIv, block);
    out.set(plainBlock.subarray(0, 16), i * 16);
  }
  return out;
}

function readXmlTagAttributes(xml: string, tagLocalName: string): Record<string, string> | null {
  const tagRegex = new RegExp(`<(?:[a-z0-9_-]+:)?${tagLocalName}\\b([^>]*)>`, "i");
  const match = tagRegex.exec(xml);
  if (!match?.[1]) return null;
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*"([^"]*)"/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(match[1])) !== null) {
    if (attrMatch[1] && attrMatch[2] !== undefined) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
  }
  return attrs;
}

function deriveAgileSpinHash(
  password: string,
  salt: Uint8Array,
  spinCount: number,
  hashAlg: SyncHashAlgorithm,
): Uint8Array {
  const passwordBytes = encodeUtf16Le(password);
  const initial = new Uint8Array(salt.length + passwordBytes.length);
  initial.set(salt, 0);
  initial.set(passwordBytes, salt.length);
  let h = computeSyncHash(hashAlg, initial);

  const iterBuf = new Uint8Array(4 + h.length);
  for (let i = 0; i < spinCount; i++) {
    iterBuf[0] = i & 0xff;
    iterBuf[1] = (i >>> 8) & 0xff;
    iterBuf[2] = (i >>> 16) & 0xff;
    iterBuf[3] = (i >>> 24) & 0xff;
    iterBuf.set(h, 4);
    h = computeSyncHash(hashAlg, iterBuf);
  }
  return h;
}

function deriveAgileBlockKey(
  spinHash: Uint8Array,
  blockKey: Uint8Array,
  keyBytesLen: number,
  hashAlg: SyncHashAlgorithm,
): Uint8Array {
  const combined = new Uint8Array(spinHash.length + blockKey.length);
  combined.set(spinHash, 0);
  combined.set(blockKey, spinHash.length);
  return resizeWithBytePad(computeSyncHash(hashAlg, combined), keyBytesLen, 0x36);
}

async function decryptAgilePackage(
  encryptionInfoBytes: Uint8Array,
  encryptedPackageBytes: Uint8Array,
  password: string,
): Promise<ArrayBuffer> {
  const xmlBytes = encryptionInfoBytes.subarray(8);
  const xmlText = new TextDecoder("utf-8", { fatal: false })
    .decode(xmlBytes)
    .replace(/\0+$/g, "");

  const keyDataAttrs = readXmlTagAttributes(xmlText, "keyData");
  const encKeyAttrs = readXmlTagAttributes(xmlText, "encryptedKey");
  if (!keyDataAttrs || !encKeyAttrs) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const keyDataCipher = (keyDataAttrs.cipherAlgorithm ?? "").toUpperCase();
  const encKeyCipher = (encKeyAttrs.cipherAlgorithm ?? "").toUpperCase();
  if (keyDataCipher !== "AES" || encKeyCipher !== "AES") {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const keyDataHashAlg = normalizeHashAlgorithmName(keyDataAttrs.hashAlgorithm ?? "");
  const encKeyHashAlg = normalizeHashAlgorithmName(encKeyAttrs.hashAlgorithm ?? "");
  if (!keyDataHashAlg || !encKeyHashAlg) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const spinCount = Number.parseInt(encKeyAttrs.spinCount ?? "100000", 10);
  if (!Number.isFinite(spinCount) || spinCount < 0 || spinCount > 2_000_000) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const encKeyBits = Number.parseInt(encKeyAttrs.keyBits ?? "128", 10);
  const encKeyBlockSize = Number.parseInt(encKeyAttrs.blockSize ?? "16", 10);
  const encKeySaltSize = Number.parseInt(encKeyAttrs.saltSize ?? "16", 10);
  const encKeyHashSize = Number.parseInt(encKeyAttrs.hashSize ?? "20", 10);
  const encKeySalt = decodeBase64(encKeyAttrs.saltValue ?? "");
  const encryptedVerifierHashInput = decodeBase64(
    encKeyAttrs.encryptedVerifierHashInput ?? "",
  );
  const encryptedVerifierHashValue = decodeBase64(
    encKeyAttrs.encryptedVerifierHashValue ?? "",
  );
  const encryptedKeyValue = decodeBase64(encKeyAttrs.encryptedKeyValue ?? "");

  const keyDataBits = Number.parseInt(keyDataAttrs.keyBits ?? "128", 10);
  const keyDataBlockSize = Number.parseInt(keyDataAttrs.blockSize ?? "16", 10);
  const keyDataSalt = decodeBase64(keyDataAttrs.saltValue ?? "");
  const keyDataChaining = (keyDataAttrs.cipherChaining ?? "ChainingModeCBC").toUpperCase();
  const encKeyChaining = (encKeyAttrs.cipherChaining ?? "ChainingModeCBC").toUpperCase();

  if (encKeyBlockSize !== 16 || keyDataBlockSize !== 16) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const spinHash = deriveAgileSpinHash(password, encKeySalt, spinCount, encKeyHashAlg);
  const encKeyBytesLen = Math.floor(encKeyBits / 8);
  const encIv = resizeWithBytePad(encKeySalt, 16, 0x36);

  const decryptWithMode = async (
    rawKey: Uint8Array,
    iv: Uint8Array,
    data: Uint8Array,
    chaining: string,
  ): Promise<Uint8Array> => {
    const cryptoKey = await importAesCbcKey(rawKey);
    if (chaining.includes("CBC")) {
      return aesCbcDecryptNoPad(cryptoKey, iv, data);
    }
    if (chaining.includes("ECB")) {
      return aesEcbDecryptNoPad(cryptoKey, data);
    }
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  };

  const verifierInputKey = deriveAgileBlockKey(
    spinHash,
    AGILE_VERIFIER_INPUT_BLOCK_KEY,
    encKeyBytesLen,
    encKeyHashAlg,
  );
  const verifierHashKey = deriveAgileBlockKey(
    spinHash,
    AGILE_VERIFIER_HASH_BLOCK_KEY,
    encKeyBytesLen,
    encKeyHashAlg,
  );

  const decryptedVerifierInput = await decryptWithMode(
    verifierInputKey,
    encIv,
    encryptedVerifierHashInput,
    encKeyChaining,
  );
  const decryptedVerifierHash = await decryptWithMode(
    verifierHashKey,
    encIv,
    encryptedVerifierHashValue,
    encKeyChaining,
  );

  const computedHash = computeSyncHash(
    encKeyHashAlg,
    decryptedVerifierInput.subarray(0, encKeySaltSize),
  );
  const expectedHash = decryptedVerifierHash.subarray(0, encKeyHashSize);
  if (!constantTimeEquals(computedHash, expectedHash)) {
    throw new EncryptedSpreadsheetError("INVALID_SPREADSHEET_PASSWORD");
  }

  const secretKeyWrapKey = deriveAgileBlockKey(
    spinHash,
    AGILE_ENCRYPTED_KEY_BLOCK_KEY,
    encKeyBytesLen,
    encKeyHashAlg,
  );
  const secretKeyPadded = await decryptWithMode(
    secretKeyWrapKey,
    encIv,
    encryptedKeyValue,
    encKeyChaining,
  );
  const secretKey = secretKeyPadded.subarray(0, Math.floor(keyDataBits / 8));
  const packageCryptoKey = await importAesCbcKey(secretKey);

  if (encryptedPackageBytes.length < 8) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }
  const unencryptedSize =
    u32(encryptedPackageBytes, 0) + u32(encryptedPackageBytes, 4) * 0x100000000;
  const cipherPayload = encryptedPackageBytes.subarray(8);
  if (unencryptedSize <= 0 || unencryptedSize > cipherPayload.length + 16) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const out = new Uint8Array(unencryptedSize);
  const segmentSize = 4096;
  const saltWithSeg = new Uint8Array(keyDataSalt.length + 4);
  saltWithSeg.set(keyDataSalt, 0);

  let outOffset = 0;
  let segmentIdx = 0;
  for (
    let inOffset = 0;
    inOffset < cipherPayload.length && outOffset < unencryptedSize;
    inOffset += segmentSize
  ) {
    const segEnd = Math.min(cipherPayload.length, inOffset + segmentSize);
    const cipherSeg = cipherPayload.subarray(inOffset, segEnd);
    saltWithSeg[keyDataSalt.length] = segmentIdx & 0xff;
    saltWithSeg[keyDataSalt.length + 1] = (segmentIdx >>> 8) & 0xff;
    saltWithSeg[keyDataSalt.length + 2] = (segmentIdx >>> 16) & 0xff;
    saltWithSeg[keyDataSalt.length + 3] = (segmentIdx >>> 24) & 0xff;

    const segIv = resizeWithBytePad(computeSyncHash(keyDataHashAlg, saltWithSeg), 16, 0x36);
    const plainSeg = keyDataChaining.includes("CBC")
      ? await aesCbcDecryptNoPad(packageCryptoKey, segIv, cipherSeg)
      : await aesEcbDecryptNoPad(packageCryptoKey, cipherSeg);
    const copyLen = Math.min(plainSeg.length, unencryptedSize - outOffset);
    out.set(plainSeg.subarray(0, copyLen), outOffset);
    outOffset += copyLen;
    segmentIdx += 1;
  }

  return out.buffer;
}

async function decryptStandardPackage(
  encryptionInfoBytes: Uint8Array,
  encryptedPackageBytes: Uint8Array,
  password: string,
): Promise<ArrayBuffer> {
  if (encryptionInfoBytes.length < 36) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }
  const headerSize = u32(encryptionInfoBytes, 8);
  const headerStart = 12;
  const verifierStart = headerStart + headerSize;
  if (verifierStart + 24 > encryptionInfoBytes.length) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const algId = u32(encryptionInfoBytes, headerStart + 8);
  const algIdHash = u32(encryptionInfoBytes, headerStart + 12);
  let keyBits = u32(encryptionInfoBytes, headerStart + 16);
  if (keyBits === 0) {
    keyBits = algId === 0x6610 ? 256 : 128;
  }
  const isAes = algId === 0x660e || algId === 0x660f || algId === 0x6610 || algId === 0;
  const isSha1 = algIdHash === 0x8004 || algIdHash === 0;
  if (!isAes || !isSha1 || (keyBits !== 128 && keyBits !== 256)) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const saltSize = u32(encryptionInfoBytes, verifierStart);
  if (
    saltSize !== 16 ||
    verifierStart + 4 + saltSize + 16 + 4 + 32 > encryptionInfoBytes.length
  ) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }
  const salt = encryptionInfoBytes.subarray(verifierStart + 4, verifierStart + 20);
  const encryptedVerifier = encryptionInfoBytes.subarray(verifierStart + 20, verifierStart + 36);
  const verifierHashSize = u32(encryptionInfoBytes, verifierStart + 36);
  const encryptedVerifierHash = encryptionInfoBytes.subarray(
    verifierStart + 40,
    verifierStart + 72,
  );

  const spinHash = deriveAgileSpinHash(password, salt, 50_000, "SHA1");
  const hFinalInput = new Uint8Array(spinHash.length + 4);
  hFinalInput.set(spinHash, 0);
  const hFinal = sha1Sync(hFinalInput);

  const buf1 = new Uint8Array(64).fill(0x36);
  const buf2 = new Uint8Array(64).fill(0x5c);
  for (let i = 0; i < hFinal.length; i++) {
    buf1[i] = (buf1[i] ?? 0x36) ^ (hFinal[i] ?? 0);
    buf2[i] = (buf2[i] ?? 0x5c) ^ (hFinal[i] ?? 0);
  }
  const x1 = sha1Sync(buf1);
  const x2 = sha1Sync(buf2);
  const fullKey = new Uint8Array(40);
  fullKey.set(x1, 0);
  fullKey.set(x2, 20);
  const rawKey = fullKey.subarray(0, Math.floor(keyBits / 8));
  const cryptoKey = await importAesCbcKey(rawKey);

  const verifier = await aesEcbDecryptNoPad(cryptoKey, encryptedVerifier);
  const decryptedHash = await aesEcbDecryptNoPad(cryptoKey, encryptedVerifierHash);
  const actualHash = sha1Sync(verifier);
  if (
    !constantTimeEquals(
      actualHash.subarray(0, verifierHashSize),
      decryptedHash.subarray(0, verifierHashSize),
    )
  ) {
    throw new EncryptedSpreadsheetError("INVALID_SPREADSHEET_PASSWORD");
  }

  if (encryptedPackageBytes.length < 8) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }
  const unencryptedSize =
    u32(encryptedPackageBytes, 0) + u32(encryptedPackageBytes, 4) * 0x100000000;
  const cipherPayload = encryptedPackageBytes.subarray(8);
  if (unencryptedSize <= 0 || unencryptedSize > cipherPayload.length + 16) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const plainAll = await aesEcbDecryptNoPad(cryptoKey, cipherPayload);
  return plainAll.slice(0, unencryptedSize).buffer;
}

/**
 * Descriptografa uma planilha OOXML protegida por senha (`.xlsx`/`.xlsm` em container OLE2 MS-OFFCRYPTO)
 * e devolve o `ArrayBuffer` ZIP aberto pronto para `parseSpreadsheetOrHtmlToRows`.
 */
export async function decryptOfficeSpreadsheet(
  buffer: ArrayBuffer,
  password: string,
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(buffer);
  const container = openOle2Container(bytes);
  if (!container) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const encInfoEntry = container.entries.find(
    (e) => e.entryType === 2 && e.lowerName === "encryptioninfo",
  );
  const encPkgEntry = container.entries.find(
    (e) => e.entryType === 2 && e.lowerName === "encryptedpackage",
  );
  if (!encInfoEntry || !encPkgEntry) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const encryptionInfoBytes = container.readStream(encInfoEntry);
  const encryptedPackageBytes = container.readStream(encPkgEntry);
  if (encryptionInfoBytes.length < 8 || encryptedPackageBytes.length < 8) {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const versionMajor = u16(encryptionInfoBytes, 0);
  const versionMinor = u16(encryptionInfoBytes, 2);

  let decryptedBuffer: ArrayBuffer;
  if (versionMajor === 4 && versionMinor === 4) {
    decryptedBuffer = await decryptAgilePackage(
      encryptionInfoBytes,
      encryptedPackageBytes,
      password,
    );
  } else if (
    (versionMajor === 2 || versionMajor === 3 || versionMajor === 4) &&
    versionMinor === 2
  ) {
    decryptedBuffer = await decryptStandardPackage(
      encryptionInfoBytes,
      encryptedPackageBytes,
      password,
    );
  } else {
    throw new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");
  }

  const outBytes = new Uint8Array(decryptedBuffer);
  if (
    outBytes.length < 4 ||
    outBytes[0] !== 0x50 ||
    outBytes[1] !== 0x4b ||
    outBytes[2] !== 0x03 ||
    outBytes[3] !== 0x04
  ) {
    throw new EncryptedSpreadsheetError("INVALID_SPREADSHEET_PASSWORD");
  }
  return decryptedBuffer;
}
