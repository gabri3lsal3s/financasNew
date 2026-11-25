import { describe, expect, it } from "vitest";
import {
  EncryptedSpreadsheetError,
  decryptOfficeSpreadsheet,
  hasOle2Magic,
  isEncryptedOle2OfficeFile,
  isEncryptedSpreadsheetError,
  isSpreadsheetPasswordPromptError,
  openOle2Container,
} from "./ole2-crypto";

describe("ole2-crypto", () => {
  it("detects OLE2 magic bytes and rejects short or non-OLE2 buffers", () => {
    const validMagic = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
    const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const shortBuffer = new Uint8Array([0xd0, 0xcf, 0x11]);

    expect(hasOle2Magic(validMagic)).toBe(true);
    expect(hasOle2Magic(zipMagic)).toBe(false);
    expect(hasOle2Magic(shortBuffer)).toBe(false);
  });

  it("classifies EncryptedSpreadsheetError codes accurately", () => {
    const promptErr = new EncryptedSpreadsheetError("ENCRYPTED_SPREADSHEET");
    const invalidErr = new EncryptedSpreadsheetError("INVALID_SPREADSHEET_PASSWORD");
    const unsupportedErr = new EncryptedSpreadsheetError("UNSUPPORTED_SPREADSHEET_ENCRYPTION");

    expect(isEncryptedSpreadsheetError(promptErr)).toBe(true);
    expect(isSpreadsheetPasswordPromptError(promptErr)).toBe(true);
    expect(isSpreadsheetPasswordPromptError(invalidErr)).toBe(true);
    expect(isSpreadsheetPasswordPromptError(unsupportedErr)).toBe(false);
    expect(isEncryptedSpreadsheetError(new Error("generic"))).toBe(false);
    expect(isEncryptedSpreadsheetError(null)).toBe(false);
  });

  it("returns null/false safely for non-OLE2 containers and rejects decryption", async () => {
    const plainBytes = new TextEncoder().encode("data,descricao,valor\n2026-10-01,Cafe,12.50");

    expect(openOle2Container(plainBytes)).toBeNull();
    expect(isEncryptedOle2OfficeFile(plainBytes)).toBe(false);
    await expect(decryptOfficeSpreadsheet(plainBytes.buffer, "123456")).rejects.toMatchObject({
      name: "EncryptedSpreadsheetError",
      code: "UNSUPPORTED_SPREADSHEET_ENCRYPTION",
    });
  });
});
