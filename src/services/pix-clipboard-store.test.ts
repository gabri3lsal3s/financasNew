import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canTriggerNativeClipboardCheck,
  clearDismissedClipboardHashes,
  consumeCurrentDetectedPix,
  dismissCurrentDetectedPix,
  DISMISSED_CLIPBOARD_HASHES_KEY,
  DISMISSED_HASH_TTL_MS,
  fnv1aHash,
  getDetectedPixSnapshot,
  isClipboardTextDismissed,
  markClipboardTextDismissed,
  MAX_DISMISSED_HASHES,
  recordNativeClipboardCheck,
  resetPixClipboardStoreForTests,
  setDetectedPixState,
  subscribeDetectedPix,
  type DetectedPixTransaction,
} from "./pix-clipboard-store";
import { setActiveUserId } from "./user-storage";

function makeDetected(rawText: string, valueCents = 4500): DetectedPixTransaction {
  return {
    candidate: {
      kind: "PIX_BRCODE",
      valueCents,
      description: "Pix: Café Central",
      recipientName: "Café Central",
      nature: "expense",
      paymentMethod: "pix",
      confidence: "high",
    },
    identity: {
      friendlyName: "Café Central",
      categorySlug: "alimentacao",
      isLearned: false,
      confidence: "inferred_keyword",
      layer: 3,
    },
    rawText,
  };
}

describe("pix-clipboard-store (FNV-1a síncrono, TTL 24h & Cooldown Nativo)", () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveUserId("user-1");
    resetPixClipboardStoreForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calcula fnv1aHash síncrono determinístico normalizando espaços", () => {
    const h1 = fnv1aHash("000201  26360014br.gov.bcb.pix");
    const h2 = fnv1aHash("  000201\n26360014br.gov.bcb.pix  ");
    const h3 = fnv1aHash("000201 26360014br.gov.bcb.outro");

    expect(h1).toMatch(/^[0-9a-f]{8}$/);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("persiste apenas hash no localStorage (LGPD) sem texto bruto e respeita teto de 30 itens", () => {
    const sample = "00020126360014br.gov.bcb.pixSEGREDO_USUARIO";
    markClipboardTextDismissed(sample, "user-1");

    expect(isClipboardTextDismissed(sample, "user-1")).toBe(true);
    expect(isClipboardTextDismissed(sample, "user-2")).toBe(false);

    const rawStored = localStorage.getItem(`financas_user-1_${DISMISSED_CLIPBOARD_HASHES_KEY}`) ?? "";
    expect(rawStored).toContain(fnv1aHash(sample));
    expect(rawStored).not.toContain("SEGREDO_USUARIO");

    // Preenche acima do teto de 30 entradas
    for (let i = 0; i < 35; i++) {
      markClipboardTextDismissed(`payload-pix-${i}`, "user-1");
    }
    const storedAfterCap = JSON.parse(
      localStorage.getItem(`financas_user-1_${DISMISSED_CLIPBOARD_HASHES_KEY}`) ?? "[]",
    ) as Array<{ hash: string }>;
    expect(storedAfterCap).toHaveLength(MAX_DISMISSED_HASHES);
  });

  it("expira hashes dispensados após TTL de 24 horas", () => {
    const baseNow = 1_795_100_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseNow);

    markClipboardTextDismissed("payload-temporario", "user-1");
    expect(isClipboardTextDismissed("payload-temporario", "user-1")).toBe(true);

    nowSpy.mockReturnValue(baseNow + DISMISSED_HASH_TTL_MS + 1000);
    expect(isClipboardTextDismissed("payload-temporario", "user-1")).toBe(false);
  });

  it("notifica listeners via useSyncExternalStore e grava FNV-1a ao dispensar ou consumir", () => {
    const listener = vi.fn();
    const unsub = subscribeDetectedPix(listener);

    const detectedA = makeDetected("emv-payload-A");
    setDetectedPixState(detectedA);
    expect(getDetectedPixSnapshot()?.rawText).toBe("emv-payload-A");
    expect(listener).toHaveBeenCalledTimes(1);

    dismissCurrentDetectedPix("user-1");
    expect(getDetectedPixSnapshot()).toBeNull();
    expect(isClipboardTextDismissed("emv-payload-A", "user-1")).toBe(true);

    const detectedB = makeDetected("emv-payload-B", 0);
    setDetectedPixState(detectedB);
    consumeCurrentDetectedPix(undefined, "user-1");
    expect(getDetectedPixSnapshot()).toBeNull();
    expect(isClipboardTextDismissed("emv-payload-B", "user-1")).toBe(true);

    clearDismissedClipboardHashes("user-1");
    expect(isClipboardTextDismissed("emv-payload-B", "user-1")).toBe(false);
    unsub();
  });

  it("aplica cooldown nativo de 10 segundos", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(100_000);
    expect(canTriggerNativeClipboardCheck(10_000)).toBe(true);

    recordNativeClipboardCheck();
    nowSpy.mockReturnValue(105_000);
    expect(canTriggerNativeClipboardCheck(10_000)).toBe(false);

    nowSpy.mockReturnValue(110_000);
    expect(canTriggerNativeClipboardCheck(10_000)).toBe(true);
  });
});
