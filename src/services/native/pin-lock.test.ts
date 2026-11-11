import { beforeEach, describe, expect, it } from "vitest";
import {
  isPinLockConfigured,
  setPinLock,
  verifyPinLock,
  removePinLock,
  unlockAppWithPin,
} from "./pin-lock";
import { isAppLocked, setAppLocked } from "./app-lock";

describe("Gateway Nativo — PIN Lock (Web/PWA & Fallback)", () => {
  beforeEach(() => {
    localStorage.clear();
    setAppLocked(false);
  });

  it("identifica corretamente quando o PIN não está configurado", () => {
    expect(isPinLockConfigured("user-1")).toBe(false);
  });

  it("rejeita PIN com formato inválido (não numérico ou tamanho fora do intervalo 4-6)", async () => {
    await expect(setPinLock("123", "user-1")).rejects.toThrow("O PIN deve conter entre 4 e 6 dígitos numéricos.");
    await expect(setPinLock("1234567", "user-1")).rejects.toThrow("O PIN deve conter entre 4 e 6 dígitos numéricos.");
    await expect(setPinLock("abcd", "user-1")).rejects.toThrow("O PIN deve conter entre 4 e 6 dígitos numéricos.");
  });

  it("configura e verifica com sucesso um PIN válido de 4 dígitos", async () => {
    await setPinLock("1234", "user-1");
    expect(isPinLockConfigured("user-1")).toBe(true);

    const valid = await verifyPinLock("1234", "user-1");
    expect(valid).toBe(true);

    const invalid = await verifyPinLock("9999", "user-1");
    expect(invalid).toBe(false);
  });

  it("configura e verifica com sucesso um PIN de 6 dígitos para usuários distintos", async () => {
    await setPinLock("123456", "user-A");
    await setPinLock("654321", "user-B");

    expect(await verifyPinLock("123456", "user-A")).toBe(true);
    expect(await verifyPinLock("654321", "user-A")).toBe(false);

    expect(await verifyPinLock("654321", "user-B")).toBe(true);
    expect(await verifyPinLock("123456", "user-B")).toBe(false);
  });

  it("remove o PIN configurado", async () => {
    await setPinLock("4321", "user-1");
    expect(isPinLockConfigured("user-1")).toBe(true);

    removePinLock("user-1");
    expect(isPinLockConfigured("user-1")).toBe(false);
    expect(await verifyPinLock("4321", "user-1")).toBe(false);
  });

  it("desbloqueia o aplicativo quando o PIN confere", async () => {
    await setPinLock("9876", "user-1");
    setAppLocked(true);
    expect(isAppLocked()).toBe(true);

    const unlockedWrong = await unlockAppWithPin("0000", "user-1");
    expect(unlockedWrong).toBe(false);
    expect(isAppLocked()).toBe(true);

    const unlockedRight = await unlockAppWithPin("9876", "user-1");
    expect(unlockedRight).toBe(true);
    expect(isAppLocked()).toBe(false);
  });
});
