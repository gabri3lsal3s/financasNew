import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPinLockout,
  computePinLockoutAfterFailure,
  getPinLockoutState,
  getRemainingPinLockoutSeconds,
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

  describe("backoff progressivo persistido (app_pin_lockout)", () => {
    it("regra pura: 1-4 erros sem espera, 5-9 erros progressivo >= 30s, >= 10 erros = 5 min", () => {
      const base = 1_000_000;
      expect(computePinLockoutAfterFailure(0, base)).toEqual({ failedAttempts: 1, lockedUntilMs: null });
      expect(computePinLockoutAfterFailure(3, base)).toEqual({ failedAttempts: 4, lockedUntilMs: null });
      expect(computePinLockoutAfterFailure(4, base)).toEqual({ failedAttempts: 5, lockedUntilMs: base + 30_000 });
      expect(computePinLockoutAfterFailure(8, base)).toEqual({ failedAttempts: 9, lockedUntilMs: base + 150_000 });
      expect(computePinLockoutAfterFailure(9, base)).toEqual({ failedAttempts: 10, lockedUntilMs: base + 300_000 });
    });

    it("persiste falhas no user-storage, bloqueia no 5º erro e limpa ao acertar o PIN", async () => {
      await setPinLock("1234", "user-1");
      setAppLocked(true);

      for (let i = 0; i < 4; i++) {
        expect(await unlockAppWithPin("0000", "user-1")).toBe(false);
        expect(getRemainingPinLockoutSeconds("user-1")).toBe(0);
      }

      // 5ª falha ativa espera de 30s
      expect(await unlockAppWithPin("0000", "user-1")).toBe(false);
      expect(getPinLockoutState("user-1").failedAttempts).toBe(5);
      expect(getRemainingPinLockoutSeconds("user-1")).toBeGreaterThan(0);

      // Tentativa durante lockout lança erro sem validar PIN
      await expect(unlockAppWithPin("1234", "user-1")).rejects.toThrow(/Aguarde \d+s/);

      // Após expirar o tempo, PIN correto desbloqueia e zera o lockout
      const futureSpy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
      expect(await unlockAppWithPin("1234", "user-1")).toBe(true);
      expect(getPinLockoutState("user-1")).toEqual({ failedAttempts: 0, lockedUntilMs: null });
      futureSpy.mockRestore();
      clearPinLockout("user-1");
    });
  });
});
