import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUIET_HOURS,
  adjustDateForQuietHours,
  buildDueNotificationSchedule,
  isWithinQuietHours,
  normalizeQuietHours,
  parseTimeHHMM,
  type DueScheduleInputItem,
} from "./schedule";

function makeItem(overrides: Partial<DueScheduleInputItem> = {}): DueScheduleInputItem {
  return {
    key: "debt:d1",
    kind: "debt",
    direction: "payable",
    title: "Aluguel",
    dueDate: "2026-11-22",
    amountCents: 150000,
    status: "due_today",
    link: { path: "/dividas", params: { q: "d1" } },
    ...overrides,
  };
}

describe("Domain — Notification Schedule & Quiet Hours", () => {
  describe("parseTimeHHMM e normalizeQuietHours", () => {
    it("faz parsing de horários válidos e retorna fallback para entradas inválidas", () => {
      expect(parseTimeHHMM("22:30", 20, 0)).toEqual({ hour: 22, minute: 30 });
      expect(parseTimeHHMM("8:05", 20, 0)).toEqual({ hour: 8, minute: 5 });
      expect(parseTimeHHMM("25:00", 22, 0)).toEqual({ hour: 22, minute: 0 });
      expect(parseTimeHHMM("10:75", 9, 15)).toEqual({ hour: 9, minute: 15 });
      expect(parseTimeHHMM(null, 22, 0)).toEqual({ hour: 22, minute: 0 });
    });

    it("normaliza configuração parcial ou ausente para o padrão 22:00–08:00", () => {
      expect(normalizeQuietHours(null)).toEqual(DEFAULT_QUIET_HOURS);
      expect(normalizeQuietHours({ enabled: false, start: "23:00" })).toEqual({
        enabled: false,
        start: "23:00",
        end: "08:00",
      });
    });
  });

  describe("isWithinQuietHours e adjustDateForQuietHours", () => {
    it("identifica corretamente janelas noturnas que cruzam a meia-noite (22:00–08:00)", () => {
      expect(isWithinQuietHours(new Date(2026, 10, 22, 23, 30), DEFAULT_QUIET_HOURS)).toBe(true);
      expect(isWithinQuietHours(new Date(2026, 10, 22, 3, 15), DEFAULT_QUIET_HOURS)).toBe(true);
      expect(isWithinQuietHours(new Date(2026, 10, 22, 8, 0), DEFAULT_QUIET_HOURS)).toBe(false);
      expect(isWithinQuietHours(new Date(2026, 10, 22, 14, 0), DEFAULT_QUIET_HOURS)).toBe(false);
    });

    it("trata janelas no mesmo dia e desabilitação", () => {
      const afternoon = { enabled: true, start: "13:00", end: "15:00" };
      expect(isWithinQuietHours(new Date(2026, 10, 22, 14, 0), afternoon)).toBe(true);
      expect(isWithinQuietHours(new Date(2026, 10, 22, 15, 0), afternoon)).toBe(false);

      expect(
        isWithinQuietHours(new Date(2026, 10, 22, 23, 30), {
          ...DEFAULT_QUIET_HOURS,
          enabled: false,
        }),
      ).toBe(false);
    });

    it("adianta horários dentro de Quiet Hours para o término sem mutar a data original", () => {
      const night = new Date(2026, 10, 22, 23, 15, 0, 0);
      const adjustedNight = adjustDateForQuietHours(night, DEFAULT_QUIET_HOURS);
      expect(night.getDate()).toBe(22);
      expect(adjustedNight.getFullYear()).toBe(2026);
      expect(adjustedNight.getMonth()).toBe(10);
      expect(adjustedNight.getDate()).toBe(23);
      expect(adjustedNight.getHours()).toBe(8);
      expect(adjustedNight.getMinutes()).toBe(0);

      const dawn = new Date(2026, 10, 23, 3, 45, 0, 0);
      const adjustedDawn = adjustDateForQuietHours(dawn, DEFAULT_QUIET_HOURS);
      expect(adjustedDawn.getDate()).toBe(23);
      expect(adjustedDawn.getHours()).toBe(8);
      expect(adjustedDawn.getMinutes()).toBe(0);

      const daytime = new Date(2026, 10, 22, 14, 0, 0, 0);
      const adjustedDay = adjustDateForQuietHours(daytime, DEFAULT_QUIET_HOURS);
      expect(adjustedDay.getTime()).toBe(daytime.getTime());
    });
  });

  describe("buildDueNotificationSchedule", () => {
    const today = "2026-11-22";
    const daytimeNow = new Date(2026, 10, 22, 11, 0, 0, 0);

    it("exclui itens receivable, itens mock e contas vencidas há mais de 30 dias", () => {
      const plan = buildDueNotificationSchedule({
        today,
        now: daytimeNow,
        isNative: true,
        reminders: [
          makeItem({ key: "debt:recv-1", direction: "receivable", status: "due_today" }),
          makeItem({ key: "bill:mock-1:2026-11", status: "due_today" }),
          makeItem({ key: "debt:old-1", dueDate: "2026-10-01", status: "overdue" }),
        ],
      });

      expect(plan).toEqual([]);
    });

    it("consolida múltiplas contas de hoje/atrasadas em 1 resumo anti-flood", () => {
      const plan = buildDueNotificationSchedule({
        today,
        now: daytimeNow,
        isNative: true,
        reminders: [
          makeItem({ key: "debt:d1", dueDate: today, amountCents: 100000, status: "due_today" }),
          makeItem({
            key: "bill:c1:2026-11",
            kind: "bill",
            title: "Fatura Nubank · 2026-11",
            dueDate: "2026-11-20",
            amountCents: 50000,
            status: "overdue",
          }),
        ],
      });

      expect(plan).toHaveLength(1);
      expect(plan[0]).toMatchObject({
        scope: "today",
        key: "summary",
        tag: "due:summary",
        title: "Axir · Contas e faturas pendentes (2)",
        url: "/lembretes",
        isSummary: true,
        scheduleAt: undefined,
      });
    });

    it("adiciona scheduleAt para o fim do Horário Silencioso quando now cai na madrugada no nativo", () => {
      const nightNow = new Date(2026, 10, 22, 23, 10, 0, 0);
      const plan = buildDueNotificationSchedule({
        today,
        now: nightNow,
        isNative: true,
        reminders: [makeItem()],
      });

      expect(plan).toHaveLength(1);
      expect(plan[0]?.scheduleAt?.getDate()).toBe(23);
      expect(plan[0]?.scheduleAt?.getHours()).toBe(8);
      expect(plan[0]?.actionTypeId).toBe("DUE_REMINDER_ACTIONS");
    });

    it("suprime disparos imediatos na Web durante o Horário Silencioso", () => {
      const nightNow = new Date(2026, 10, 22, 23, 10, 0, 0);
      const plan = buildDueNotificationSchedule({
        today,
        now: nightNow,
        isNative: false,
        reminders: [makeItem()],
      });

      expect(plan).toHaveLength(0);
    });

    it("agenda próximos 7 dias no nativo às 09:00 agrupando múltiplas contas do mesmo dia", () => {
      const plan = buildDueNotificationSchedule({
        today,
        now: daytimeNow,
        isNative: true,
        reminders: [
          makeItem({
            key: "bill:c1:2026-11",
            kind: "bill",
            title: "Fatura Inter · 2026-11",
            dueDate: "2026-11-25",
            amountCents: 80000,
            status: "due_soon",
            link: { path: "/cartoes", params: { card: "c1", month: "2026-11" } },
          }),
          makeItem({
            key: "debt:d2",
            title: "Internet",
            dueDate: "2026-11-27",
            amountCents: 12000,
            status: "pending",
          }),
          makeItem({
            key: "debt:d3",
            title: "Energia",
            dueDate: "2026-11-27",
            amountCents: 23000,
            status: "pending",
          }),
          makeItem({
            key: "debt:d4",
            title: "Fora da janela",
            dueDate: "2026-12-05",
            amountCents: 50000,
            status: "pending",
          }),
        ],
      });

      expect(plan).toHaveLength(2);

      expect(plan[0]).toMatchObject({
        scope: "upcoming",
        dueDate: "2026-11-25",
        key: "bill:c1:2026-11",
        tag: "due:bill:c1:2026-11",
        title: "Fatura Inter · 2026-11 — Vence hoje",
        url: "/cartoes?card=c1&month=2026-11",
        isSummary: false,
        actionTypeId: "DUE_REMINDER_ACTIONS",
      });
      expect(plan[0]?.scheduleAt?.getFullYear()).toBe(2026);
      expect(plan[0]?.scheduleAt?.getMonth()).toBe(10);
      expect(plan[0]?.scheduleAt?.getDate()).toBe(25);
      expect(plan[0]?.scheduleAt?.getHours()).toBe(9);

      expect(plan[1]).toMatchObject({
        scope: "upcoming",
        dueDate: "2026-11-27",
        key: "day:2026-11-27",
        tag: "due:day:2026-11-27",
        title: "Axir · Contas que vencem hoje (2)",
        url: "/lembretes",
        isSummary: true,
      });
      expect(plan[1]?.scheduleAt?.getDate()).toBe(27);
      expect(plan[1]?.scheduleAt?.getHours()).toBe(9);
    });

    it("desloca agendamento futuro das 09:00 se Quiet Hours terminar às 10:00 e omite futuros na Web", () => {
      const reminders = [
        makeItem({
          key: "debt:d2",
          title: "Internet",
          dueDate: "2026-11-25",
          amountCents: 12000,
          status: "due_soon",
        }),
      ];

      const nativePlan = buildDueNotificationSchedule({
        today,
        now: daytimeNow,
        isNative: true,
        quietHours: { enabled: true, start: "22:00", end: "10:00" },
        reminders,
      });
      expect(nativePlan).toHaveLength(1);
      expect(nativePlan[0]?.scheduleAt?.getHours()).toBe(10);
      expect(nativePlan[0]?.scheduleAt?.getMinutes()).toBe(0);

      const webPlan = buildDueNotificationSchedule({
        today,
        now: daytimeNow,
        isNative: false,
        reminders,
      });
      // Na Web, due_soon entra no balde imediato (sem scheduleAt), nunca em upcoming
      expect(webPlan).toHaveLength(1);
      expect(webPlan[0]?.scope).toBe("today");
      expect(webPlan[0]?.scheduleAt).toBeUndefined();
    });
  });
});
