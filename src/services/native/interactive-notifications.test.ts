import { LocalNotifications } from "@capacitor/local-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedBankTransaction } from "@/domain/notifications";
import type { Category, CreditCard } from "@/types";
import * as platformModule from "./platform";
import * as categoriesRepo from "@/data/repositories/categories";
import * as creditCardsRepo from "@/data/repositories/credit-cards";
import * as rpcData from "@/data/rpc";
import * as storeModule from "./suggestions-store";
import {
  ACTION_EDIT,
  ACTION_QUICK_ADD,
  ACTION_UNDO,
  BANK_FEEDBACK_ACTION_TYPE_ID,
  BANK_SUGGESTION_ACTION_TYPE_ID,
  BANK_SUGGESTION_CHANNEL_ID,
  findMatchingCategory,
  formatCurrencyBRL,
  formatMethodLabel,
  hashString,
  quickAddTransaction,
  scheduleInteractiveBankNotification,
  setupInteractiveNotificationActions,
  undoQuickAddTransaction,
} from "./interactive-notifications";

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    createChannel: vi.fn(),
    registerActionTypes: vi.fn(),
    schedule: vi.fn(),
    cancel: vi.fn(),
    addListener: vi.fn(),
  },
}));

vi.mock("@/data/repositories/categories", () => ({
  listCategories: vi.fn(),
}));

vi.mock("@/data/repositories/credit-cards", () => ({
  listActiveCreditCards: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  createExpenseWithDebt: vi.fn(),
  createIncomeInstallments: vi.fn(),
  deleteExpenseInstallments: vi.fn(),
}));

vi.mock("@/data/repositories/incomes", () => ({
  createIncome: vi.fn(),
  deleteIncome: vi.fn(),
}));

