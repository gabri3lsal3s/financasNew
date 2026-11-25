import { createCipheriv, createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptOfficeSpreadsheet,
  EncryptedSpreadsheetError,
  hasOle2Magic,
  isEncryptedOle2OfficeFile,
  isEncryptedSpreadsheetError,
  isSpreadsheetPasswordPromptError,
  openOle2Container,
} from "./ole2-crypto";

const SECTOR_SIZE = 512;
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const FATSECT = 0xfffffffd;

function writeU16Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function writeDirEntry(
  dirBytes: Uint8Array,
  index: number,
  name: string,
  entryType: number,
  startSector: number,
  streamSize: number,
): void {
  const base = index * 128;
  for (let idx = 0; idx < name.length; idx++) {
    writeU16Le(dirBytes, base + idx * 2, name.charCodeAt(idx));
  }
  writeU16Le(dirBytes, base + 64, (name.length + 1) * 2);
  dirBytes[base + 66] = entryType;
  dirBytes[base + 67] = 1;
  writeU32Le(dirBytes, base + 68, 0xffffffff);
  writeU32Le(dirBytes, base + 72, 0xffffffff);
  writeU32Le(dirBytes, base + 76, 0xffffffff);
  writeU32Le(dirBytes, base + 116, startSector);
  writeU32Le(dirBytes, base + 120, streamSize);
}

function buildOle2WithStreams(streams: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const sectorChunks: Uint8Array[] = [];
  const fatEntries: number[] = [];

  const allocChain = (data: Uint8Array): number => {
    const numSectors = Math.max(1, Math.ceil(data.length / SECTOR_SIZE));
    const firstSec = sectorChunks.length;
    for (let secOffset = 0; secOffset < numSectors; secOffset++) {
      const secBuf = new Uint8Array(SECTOR_SIZE);
      const start = secOffset * SECTOR_SIZE;
      secBuf.set(data.subarray(start, start + SECTOR_SIZE));
      const curSec = sectorChunks.length;
      sectorChunks.push(secBuf);
      fatEntries[curSec] = secOffset + 1 < numSectors ? curSec + 1 : ENDOFCHAIN;
    }
    return firstSec;
  };

  const fatSectorIndex = sectorChunks.length;
  sectorChunks.push(new Uint8Array(SECTOR_SIZE));
  fatEntries[fatSectorIndex] = FATSECT;

  const dirSectorIndex = sectorChunks.length;
  const dirSector = new Uint8Array(SECTOR_SIZE);
  sectorChunks.push(dirSector);
  fatEntries[dirSectorIndex] = ENDOFCHAIN;

  writeDirEntry(dirSector, 0, "Root Entry", 5, ENDOFCHAIN, 0);
  streams.forEach((stream, idx) => {
    // Garante uso da FAT principal (miniCutoff=0) para manter o fixture conciso
    const startSec = allocChain(stream.data);
    writeDirEntry(dirSector, idx + 1, stream.name, 2, startSec, stream.data.length);
  });

  const fatView = sectorChunks[fatSectorIndex]!;
  fatView.fill(0xff);
  for (let idx = 0; idx < fatEntries.length; idx++) {
    writeU32Le(fatView, idx * 4, fatEntries[idx]!);
  }

  const header = new Uint8Array(SECTOR_SIZE);
  header.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  writeU16Le(header, 24, 0x003e);
  writeU16Le(header, 26, 0x0003);
  writeU16Le(header, 28, 0xfffe);
  writeU16Le(header, 30, 9);
  writeU16Le(header, 32, 6);
  writeU32Le(header, 44, 1);
  writeU32Le(header, 48, dirSectorIndex);
  writeU32Le(header, 56, 0);
  writeU32Le(header, 60, ENDOFCHAIN);
  writeU32Le(header, 64, 0);
  writeU32Le(header, 68, ENDOFCHAIN);
  writeU32Le(header, 72, 0);
  for (let idx = 0; idx < 109; idx++) {
    writeU32Le(header, 76 + idx * 4, idx === 0 ? fatSectorIndex : FREESECT);
  }

  const total = new Uint8Array(SECTOR_SIZE + sectorChunks.length * SECTOR_SIZE);
  total.set(header, 0);
  sectorChunks.forEach((chunk, idx) => {
    total.set(chunk, SECTOR_SIZE + idx * SECTOR_SIZE);
  });
  return total;
}

function padBytes(bytes: Uint8Array, targetLen: number, fillByte: number): Uint8Array {
  const out = new Uint8Array(targetLen);
  if (bytes.length >= targetLen) {
    out.set(bytes.subarray(0, targetLen));
  } else {
    out.set(bytes);
    out.fill(fillByte, bytes.length);
  }
  return out;
}

function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

function aesCbcEncryptNoPad(key: Uint8Array, iv: Uint8Array, plain: Uint8Array): Uint8Array {
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  cipher.setAutoPadding(false);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return new Uint8Array(enc.buffer, enc.byteOffset, enc.byteLength);
}

