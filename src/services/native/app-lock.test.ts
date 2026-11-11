import { App } from "@capacitor/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAppLockGraceMinutes,
  initAppLockListener,
  isAppLocked,
  isBiometricLockEnabled,
  isPrivacyShieldEnabled,
  setAppLocked,
  setBiometricLockEnabled,
  setAppLockGraceMinutes,
  setPrivacyShieldEnabled,
  syncPrivacyShield,
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
    expect(getAppLockGraceMinutes()).toBe(1);

    setBiometricLockEnabled(true);
    expect(isBiometricLockEnabled()).toBe(true);

    setAppLockGraceMinutes(5);
    expect(getAppLockGraceMinutes()).toBe(5);
  });

  it("gerencia preferência do Privacy Shield e espelho ativo", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const enableSpy = vi.spyOn(privacyShieldModule, "enablePrivacyShield").mockResolvedValue(undefined);
    const disableSpy = vi.spyOn(privacyShieldModule, "disablePrivacyShield").mockResolvedValue(undefined);

    setPrivacyShieldEnabled(true);
    expect(isPrivacyShieldEnabled()).toBe(true);
    expect(localStorage.getItem("financas_active_privacy_shield_enabled")).toBe("true");
    expect(enableSpy).toHaveBeenCalled();

    setPrivacyShieldEnabled(false);
    expect(isPrivacyShieldEnabled()).toBe(false);
    expect(localStorage.getItem("financas_active_privacy_shield_enabled")).toBe("false");
    expect(disableSpy).toHaveBeenCalled();
  });

  it("sincroniza o Privacy Shield chamando enable ou disable explicitamente", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const enableSpy = vi.spyOn(privacyShieldModule, "enablePrivacyShield").mockResolvedValue(undefined);
    const disableSpy = vi.spyOn(privacyShieldModule, "disablePrivacyShield").mockResolvedValue(undefined);

    localStorage.setItem("financas_active_privacy_shield_enabled", "true");
    syncPrivacyShield();
    expect(enableSpy).toHaveBeenCalledTimes(1);
    expect(disableSpy).not.toHaveBeenCalled();

    localStorage.setItem("financas_active_privacy_shield_enabled", "false");
    syncPrivacyShield();
    expect(disableSpy).toHaveBeenCalledTimes(1);
  });

  it("no cold start com preferência desativada, initAppLockListener desativa explicitamente o escudo nativo", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const disableSpy = vi.spyOn(privacyShieldModule, "disablePrivacyShield").mockResolvedValue(undefined);

    // Simula cold start onde o usuário havia desabilitado o escudo anteriormente
    localStorage.setItem("financas_active_privacy_shield_enabled", "false");

    const cleanup = initAppLockListener();
    expect(disableSpy).toHaveBeenCalledTimes(1);
    cleanup();
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

  it("ignora appStateChange se a autenticação biométrica estiver em andamento (anti-loop)", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    let stateCallback: (state: { isActive: boolean }) => void = () => {};
    vi.mocked(App.addListener).mockImplementation((_event, cb) => {
      stateCallback = cb as unknown as (state: { isActive: boolean }) => void;
      return Promise.resolve({ remove: vi.fn() } as unknown as { remove: () => Promise<void> });
    });

    setBiometricLockEnabled(true);
    const cleanup = initAppLockListener();
    setAppLocked(false);

    // Simula biometria em andamento
    vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(true);

    stateCallback({ isActive: false });
    stateCallback({ isActive: true });

    expect(isAppLocked()).toBe(false);
    cleanup();
  });

  it("bloqueia o aplicativo ao retornar do background após a tolerância expirada", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    let stateCallback: (state: { isActive: boolean }) => void = () => {};
    vi.mocked(App.addListener).mockImplementation((_event, cb) => {
      stateCallback = cb as unknown as (state: { isActive: boolean }) => void;
      return Promise.resolve({ remove: vi.fn() } as unknown as { remove: () => Promise<void> });
    });

    setBiometricLockEnabled(true);
    setAppLockGraceMinutes(1);
    vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(false);

    const cleanup = initAppLockListener();

    const now = 1000000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    stateCallback({ isActive: false });

    // 2 minutos depois (tolerância excedida)
    vi.spyOn(Date, "now").mockReturnValue(now + 120_000);
    stateCallback({ isActive: true });

    expect(isAppLocked()).toBe(true);
    cleanup();
  });

  it("bloqueia o aplicativo no cold start se a biometria estiver ativa em plataforma nativa", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    setBiometricLockEnabled(true);
    setAppLocked(false);

    const cleanup = initAppLockListener();
    expect(isAppLocked()).toBe(true);
    cleanup();
  });

  describe("PWA / Navegador — Monitoramento de Segundo Plano (visibilitychange e pagehide/pageshow)", () => {
    beforeEach(() => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
      setAppLocked(false);
    });

    it("no navegador/PWA, bloqueia ao retornar à aba (visibilitychange) após a tolerância configurada", () => {
      setBiometricLockEnabled(true);
      setAppLockGraceMinutes(1);
      vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(false);

      const cleanup = initAppLockListener();

      const now = 2_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      // Usuário minimiza ou troca de aba no navegador
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // 2 minutos depois (tolerância de 1 min excedida)
      vi.spyOn(Date, "now").mockReturnValue(now + 120_000);
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(isAppLocked()).toBe(true);
      cleanup();
    });

    it("no navegador/PWA, mantém desbloqueado ao retornar à aba antes de esgotar a tolerância", () => {
      setBiometricLockEnabled(true);
      setAppLockGraceMinutes(5); // 5 minutos de tolerância
      vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(false);

      const cleanup = initAppLockListener();

      const now = 2_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      // Usuário minimiza a janela
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Retorna apenas 30 segundos depois (dentro da tolerância)
      vi.spyOn(Date, "now").mockReturnValue(now + 30_000);
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(isAppLocked()).toBe(false);
      cleanup();
    });

    it("no navegador/PWA, não bloqueia o app se o bloqueio estiver desativado", () => {
      setBiometricLockEnabled(false);
      setAppLockGraceMinutes(0); // Imediato
      vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(false);

      const cleanup = initAppLockListener();

      const now = 2_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      vi.spyOn(Date, "now").mockReturnValue(now + 60_000);
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(isAppLocked()).toBe(false);
      cleanup();
    });

    it("no navegador/PWA, ignora eventos se a autenticação biométrica estiver em andamento (anti-loop)", () => {
      setBiometricLockEnabled(true);
      setAppLockGraceMinutes(0);
      vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(true);

      const cleanup = initAppLockListener();

      const now = 2_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      vi.spyOn(Date, "now").mockReturnValue(now + 10_000);
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(isAppLocked()).toBe(false);
      cleanup();
    });

    it("no navegador/PWA, suporta eventos pagehide e pageshow", () => {
      setBiometricLockEnabled(true);
      setAppLockGraceMinutes(1);
      vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(false);

      const cleanup = initAppLockListener();

      const now = 2_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      window.dispatchEvent(new Event("pagehide"));

      // 2 minutos depois
      vi.spyOn(Date, "now").mockReturnValue(now + 120_000);
      window.dispatchEvent(new Event("pageshow"));

      expect(isAppLocked()).toBe(true);
      cleanup();
    });

    it("no navegador/PWA, remove os listeners de evento ao chamar cleanup", () => {
      setBiometricLockEnabled(true);
      setAppLockGraceMinutes(0);
      vi.spyOn(biometricsModule, "isBiometricAuthInProgress").mockReturnValue(false);

      const cleanup = initAppLockListener();
      cleanup();

      const now = 2_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      vi.spyOn(Date, "now").mockReturnValue(now + 10_000);
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(isAppLocked()).toBe(false);
    });
  });
});
