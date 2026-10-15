import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPlugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    registerPlugin: () => mockPlugin,
  };
});

import * as platformModule from "./platform";
import {
  initBankNotificationListener,
  isNotificationListenerGranted,
  processBankNotification,
  processPixShare,
  requestNotificationListenerPermission,
} from "./bank-listener";
import * as suggestionsStoreModule from "./suggestions-store";

describe("bank-listener (Serviço de Notificações e Pix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processa notificação bancária válida e salva na store", () => {
    const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");

    const result = processBankNotification({
      title: "Nubank",
      text: "Compra de R$ 38,00 no cartão de crédito aprovada",
      packageName: "com.nu.production",
      timestamp: 1729000000000,
    });

    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(3800);
    expect(addSpy).toHaveBeenCalledWith(result);
  });

  it("retorna null e não adiciona na store para notificação sem valor", () => {
    const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");

    const result = processBankNotification({
      title: "Nubank",
      text: "Novidade no app do Nu!",
    });

    expect(result).toBeNull();
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("processa compartilhamento Pix válido e salva na store", () => {
    const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");

    const result = processPixShare("Comprovante Pix Nubank: Valor R$ 90,00 Beneficiário: João");

    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(9000);
    expect(addSpy).toHaveBeenCalledWith(result);
  });

  it("retorna false para checagem de permissão quando não nativo", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    const granted = await isNotificationListenerGranted();
    expect(granted).toBe(false);

    const reqResult = await requestNotificationListenerPermission();
    expect(reqResult).toBe(false);
  });

  it("chama plugin nativo quando na plataforma nativa", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    mockPlugin.isPermissionGranted.mockResolvedValue({ granted: true });
    mockPlugin.requestPermission.mockResolvedValue({ granted: true });

    const granted = await isNotificationListenerGranted();
    expect(granted).toBe(true);
    expect(mockPlugin.isPermissionGranted).toHaveBeenCalled();

    const reqResult = await requestNotificationListenerPermission();
    expect(reqResult).toBe(true);
    expect(mockPlugin.requestPermission).toHaveBeenCalled();
  });

  it("inicializa e remove listeners nativos com cleanup", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const removeFn = vi.fn();
    mockPlugin.addListener.mockResolvedValue({
      remove: removeFn,
    });

    const cleanup = initBankNotificationListener();
    expect(mockPlugin.addListener).toHaveBeenCalledWith("bankNotificationReceived", expect.any(Function));
    expect(mockPlugin.addListener).toHaveBeenCalledWith("shareTextReceived", expect.any(Function));

    await cleanup();
    expect(removeFn).toHaveBeenCalled();
  });
});
