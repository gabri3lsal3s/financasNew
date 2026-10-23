import { LocalNotifications } from "@capacitor/local-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "./platform";
import {
  ACTION_ADD_EXPENSE,
  ACTION_ADD_INCOME,
  DAILY_REMINDER_NOTIFICATION_ID,
  cancelDailyReminder,
  checkNotificationPermissions,
  getDailyReminderTime,
  initNotificationActionListener,
  isDailyReminderEnabled,
  requestNotificationPermissions,
  scheduleDailyReminder,
  setDailyReminderEnabled,
  setDailyReminderTime,
} from "./local-notifications";

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    registerActionTypes: vi.fn(),
    createChannel: vi.fn(),
    schedule: vi.fn(),
    cancel: vi.fn(),
    addListener: vi.fn(),
  },
}));

describe("local-notifications service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Preferências locais do Lembrete Diário", () => {
    it("mantém estado ativado/desativado persistido", () => {
      expect(isDailyReminderEnabled("u1")).toBe(false);
      setDailyReminderEnabled(true, "u1");
      expect(isDailyReminderEnabled("u1")).toBe(true);
      setDailyReminderEnabled(false, "u1");
      expect(isDailyReminderEnabled("u1")).toBe(false);
    });

    it("retorna 20:00 como horário padrão e permite customização", () => {
      expect(getDailyReminderTime("u1")).toBe("20:00");
      setDailyReminderTime("21:30", "u1");
      expect(getDailyReminderTime("u1")).toBe("21:30");
    });
  });

  describe("checkNotificationPermissions e requestNotificationPermissions", () => {
    it("retorna granted em ambiente nativo conforme resposta do plugin", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });

      const res = await checkNotificationPermissions();
      expect(res.granted).toBe(true);
      expect(LocalNotifications.checkPermissions).toHaveBeenCalled();
    });

    it("solicita permissão em ambiente nativo", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.requestPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });

      const res = await requestNotificationPermissions();
      expect(res.granted).toBe(true);
      expect(LocalNotifications.requestPermissions).toHaveBeenCalled();
    });
  });

  describe("scheduleDailyReminder", () => {
    it("agenda notificação diária com canal, botões de ação e cancelamento de anterior", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.requestPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });
      (LocalNotifications.registerActionTypes as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (LocalNotifications.createChannel as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (LocalNotifications.cancel as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ notifications: [] });

      const success = await scheduleDailyReminder({ hour: 20, minute: 30 });
      expect(success).toBe(true);

      expect(LocalNotifications.registerActionTypes).toHaveBeenCalledWith({
        types: [
          expect.objectContaining({
            id: "DAILY_REMINDER_ACTIONS",
            actions: [
              expect.objectContaining({ id: ACTION_ADD_EXPENSE, title: "Despesa" }),
              expect.objectContaining({ id: ACTION_ADD_INCOME, title: "Receita" }),
            ],
          }),
        ],
      });

      expect(LocalNotifications.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: "daily_reminders", name: "Lembretes Diários" }),
      );

      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: DAILY_REMINDER_NOTIFICATION_ID }],
      });

      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            id: DAILY_REMINDER_NOTIFICATION_ID,
            title: "Fechamento Diário — Áxis Finance",
            schedule: {
              on: { hour: 20, minute: 30 },
              allowWhileIdle: true,
            },
          }),
        ],
      });
    });

    it("retorna false se permissão for negada", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.requestPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "denied",
      });

      const success = await scheduleDailyReminder({ hour: 20, minute: 0 });
      expect(success).toBe(false);
      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    });

    it("retorna true em ambiente Web sem falhar", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
      const success = await scheduleDailyReminder();
      expect(success).toBe(true);
    });
  });

  describe("cancelDailyReminder", () => {
    it("cancela notificação em ambiente nativo", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      await cancelDailyReminder();
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: DAILY_REMINDER_NOTIFICATION_ID }],
      });
    });
  });

  describe("initNotificationActionListener", () => {
    it("direciona para rota de receita quando a ação for add_income", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      let capturedCallback: ((action: { actionId: string }) => void) | undefined;
      const mockRemove = vi.fn();

      (LocalNotifications.addListener as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, callback: (action: { actionId: string }) => void) => {
          if (event === "localNotificationActionPerformed") {
            capturedCallback = callback;
          }
          return Promise.resolve({ remove: mockRemove });
        },
      );

      const onNavigate = vi.fn();
      const cleanup = initNotificationActionListener(onNavigate);

      capturedCallback?.({ actionId: ACTION_ADD_INCOME });
      expect(onNavigate).toHaveBeenCalledWith("/transacoes?novo=receita");

      capturedCallback?.({ actionId: ACTION_ADD_EXPENSE });
      expect(onNavigate).toHaveBeenCalledWith("/transacoes?novo=despesa");

      await cleanup();
      expect(mockRemove).toHaveBeenCalled();
    });

    it("direciona para rota personalizada se extra.url for fornecida", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      let capturedCallback: ((action: { actionId: string; notification?: { extra?: Record<string, unknown> } }) => void) | undefined;
      const mockRemove = vi.fn();

      (LocalNotifications.addListener as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, callback: (action: { actionId: string; notification?: { extra?: Record<string, unknown> } }) => void) => {
          if (event === "localNotificationActionPerformed") {
            capturedCallback = callback;
          }
          return Promise.resolve({ remove: mockRemove });
        },
      );

      const onNavigate = vi.fn();
      const cleanup = initNotificationActionListener(onNavigate);

      capturedCallback?.({ actionId: "tap", notification: { extra: { url: "/cartoes?card=c1" } } });
      expect(onNavigate).toHaveBeenCalledWith("/cartoes?card=c1");

      await cleanup();
    });
  });

  describe("dispatchLocalOrWebNotification e syncDueReminderNotifications", () => {
    it("consolida em notificação única elegante quando há 2 ou mais contas pendentes (anti-flood)", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });
      (LocalNotifications.createChannel as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ notifications: [] });

      const { syncDueReminderNotifications, setDueNotificationsEnabled } = await import("./local-notifications");
      setDueNotificationsEnabled(true, "u1");

      const count = await syncDueReminderNotifications(
        [
          {
            key: "bill:c1:2026-10",
            kind: "bill",
            title: "Fatura Nubank · 2026-10",
            dueDate: "2026-10-20",
            amountCents: 150000,
            status: "due_today",
            link: { path: "/cartoes", params: { card: "c1" } },
          },
          {
            key: "debt:d1",
            kind: "debt",
            title: "Empréstimo Carro",
            dueDate: "2026-10-18",
            amountCents: 80000,
            status: "overdue",
            link: { path: "/dividas" },
          },
        ],
        "u1",
        true,
      );

      expect(count).toBe(1);
      expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
      const scheduleCall = (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(scheduleCall.notifications[0].title).toContain("Áxis · Contas e faturas pendentes (2)");
    });

    it("emite notificação específica detalhada quando há apenas 1 conta pendente", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });
      (LocalNotifications.createChannel as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ notifications: [] });

      const { syncDueReminderNotifications, setDueNotificationsEnabled } = await import("./local-notifications");
      setDueNotificationsEnabled(true, "u2");

      const count = await syncDueReminderNotifications(
        [
          {
            key: "bill:c1:2026-10",
            kind: "bill",
            title: "Fatura Nubank · 2026-10",
            dueDate: "2026-10-20",
            amountCents: 150000,
            status: "due_today",
            link: { path: "/cartoes", params: { card: "c1" } },
          },
        ],
        "u2",
        true,
      );

      expect(count).toBe(1);
      expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
      const scheduleCall = (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(scheduleCall.notifications[0].title).toBe("Fatura Nubank · 2026-10 — Vence hoje");
    });

    it("ignora contas vencidas há mais de 30 dias (corte temporal anti-spam)", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });
      (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mockClear();

      const { syncDueReminderNotifications, setDueNotificationsEnabled } = await import("./local-notifications");
      setDueNotificationsEnabled(true, "u3");

      const count = await syncDueReminderNotifications(
        [
          {
            key: "bill:rico:2026-03",
            kind: "bill",
            title: "Fatura Rico · 2026-03",
            dueDate: "2026-03-10", // Mais de 7 meses atrás
            amountCents: 225585,
            status: "overdue",
          },
        ],
        "u3",
        true,
      );

      expect(count).toBe(0);
      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    });
  });
});
