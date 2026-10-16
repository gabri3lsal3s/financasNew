import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPlugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  flushPendingNotifications: vi.fn(),
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
  flushPendingBankNotifications,
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

  describe("flushPendingBankNotifications", () => {
    it("retorna 0 quando a plataforma não for nativa", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

      const count = await flushPendingBankNotifications();
      expect(count).toBe(0);
      expect(mockPlugin.flushPendingNotifications).not.toHaveBeenCalled();
    });

    it("descarrega e processa múltiplas notificações acumuladas no buffer nativo", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");

      mockPlugin.flushPendingNotifications.mockResolvedValue({
        notifications: [
          {
            packageName: "com.nu.production",
            title: "Nubank",
            text: "Compra de R$ 45,00 no cartão de crédito aprovada em Padaria",
            timestamp: 1729000000000,
          },
          {
            packageName: "com.picpay",
            title: "PicPay",
            text: "Você recebeu um Pix de R$ 120,00 de Mariana",
            timestamp: 1729000010000,
          },
        ],
      });

      const count = await flushPendingBankNotifications();
      expect(count).toBe(2);
      expect(mockPlugin.flushPendingNotifications).toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalledTimes(2);
    });

    it("retorna 0 de forma segura quando a lista estiver vazia ou ocorrer erro", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      mockPlugin.flushPendingNotifications.mockRejectedValue(new Error("Storage error"));

      const count = await flushPendingBankNotifications();
      expect(count).toBe(0);
    });
  });
});
