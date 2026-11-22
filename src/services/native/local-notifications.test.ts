import { LocalNotifications } from "@capacitor/local-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysISO, todayISO } from "@/domain/debts";
import * as platformModule from "./platform";
import * as interactiveModule from "./interactive-notifications";
import {
  ACTION_ADD_EXPENSE,
  ACTION_ADD_INCOME,
  ACTION_SNOOZE,
  DAILY_REMINDER_NOTIFICATION_ID,
  DUE_SUMMARY_NOTIFICATION_ID,
  cancelDailyReminder,
  checkNotificationPermissions,
  getDailyReminderTime,
  getDueScheduledDayNotificationId,
  getQuietHoursConfig,
  initNotificationActionListener,
  isDailyReminderEnabled,
  isRemotePushEnabled,
  requestNotificationPermissions,
  scheduleDailyReminder,
  setActiveDueKeys,
  setDailyReminderEnabled,
  setDailyReminderTime,
  setQuietHoursConfig,
  setRemotePushEnabled,
  syncDeviceNotificationsWithCloud,
} from "./local-notifications";

const mockSetReminderState = vi.fn().mockResolvedValue(undefined);

vi.mock("@/data/repositories/reminder-states", () => ({
  setReminderState: (...args: unknown[]) => mockSetReminderState(...args),
}));

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
            title: "Fechamento Diário — Axir",
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

    it("retorna false em ambiente Web sem enganar o usuário", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
      const success = await scheduleDailyReminder();
      expect(success).toBe(false);
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

    it("ACTION_SNOOZE agenda notificação futura (+3 dias às 09:00), preserva url e persiste estado snoozed", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });
      (LocalNotifications.createChannel as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ notifications: [] });
      (LocalNotifications.cancel as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      let capturedCallback:
        | ((action: {
            actionId: string;
            notification?: { id?: number; title?: string; body?: string; extra?: Record<string, unknown> };
          }) => void)
        | undefined;
      const mockRemove = vi.fn();

      (LocalNotifications.addListener as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, callback: typeof capturedCallback) => {
          if (event === "localNotificationActionPerformed") {
            capturedCallback = callback;
          }
          return Promise.resolve({ remove: mockRemove });
        },
      );

      const cleanup = initNotificationActionListener(vi.fn());

      capturedCallback?.({
        actionId: ACTION_SNOOZE,
        notification: {
          id: 555,
          title: "Fatura Nubank — Vence hoje",
          body: "Saldo em aberto",
          extra: { tag: "due:bill:c1:2026-10", url: "/cartoes?card=c1" },
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 555 }] });
      expect(mockSetReminderState).toHaveBeenCalledWith("bill:c1:2026-10", {
        kind: "snoozed",
        snoozeUntil: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
      const scheduleCall = (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(scheduleCall.notifications[0].schedule.at).toBeInstanceOf(Date);
      expect(scheduleCall.notifications[0].schedule.at.getTime()).toBeGreaterThan(Date.now());
      expect(scheduleCall.notifications[0].extra.url).toBe("/cartoes?card=c1");

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
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      const count = await syncDueReminderNotifications(
        [
          {
            key: "bill:c1:2026-10",
            kind: "bill",
            title: "Fatura Nubank · 2026-10",
            dueDate: today,
            amountCents: 150000,
            status: "due_today",
            link: { path: "/cartoes", params: { card: "c1" } },
          },
          {
            key: "debt:d1",
            kind: "debt",
            title: "Empréstimo Carro",
            dueDate: yesterday,
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
      expect(scheduleCall.notifications[0].title).toContain("Axir · Contas e faturas pendentes (2)");
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

    it("não emite notificações nativas quando o modo de demonstração/tour está ativo", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      const demoStateModule = await import("@/state/demo-mode");
      const startSpy = vi.spyOn(demoStateModule, "getDemoSessionState").mockReturnValue({
        isDemoActive: true,
        activeTrack: "finances",
        currentStepIndex: 0,
      });

      const { syncDueReminderNotifications, setDueNotificationsEnabled } = await import("./local-notifications");
      setDueNotificationsEnabled(true, "u-demo");

      const count = await syncDueReminderNotifications(
        [
          {
            key: "bill:mock-card-1:2026-11",
            kind: "bill",
            title: "Fatura Mastercard Black Principal · 2026-11",
            dueDate: "2026-11-05",
            amountCents: 67500,
            status: "due_soon",
          },
        ],
        "u-demo",
        true,
      );

      expect(count).toBe(0);
      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
      startSpy.mockRestore();
    });

    it("filtra itens mock e limpa notificações ao zerar pendências", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });

      const { syncDueReminderNotifications, setDueNotificationsEnabled } = await import("./local-notifications");
      setDueNotificationsEnabled(true, "u4");

      const count = await syncDueReminderNotifications(
        [
          {
            key: "bill:mock-card-1:2026-11",
            kind: "bill",
            title: "Fatura Mastercard Black Principal",
            dueDate: "2026-11-05",
            amountCents: 67500,
            status: "due_soon",
          },
        ],
        "u4",
        true,
      );

      expect(count).toBe(0);
      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
      expect(LocalNotifications.cancel).toHaveBeenCalled();
    });

    it("cancela notificação de fatura individual ao chamar cancelDueReminderNotification", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      const { cancelDueReminderNotification } = await import("./local-notifications");

      await cancelDueReminderNotification("bill:rico:2026-10", "u-rico");

      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [expect.objectContaining({ id: expect.any(Number) })],
      });
    });

    it("ignora recebíveis (direction: receivable) no push do dispositivo e cancela resumo 2030 ao cancelar item", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });
      (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mockClear();
      (LocalNotifications.cancel as unknown as ReturnType<typeof vi.fn>).mockClear();

      const { syncDueReminderNotifications, cancelDueReminderNotification, setDueNotificationsEnabled } =
        await import("./local-notifications");
      setDueNotificationsEnabled(true, "u-recv");

      const today = new Date().toISOString().slice(0, 10);
      const count = await syncDueReminderNotifications(
        [
          {
            key: "debt:racha-1",
            kind: "debt",
            direction: "receivable",
            title: "Racha: Churrasco",
            dueDate: today,
            amountCents: 12000,
            status: "pending",
          },
        ],
        "u-recv",
        true,
      );

      expect(count).toBe(0);
      expect(LocalNotifications.schedule).not.toHaveBeenCalled();

      setActiveDueKeys(["summary"], "u-recv");
      await cancelDueReminderNotification("bill:c1:2026-10", "u-recv");
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: DUE_SUMMARY_NOTIFICATION_ID }],
      });
    });

    it("agenda contas futuras (até 7 dias) às 09:00 no nativo e cancela agrupamento day:* na quitação", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      (LocalNotifications.checkPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        display: "granted",
      });
      (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mockClear();
      (LocalNotifications.cancel as unknown as ReturnType<typeof vi.fn>).mockClear();

      const { syncDueReminderNotifications, cancelDueReminderNotification, setDueNotificationsEnabled } =
        await import("./local-notifications");
      setDueNotificationsEnabled(true, "u-sched");
      setQuietHoursConfig({ enabled: true, start: "22:00", end: "08:00" }, "u-sched");

      const future3Days = addDaysISO(todayISO(), 3);
      const count = await syncDueReminderNotifications(
        [
          {
            key: "debt:f1",
            kind: "debt",
            title: "Condomínio",
            dueDate: future3Days,
            amountCents: 45000,
            status: "due_soon",
          },
          {
            key: "debt:f2",
            kind: "debt",
            title: "Água",
            dueDate: future3Days,
            amountCents: 9000,
            status: "due_soon",
          },
        ],
        "u-sched",
        true,
      );

      expect(count).toBe(1);
      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: [
          expect.objectContaining({
            id: getDueScheduledDayNotificationId(future3Days),
            title: "Axir · Contas que vencem hoje (2)",
            schedule: expect.objectContaining({
              at: expect.any(Date),
              allowWhileIdle: true,
            }),
          }),
        ],
      });

      const scheduleCall = (LocalNotifications.schedule as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(scheduleCall.notifications[0].schedule.at.getHours()).toBe(9);

      await cancelDueReminderNotification("debt:f1", "u-sched");
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: getDueScheduledDayNotificationId(future3Days) }],
      });
    });

    it("sincroniza Horário Silencioso e Push Remoto com a nuvem", () => {
      expect(isRemotePushEnabled("u-q")).toBe(false);
      expect(getQuietHoursConfig("u-q")).toEqual({ enabled: true, start: "22:00", end: "08:00" });

      syncDeviceNotificationsWithCloud(
        {
          remotePushEnabled: true,
          quietHours: { enabled: true, start: "23:00", end: "07:30" },
        },
        "u-q",
      );

      expect(isRemotePushEnabled("u-q")).toBe(true);
      expect(getQuietHoursConfig("u-q")).toEqual({ enabled: true, start: "23:00", end: "07:30" });

      setRemotePushEnabled(false, "u-q");
      setQuietHoursConfig({ enabled: false }, "u-q");
      expect(isRemotePushEnabled("u-q")).toBe(false);
      expect(getQuietHoursConfig("u-q")).toEqual({ enabled: false, start: "23:00", end: "07:30" });
    });

    it("abre Wizard Rápido via ACTION_QUICK_ADD quando quickAddTransaction retornar requiresWizard", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      const quickAddSpy = vi.spyOn(interactiveModule, "quickAddTransaction").mockResolvedValueOnce({
        success: false,
        requiresWizard: true,
        type: "expense",
        error: "Categoria desconhecida",
      });

      let capturedCallback: ((action: { actionId: string; notification?: { extra?: Record<string, unknown> } }) => void) | undefined;
      (LocalNotifications.addListener as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, callback: typeof capturedCallback) => {
          if (event === "localNotificationActionPerformed") {
            capturedCallback = callback;
          }
          return Promise.resolve({ remove: vi.fn() });
        },
      );

      const onNavigate = vi.fn();
      const cleanup = initNotificationActionListener(onNavigate);

      capturedCallback?.({
        actionId: interactiveModule.ACTION_QUICK_ADD,
        notification: {
          extra: {
            suggestion: {
              id: "sug-wiz-1",
              bankName: "Nubank",
              nature: "expense",
              type: "expense",
              amountCents: 6500,
              description: "Loja X",
              date: "2026-11-22",
              paymentMethod: "pix",
              rawText: "Pix de R$ 65,00",
              timestamp: 1729000000000,
            },
          },
        },
      });

      await new Promise((r) => setTimeout(r, 15));
      expect(quickAddSpy).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining("/transacoes?"));
      expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining("modo=rapido"));

      await cleanup();
    });
  });
});
