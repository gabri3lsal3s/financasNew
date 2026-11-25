import { describe, expect, it } from "vitest";
import {
  computeSyncHash,
  normalizeHashAlgorithmName,
  sha1Sync,
  sha256Sync,
  sha512Sync,
} from "./sync-hash";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("sync-hash", () => {
  it("computes NIST test vectors for SHA-1, SHA-256 and SHA-512", () => {
    expect(toHex(sha1Sync(utf8("")))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(toHex(sha1Sync(utf8("abc")))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");

    expect(toHex(sha256Sync(utf8("")))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(toHex(sha256Sync(utf8("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );

    expect(toHex(sha512Sync(utf8("")))).toBe(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    );
    expect(toHex(sha512Sync(utf8("abc")))).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    );
  });

  it("normalizes algorithm aliases and dispatches computeSyncHash", () => {
    expect(normalizeHashAlgorithmName("sha-1")).toBe("SHA1");
    expect(normalizeHashAlgorithmName("SHA_256")).toBe("SHA256");
    expect(normalizeHashAlgorithmName("sha512")).toBe("SHA512");
    expect(normalizeHashAlgorithmName("MD5")).toBeNull();

    const payload = utf8("fatura-cartao-2026");
    expect(toHex(computeSyncHash("SHA1", payload))).toBe(toHex(sha1Sync(payload)));
    expect(toHex(computeSyncHash("SHA256", payload))).toBe(toHex(sha256Sync(payload)));
    expect(toHex(computeSyncHash("SHA512", payload))).toBe(toHex(sha512Sync(payload)));
  });
});
