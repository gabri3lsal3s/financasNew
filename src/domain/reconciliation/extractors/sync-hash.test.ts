import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  computeSyncHash,
  normalizeHashAlgorithmName,
  sha1Sync,
  sha256Sync,
  sha512Sync,
} from "./sync-hash";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("sync-hash", () => {
  const vectors = [
    "",
    "abc",
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "Fatura cartao credito R$ 1.234,56 multi-bloco padding > 64 e > 128 bytes " + "x".repeat(180),
  ];

  it.each(vectors)("sha1Sync equivale ao crypto.createHash('sha1') para vetor #%#", (sample) => {
    const data = new TextEncoder().encode(sample);
    const expected = createHash("sha1").update(data).digest("hex");
    expect(toHex(sha1Sync(data))).toBe(expected);
  });

  it.each(vectors)("sha256Sync equivale ao crypto.createHash('sha256') para vetor #%#", (sample) => {
    const data = new TextEncoder().encode(sample);
    const expected = createHash("sha256").update(data).digest("hex");
    expect(toHex(sha256Sync(data))).toBe(expected);
  });

  it.each(vectors)("sha512Sync equivale ao crypto.createHash('sha512') para vetor #%#", (sample) => {
    const data = new TextEncoder().encode(sample);
    const expected = createHash("sha512").update(data).digest("hex");
    expect(toHex(sha512Sync(data))).toBe(expected);
  });

  it("normaliza nomes variados de algoritmos de hash", () => {
    expect(normalizeHashAlgorithmName("SHA-1")).toBe("SHA1");
    expect(normalizeHashAlgorithmName(" sha256 ")).toBe("SHA256");
    expect(normalizeHashAlgorithmName("SHA-512")).toBe("SHA512");
    expect(normalizeHashAlgorithmName("MD5")).toBeNull();
  });

  it("computeSyncHash despacha corretamente por algoritmo", () => {
    const payload = new TextEncoder().encode("ms-offcrypto-test");
    expect(toHex(computeSyncHash("SHA1", payload))).toBe(toHex(sha1Sync(payload)));
    expect(toHex(computeSyncHash("SHA256", payload))).toBe(toHex(sha256Sync(payload)));
    expect(toHex(computeSyncHash("SHA512", payload))).toBe(toHex(sha512Sync(payload)));
  });
});
