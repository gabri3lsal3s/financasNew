import { App } from "@capacitor/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBiometricLockTimeoutMinutes,
  initAppLockListener,
  isAppLocked,
  isBiometricLockEnabled,
  isPrivacyShieldEnabled,
  setAppLocked,
  setBiometricLockEnabled,
  setBiometricLockTimeoutMinutes,
  setPrivacyShieldEnabled,
  subscribeAppLock,
  unlockAppWithBiometrics,
} from "./app-lock";
import * as biometricsModule from "./biometrics";
import * as platformModule from "./platform";
import * as privacyShieldModule from "./privacy-shield";

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(),
  },
}));

describe("Gateway Nativo — App Lock & Biometria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setAppLocked(false);
  });

  it("gerencia preferências de bloqueio biométrico e timeout", () => {
    expect(isBiometricLockEnabled()).toBe(false);
    expect(getBiometricLockTimeoutMinutes()).toBe(1);

    setBiometricLockEnabled(true);
    expect(isBiometricLockEnabled()).toBe(true);

    setBiometricLockTimeoutMinutes(5);
    expect(getBiometricLockTimeoutMinutes()).toBe(5);
  });

  it("gerencia preferência do Privacy Shield", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const enableSpy = vi.spyOn(privacyShieldModule, "enablePrivacyShield").mockResolvedValue(undefined);
    const disableSpy = vi.spyOn(privacyShieldModule, "disablePrivacyShield").mockResolvedValue(undefined);

    setPrivacyShieldEnabled(true);
    expect(isPrivacyShieldEnabled()).toBe(true);
    expect(enableSpy).toHaveBeenCalled();

    setPrivacyShieldEnabled(false);
    expect(isPrivacyShieldEnabled()).toBe(false);
    expect(disableSpy).toHaveBeenCalled();
  });

  it("gerencia estado de bloqueio reativo com subscribeAppLock", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAppLock(listener);

    expect(isAppLocked()).toBe(false);

    setAppLocked(true);
    expect(isAppLocked()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setAppLocked(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("desbloqueia o app com sucesso após autenticação biométrica válida", async () => {
    setAppLocked(true);
    vi.spyOn(biometricsModule, "authenticateWithBiometrics").mockResolvedValue({ success: true });

    const unlocked = await unlockAppWithBiometrics();

    expect(unlocked).toBe(true);
    expect(isAppLocked()).toBe(false);
  });

  it("mantém o app bloqueado caso a biometria falhe ou seja cancelada", async () => {
    setAppLocked(true);
    vi.spyOn(biometricsModule, "authenticateWithBiometrics").mockResolvedValue({
      success: false,
      error: "Cancelado",
    });

    const unlocked = await unlockAppWithBiometrics();

    expect(unlocked).toBe(false);
    expect(isAppLocked()).toBe(true);
  });

  it("registra listener de appStateChange em plataforma nativa", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    vi.mocked(App.addListener).mockResolvedValue({
      remove: vi.fn(),
    } as unknown as { remove: () => Promise<void> });

    const cleanup = initAppLockListener();
    expect(App.addListener).toHaveBeenCalledWith("appStateChange", expect.any(Function));
    cleanup();
  });
});