describe("interactive-notifications service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
  });

  describe("hashString", () => {
    it("gera número inteiro determinístico e positivo para IDs de notificação", () => {
      const id1 = hashString("sug_1729000000_3000_abc");
      const id2 = hashString("sug_1729000000_3000_abc");
      const id3 = hashString("sug_1729000000_5000_xyz");

      expect(id1).toBe(id2);
      expect(id1).toBeGreaterThanOrEqual(1000);
      expect(typeof id1).toBe("number");
      expect(id1).not.toBe(id3);
    });
  });

  describe("formatCurrencyBRL e formatMethodLabel", () => {
    it("formata centavos em string monetária pt-BR sem emojis", () => {
      expect(formatCurrencyBRL(4290)).toBe("R$ 42,90");
      expect(formatCurrencyBRL(15000)).toBe("R$ 150,00");
      expect(formatCurrencyBRL(99)).toBe("R$ 0,99");
    });

    it("formata rótulos amigáveis de meios de pagamento", () => {
      expect(formatMethodLabel("credit_card")).toBe("Cartão de Crédito");
      expect(formatMethodLabel("debit")).toBe("Cartão de Débito");
      expect(formatMethodLabel("pix")).toBe("Pix");
      expect(formatMethodLabel("transfer")).toBe("TED/DOC");
      expect(formatMethodLabel("other")).toBe("Outro");
    });
  });

  describe("findMatchingCategory", () => {
    const mockCategories: Category[] = [
      { id: "c1", user_id: "u1", name: "Alimentação", type: "expense", icon: null, color: null, is_reserved: false, is_active: true },
      { id: "c2", user_id: "u1", name: "Supermercado", type: "expense", icon: null, color: null, is_reserved: false, is_active: true },
      { id: "c3", user_id: "u1", name: "Transporte", type: "expense", icon: null, color: null, is_reserved: false, is_active: true },
      { id: "c4", user_id: "u1", name: "Saúde", type: "expense", icon: null, color: null, is_reserved: false, is_active: true },
      { id: "c5", user_id: "u1", name: "Lazer", type: "expense", icon: null, color: null, is_reserved: false, is_active: true },
      { id: "c6", user_id: "u1", name: "Salário", type: "income", icon: null, color: null, is_reserved: false, is_active: true },
    ];

    it("infere categoria por palavras-chave do estabelecimento", () => {
      expect(findMatchingCategory(mockCategories, "Padaria Bella Vista")?.id).toBe("c1");
      expect(findMatchingCategory(mockCategories, "Supermercado Central")?.id).toBe("c2");
      expect(findMatchingCategory(mockCategories, "Posto Shell")?.id).toBe("c3");
      expect(findMatchingCategory(mockCategories, "Drogasil")?.id).toBe("c4");
      expect(findMatchingCategory(mockCategories, "Cinema Kinoplex")?.id).toBe("c5");
      expect(findMatchingCategory(mockCategories, "Tech Corp Salário")?.id).toBe("c6");
    });

    it("retorna undefined quando nenhum termo corresponder", () => {
      expect(findMatchingCategory(mockCategories, "Estabelecimento Desconhecido")).toBeUndefined();
    });
  });

  describe("setupInteractiveNotificationActions", () => {
    it("registra canal e ações interativas no Android", async () => {
      await setupInteractiveNotificationActions();

      expect(LocalNotifications.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: BANK_SUGGESTION_CHANNEL_ID,
          importance: 4,
        }),
      );

      expect(LocalNotifications.registerActionTypes).toHaveBeenCalledWith({
        types: expect.arrayContaining([
          expect.objectContaining({
            id: BANK_SUGGESTION_ACTION_TYPE_ID,
            actions: [
              expect.objectContaining({ id: ACTION_EDIT, title: "Conferir e Salvar" }),
              expect.objectContaining({ id: ACTION_QUICK_ADD, title: "Adicionar Rápido" }),
            ],
          }),
          expect.objectContaining({
            id: BANK_FEEDBACK_ACTION_TYPE_ID,
            actions: [expect.objectContaining({ id: ACTION_UNDO, title: "Desfazer" })],
          }),
        ]),
      });
    });
  });

  describe("scheduleInteractiveBankNotification", () => {
    it("agenda notificação de compra parcelada com botões nativos", async () => {
      const sampleTx: ParsedBankTransaction = {
        id: "sug_1",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 15000,
        description: "Tok&Stok",
        date: "2026-10-16",
        paymentMethod: "credit_card",
        installments: 3,
        installmentAmountCents: 5000,
        rawText: "Compra de R$ 150,00 em 3x na Tok&Stok",
        timestamp: 1729000000000,
      };

      const notifId = await scheduleInteractiveBankNotification(sampleTx);
      expect(notifId).not.toBeNull();

      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            id: notifId,
            title: "Transação detectada (3x): R$ 150,00",
            body: "Tok&Stok · Nubank (Cartão de Crédito)",
            channelId: BANK_SUGGESTION_CHANNEL_ID,
            actionTypeId: BANK_SUGGESTION_ACTION_TYPE_ID,
            extra: expect.objectContaining({
              suggestion: sampleTx,
            }),
          }),
        ],
      });
    });

    it("agenda notificação de receita com botões nativos", async () => {
      const sampleIncome: ParsedBankTransaction = {
        id: "sug_2",
        bankName: "Inter",
        nature: "income",
        type: "income",
        amountCents: 25000,
        description: "Marcos Silva",
        date: "2026-10-16",
        paymentMethod: "pix",
        rawText: "Pix recebido de R$ 250,00",
        timestamp: 1729000001000,
      };

      const notifId = await scheduleInteractiveBankNotification(sampleIncome);
      expect(notifId).not.toBeNull();

      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            title: "Renda detectada: R$ 250,00",
            body: "Marcos Silva · Inter (Pix)",
          }),
        ],
      });
    });
  });

  describe("quickAddTransaction e undoQuickAddTransaction", () => {
    const sampleExpense: ParsedBankTransaction = {
      id: "sug_exp_1",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 4290,
      description: "Padaria Estrela",
      date: "2026-10-16",
      paymentMethod: "credit_card",
      rawText: "Compra de R$ 42,90 na Padaria Estrela",
      timestamp: 1729000000000,
    };

    const mockCategories: Category[] = [
      { id: "cat-ali", user_id: "u1", name: "Alimentação", type: "expense", icon: null, color: null, is_reserved: false, is_active: true },
    ];

    const mockCards: CreditCard[] = [
      {
        id: "card-nu",
        user_id: "u1",
        name: "Nubank Ultravioleta",
        credit_limit: 5000,
        closing_day: 5,
        due_day: 12,
        brand: null,
        color: null,
        is_active: true,
      },
    ];

    it("grava despesa com categoria e cartão inferidos em segundo plano", async () => {
      vi.spyOn(categoriesRepo, "listCategories").mockResolvedValue(mockCategories);
      vi.spyOn(creditCardsRepo, "listActiveCreditCards").mockResolvedValue(mockCards);
      vi.spyOn(rpcData, "createExpenseWithDebt").mockResolvedValue("expense-created-123");
      const dismissSpy = vi.spyOn(storeModule, "dismissPendingSuggestion");

      const result = await quickAddTransaction(sampleExpense);

      expect(result.success).toBe(true);
      expect(result.createdId).toBe("expense-created-123");
      expect(result.categoryName).toBe("Alimentação");

      expect(rpcData.createExpenseWithDebt).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 42.9,
          categoryId: "cat-ali",
          cardId: "card-nu",
          description: "Padaria Estrela",
        }),
      );

      expect(dismissSpy).toHaveBeenCalledWith("sug_exp_1");
      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            title: "Lançamento registrado",
            body: "R$ 42,90 adicionado em Alimentação",
            actionTypeId: BANK_FEEDBACK_ACTION_TYPE_ID,
          }),
        ],
      });
    });

    it("resiliência online first: não grava e alerta ausência de internet", async () => {
      // Simula modo offline no navegador
      const originalOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      const result = await quickAddTransaction(sampleExpense);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Sem conexão");
      expect(rpcData.createExpenseWithDebt).not.toHaveBeenCalled();

      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            title: "Sem conexão à internet",
          }),
        ],
      });

      Object.defineProperty(navigator, "onLine", { value: originalOnline, configurable: true });
    });

    it("desfaz gravação rápida e restaura a transação na fila de sugestões", async () => {
      vi.spyOn(rpcData, "deleteExpenseInstallments").mockResolvedValue(1);
      const addSpy = vi.spyOn(storeModule, "addPendingSuggestion");

      const undone = await undoQuickAddTransaction("expense-created-123", "expense", sampleExpense);

      expect(undone).toBe(true);
      expect(rpcData.deleteExpenseInstallments).toHaveBeenCalledWith("expense-created-123", "all");
      expect(addSpy).toHaveBeenCalledWith(sampleExpense);

      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            title: "Lançamento desfeito",
          }),
        ],
      });
    });
  });
});