function buildAgileEncryptedOle2(password: string, plainZip: Uint8Array): Uint8Array {
  const encKeySalt = new Uint8Array(16).fill(0x11);
  const keyDataSalt = new Uint8Array(16).fill(0x22);
  const spinCount = 8;

  const pwBytes = new Uint8Array(password.length * 2);
  for (let idx = 0; idx < password.length; idx++) {
    writeU16Le(pwBytes, idx * 2, password.charCodeAt(idx));
  }
  let spinHash = sha256(Uint8Array.from([...encKeySalt, ...pwBytes]));
  const iterBuf = new Uint8Array(4 + spinHash.length);
  for (let iter = 0; iter < spinCount; iter++) {
    writeU32Le(iterBuf, 0, iter);
    iterBuf.set(spinHash, 4);
    spinHash = sha256(iterBuf);
  }

  const blockKey = (tag: number[]) =>
    padBytes(sha256(Uint8Array.from([...spinHash, ...tag])), 16, 0x36);

  const verifierInputPlain = new Uint8Array(16).fill(0x44);
  const verifierHashPlain = sha256(verifierInputPlain);
  const secretKey = new Uint8Array(16).fill(0x77);
  const encIv = padBytes(encKeySalt, 16, 0x36);

  const encVerifierInput = aesCbcEncryptNoPad(
    blockKey([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]),
    encIv,
    verifierInputPlain,
  );
  const encVerifierHash = aesCbcEncryptNoPad(
    blockKey([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]),
    encIv,
    verifierHashPlain,
  );
  const encKeyValue = aesCbcEncryptNoPad(
    blockKey([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]),
    encIv,
    secretKey,
  );

  const xml =
    `<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption">` +
    `<keyData saltSize="16" blockSize="16" keyBits="128" hashSize="32" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA256" saltValue="${Buffer.from(keyDataSalt).toString("base64")}" />` +
    `<keyEncryptors><keyEncryptor><encryptedKey spinCount="${spinCount}" saltSize="16" blockSize="16" keyBits="128" hashSize="32" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA256" saltValue="${Buffer.from(encKeySalt).toString("base64")}" encryptedVerifierHashInput="${Buffer.from(encVerifierInput).toString("base64")}" encryptedVerifierHashValue="${Buffer.from(encVerifierHash).toString("base64")}" encryptedKeyValue="${Buffer.from(encKeyValue).toString("base64")}" /></keyEncryptor></keyEncryptors>` +
    `</encryption>`;
  const xmlBytes = new TextEncoder().encode(xml);
  const encryptionInfo = new Uint8Array(8 + xmlBytes.length);
  writeU16Le(encryptionInfo, 0, 4);
  writeU16Le(encryptionInfo, 2, 4);
  writeU32Le(encryptionInfo, 4, 0x40);
  encryptionInfo.set(xmlBytes, 8);

  const segIvInput = new Uint8Array(keyDataSalt.length + 4);
  segIvInput.set(keyDataSalt, 0);
  writeU32Le(segIvInput, keyDataSalt.length, 0);
  const segIv = padBytes(sha256(segIvInput), 16, 0x36);
  const paddedLen = Math.ceil(plainZip.length / 16) * 16;
  const paddedPlain = new Uint8Array(paddedLen);
  paddedPlain.set(plainZip);
  const cipherPkg = aesCbcEncryptNoPad(secretKey, segIv, paddedPlain);
  const encryptedPackage = new Uint8Array(8 + cipherPkg.length);
  writeU32Le(encryptedPackage, 0, plainZip.length);
  writeU32Le(encryptedPackage, 4, 0);
  encryptedPackage.set(cipherPkg, 8);

  return buildOle2WithStreams([
    { name: "EncryptionInfo", data: encryptionInfo },
    { name: "EncryptedPackage", data: encryptedPackage },
  ]);
}

describe("ole2-crypto", () => {
  it("identifica erros de planilha protegida corretamente", () => {
    const promptErr = new EncryptedSpreadsheetError("ENCRYPTED_SPREADSHEET");
    const wrongErr = new EncryptedSpreadsheetError("INVALID_SPREADSHEET_PASSWORD");
    const unsupportedErr = new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");

    expect(isEncryptedSpreadsheetError(promptErr)).toBe(true);
    expect(isSpreadsheetPasswordPromptError(promptErr)).toBe(true);
    expect(isSpreadsheetPasswordPromptError(wrongErr)).toBe(true);
    expect(isSpreadsheetPasswordPromptError(unsupportedErr)).toBe(false);
    expect(isEncryptedSpreadsheetError(new Error("other"))).toBe(false);
  });

  it("abre container OLE2 e diferencia planilha criptografada de arquivo comum", () => {
    const olePlain = buildOle2WithStreams([{ name: "Workbook", data: new Uint8Array([1, 2, 3, 4]) }]);
    expect(hasOle2Magic(olePlain)).toBe(true);
    expect(openOle2Container(olePlain)?.entries.some((entry) => entry.lowerName === "workbook")).toBe(true);
    expect(isEncryptedOle2OfficeFile(olePlain)).toBe(false);
    expect(hasOle2Magic(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });

  it("descriptografa pacote Agile AES-128-CBC SHA256 com senha válida e rejeita senha inválida", async () => {
    const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      return copy.buffer;
    };
    const fakeZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0xde, 0xad, 0xbe, 0xef]);
    const containerBytes = buildAgileEncryptedOle2("123456", fakeZip);

    expect(isEncryptedOle2OfficeFile(containerBytes)).toBe(true);

    const decrypted = await decryptOfficeSpreadsheet(toArrayBuffer(containerBytes), "123456");
    expect(Array.from(new Uint8Array(decrypted))).toEqual(Array.from(fakeZip));

    await expect(
      decryptOfficeSpreadsheet(toArrayBuffer(containerBytes), "errada"),
    ).rejects.toMatchObject({ code: "INVALID_SPREADSHEET_PASSWORD" });
  });

  it("rejeita container inválido ou não criptografado com UNSUPPORTED_SPREADSHEET_ENCRYPTION", async () => {
    const notOle = new Uint8Array([1, 2, 3, 4]).buffer;
    await expect(decryptOfficeSpreadsheet(notOle, "123")).rejects.toMatchObject({
      code: "UNSUPPORTED_SPREADSHEET_ENCRYPTION",
    });
  });
});
