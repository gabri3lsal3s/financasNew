import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPlugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  flushPendingNotifications: vi.fn(),
  getInstalledBankingApps: vi.fn().mockResolvedValue({ apps: [], installedBankNames: [] }),
  syncMonitoredPackages: vi.fn().mockResolvedValue({ success: true, count: 0 }),
  getPendingShare: vi.fn().mockResolvedValue({ text: null }),
  extractTextFromReceipt: vi.fn().mockResolvedValue({ text: "" }),
  getPendingReviewTransaction: vi.fn().mockResolvedValue({ payload: null }),
  flushConfirmedTransactions: vi.fn().mockResolvedValue({ transactions: [] }),
  addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
}));

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    registerPlugin: () => mockPlugin,
  };
});

import * as platformModule from "./platform";
import * as prefsModule from "./bank-assistant-preferences";
import { DEFAULT_BANK_ASSISTANT_PREFERENCES, HOMOLOGATED_BANKS } from "@/domain/notifications";
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
    vi.spyOn(prefsModule, "getBankAssistantPreferences").mockReturnValue({
      ...DEFAULT_BANK_ASSISTANT_PREFERENCES,
      monitoredBanks: [...HOMOLOGATED_BANKS],
    });
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

  it("processa texto de notificação de compra compartilhado via fallback e salva na store", () => {
    const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");

    const result = processPixShare("Compra de R$ 45,90 aprovada no Nubank em Padaria Estrela");

    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(4590);
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

  it("consome e processa comprovante retido no buffer nativo de cold start via getPendingShare", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");
    mockPlugin.getPendingShare.mockResolvedValue({
      text: "Comprovante Pix Nubank\nValor: R$ 42,50\nPara: Mercado Central\nData: 21/10/2026",
    });

    const cleanup = initBankNotificationListener();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockPlugin.getPendingShare).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 4250,
      }),
    );

    await cleanup();
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

  describe("governança de preferências do usuário (Fase 14 — Tarefa 30)", () => {
    it("não processa notificação quando captura passiva estiver desativada", async () => {
      const prefsModule = await import("./bank-assistant-preferences");
      vi.spyOn(prefsModule, "getBankAssistantPreferences").mockReturnValue({
        passiveCaptureEnabled: false,
        interactiveNotificationsEnabled: true,
        autoInstallmentsEnabled: true,
        autoCategoryInferenceEnabled: true,
        unknownCategoryHandling: "assign_generic_and_prompt",
        monitoredBanks: ["Nubank"],
      });

      const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");
      const result = processBankNotification({
        title: "Nubank",
        text: "Compra de R$ 50,00 no cartão",
        packageName: "com.nu.production",
      });

      expect(result).toBeNull();
      expect(addSpy).not.toHaveBeenCalled();
    });

    it("ignora notificação de banco não selecionado na lista de bancos monitorados", async () => {
      const prefsModule = await import("./bank-assistant-preferences");
      vi.spyOn(prefsModule, "getBankAssistantPreferences").mockReturnValue({
        passiveCaptureEnabled: true,
        interactiveNotificationsEnabled: true,
        autoInstallmentsEnabled: true,
        autoCategoryInferenceEnabled: true,
        unknownCategoryHandling: "assign_generic_and_prompt",
        monitoredBanks: ["Nubank", "Itaú"], // Inter não está incluído
      });

      const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");
      const result = processBankNotification({
        title: "Inter",
        text: "Compra aprovada de R$ 80,00 no cartão",
        packageName: "br.com.intermedium",
      });

      expect(result).toBeNull();
      expect(addSpy).not.toHaveBeenCalled();
    });

    it("reseta parcelas para 1x se autoInstallmentsEnabled for falso", async () => {
      const prefsModule = await import("./bank-assistant-preferences");
      vi.spyOn(prefsModule, "getBankAssistantPreferences").mockReturnValue({
        passiveCaptureEnabled: true,
        interactiveNotificationsEnabled: true,
        autoInstallmentsEnabled: false, // Desligado
        autoCategoryInferenceEnabled: true,
        unknownCategoryHandling: "assign_generic_and_prompt",
        monitoredBanks: ["Nubank"],
      });

      const result = processBankNotification({
        title: "Nubank",
        text: "Compra de R$ 300,00 em 3x no cartão Nubank em Loja",
        packageName: "com.nu.production",
      });

      expect(result).not.toBeNull();
      expect(result?.installments).toBe(1);
      expect(result?.currentInstallment).toBe(1);
      expect(result?.installmentAmountCents).toBe(30000);
    });

    it("remove categorySlug se autoCategoryInferenceEnabled for falso", async () => {
      const prefsModule = await import("./bank-assistant-preferences");
      vi.spyOn(prefsModule, "getBankAssistantPreferences").mockReturnValue({
        passiveCaptureEnabled: true,
        interactiveNotificationsEnabled: true,
        autoInstallmentsEnabled: true,
        autoCategoryInferenceEnabled: false, // Desligado
        unknownCategoryHandling: "assign_generic_and_prompt",
        monitoredBanks: ["Nubank"],
      });

      const result = processBankNotification({
        title: "Nubank",
        text: "Compra de R$ 30,00 em Padaria Estrela",
        packageName: "com.nu.production",
      });

      expect(result).not.toBeNull();
      expect(result?.categorySlug).toBeUndefined();
    });

    it("salva na store mas não envia push interativo se interactiveNotificationsEnabled for falso", async () => {
      const prefsModule = await import("./bank-assistant-preferences");
      const notifModule = await import("./interactive-notifications");
      const scheduleSpy = vi.spyOn(notifModule, "scheduleInteractiveBankNotification");
      const addSpy = vi.spyOn(suggestionsStoreModule, "addPendingSuggestion");

      vi.spyOn(prefsModule, "getBankAssistantPreferences").mockReturnValue({
        passiveCaptureEnabled: true,
        interactiveNotificationsEnabled: false, // Push desativado
        autoInstallmentsEnabled: true,
        autoCategoryInferenceEnabled: true,
        unknownCategoryHandling: "assign_generic_and_prompt",
        monitoredBanks: ["Nubank"],
      });

      const result = processBankNotification({
        title: "Nubank",
        text: "Compra de R$ 25,00 em Drogaria São Paulo",
        packageName: "com.nu.production",
      });

      expect(result).not.toBeNull();
      expect(addSpy).toHaveBeenCalledWith(result);
      expect(scheduleSpy).not.toHaveBeenCalled();
    });
  });

  describe("descoberta de apps instalados e sincronização nativa", () => {
    it("consulta apps bancários instalados através do plugin nativo", async () => {
      const { getInstalledBankingApps } = await import("./bank-listener");
      const result = await getInstalledBankingApps();
      expect(Array.isArray(result.apps)).toBe(true);
      expect(Array.isArray(result.installedBankNames)).toBe(true);
    });

    it("retorna metadados enriquecidos com categoria ao consultar apps nativos", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      mockPlugin.getInstalledBankingApps.mockResolvedValueOnce({
        apps: [
          { packageName: "com.nu.production", bankName: "Nubank", isInstalled: true, category: "bank" },
          { packageName: "com.google.android.apps.walletnfcrel", bankName: "Carteira Google", isInstalled: true, category: "wallet" },
          { packageName: "br.com.rico", bankName: "Rico", isInstalled: true, category: "broker" },
        ],
        installedBankNames: ["Nubank", "Carteira Google", "Rico"],
      });

      const { getInstalledBankingApps } = await import("./bank-listener");
      const result = await getInstalledBankingApps();

      expect(result.apps).toHaveLength(3);
      expect(result.apps[0]).toEqual({
        packageName: "com.nu.production",
        bankName: "Nubank",
        isInstalled: true,
        category: "bank",
      });
      expect(result.apps[1]?.category).toBe("wallet");
      expect(result.apps[2]?.category).toBe("broker");
      expect(result.installedBankNames).toEqual(["Nubank", "Carteira Google", "Rico"]);
    });

    it("sincroniza lista de bancos monitorados com pacotes nativos", async () => {
      const { syncMonitoredBanksWithNative } = await import("./bank-listener");
      const success = await syncMonitoredBanksWithNative(["Nubank", "Itaú"]);
      expect(success).toBe(true);
    });
  });

  describe("conferência e confirmação em segundo plano", () => {
    it("constrói rota correta de conferência para o Wizard Rápido", async () => {
      const { buildReviewRoute } = await import("./bank-listener");
      const route = buildReviewRoute({
        id: "test-1",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 4990,
        description: "Supermercado Extra",
        date: "2026-10-22",
        paymentMethod: "credit_card",
        cardLastDigits: "1234",
        installments: 3,
        rawText: "Compra de R$ 49,90",
        timestamp: Date.now(),
      });

      expect(route).toContain("/transacoes?");
      expect(route).toContain("novo=expense");
      expect(route).toContain("modo=rapido");
      expect(route).toContain("valor=4990");
      expect(route).toContain("descricao=Supermercado+Extra");
      expect(route).toContain("data=2026-10-22");
      expect(route).toContain("forma=credit_card");
      expect(route).toContain("cartao=1234");
      expect(route).toContain("parcelas=3");
    });

    it("descarrega transações confirmadas em segundo plano", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      mockPlugin.flushConfirmedTransactions.mockResolvedValueOnce({
        transactions: [
          {
            packageName: "com.nu.production",
            title: "Nubank",
            text: "Compra de R$ 25,00 no cartão de crédito aprovada",
            timestamp: 1729000000000,
          },
        ],
      });

      const { flushConfirmedBankTransactions } = await import("./bank-listener");
      const count = await flushConfirmedBankTransactions();
      expect(count).toBe(1);
    });
  });
});

