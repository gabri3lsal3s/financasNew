import { describe, expect, it } from "vitest";
import {
  buildReminders,
  deriveReminderItems,
  applyReminderState,
  sortReminders,
  isSnoozeExpired,
  debtReminder,
  billReminder,
  type ReminderItem,
  type ReminderState,
} from "./index";

const TODAY = "2026-08-10";

const preferences = { enabled: true, debtDaysBefore: 3, billDaysBefore: 3 };

describe("billReminder (§3.10 — faturas)", () => {
  it("fatura vencida vira alerta overdue", () => {
    const item = billReminder(
      { key: "bill:c1:2026-07", title: "Fatura C1 · Jul", dueDate: "2026-07-10", amountCents: 100_000 },
      100_000,
      10,
      TODAY,
      3,
    );
    expect(item?.status).toBe("overdue");
  });

  it("fatura em breve vira alerta due_soon", () => {
    const item = billReminder(
      { key: "bill:c1:2026-08", title: "Fatura C1 · Ago", dueDate: "2026-08-12", amountCents: 100_000 },
      100_000,
      12,
      TODAY,
      3,
    );
    expect(item?.status).toBe("due_soon");
  });

  it("fatura longe do vencimento ou sem saldo não gera alerta", () => {
    const far = billReminder(
      { key: "bill:c1:2026-08", title: "Fatura C1", dueDate: "2026-08-25", amountCents: 100_000 },
      100_000,
      25,
      TODAY,
      3,
    );
    expect(far).toBeNull();
    const zero = billReminder(
      { key: "bill:c1:2026-08", title: "Fatura C1", dueDate: "2026-08-12", amountCents: 0 },
      0,
      12,
      TODAY,
      3,
    );
    expect(zero).toBeNull();
  });
});

describe("debtReminder (§3.10 — dívidas)", () => {
  it("dívida vencida vira alerta overdue", () => {
    const item = debtReminder(
      { key: "debt:d1", title: "Dívida 1", dueDate: "2026-08-01", amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(item?.status).toBe("overdue");
  });

  it("dívida vencendo hoje vira due_today", () => {
    const item = debtReminder(
      { key: "debt:d1", title: "Dívida 1", dueDate: TODAY, amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(item?.status).toBe("due_today");
  });

  it("dívida dentro da janela vira due_soon", () => {
    const item = debtReminder(
      { key: "debt:d1", title: "Dívida 1", dueDate: "2026-08-12", amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(item?.status).toBe("due_soon");
  });

  it("dívida longe do vencimento ou quitada não gera alerta", () => {
    const far = debtReminder(
      { key: "debt:d1", title: "Dívida 1", dueDate: "2026-08-25", amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(far).toBeNull();
    const paid = debtReminder(
      { key: "debt:d1", title: "Dívida 1", dueDate: "2026-08-05", amountCents: 50_000 },
      "2026-08-06",
      TODAY,
      3,
    );
    expect(paid).toBeNull();
  });
});

describe("applyReminderState (§3.10 — lido/snooze com expiração)", () => {
  const items: ReminderItem[] = [
    { key: "debt:a", kind: "debt", title: "A", dueDate: "2026-08-05", amountCents: 100, status: "overdue" },
    { key: "debt:b", kind: "debt", title: "B", dueDate: "2026-08-12", amountCents: 100, status: "due_soon" },
    { key: "debt:c", kind: "debt", title: "C", dueDate: "2026-08-20", amountCents: 100, status: "due_soon" },
  ];

  it("lido sai da lista", () => {
    const states: ReminderState[] = [{ key: "debt:a", kind: "read" }];
    const result = applyReminderState(items, states, TODAY);
    expect(result.map((i) => i.key)).toEqual(["debt:b", "debt:c"]);
  });

  it("snooze oculta até a data, mas expira ao vencer/atrasar", () => {
    const states: ReminderState[] = [
      { key: "debt:b", kind: "snoozed", snoozeUntil: "2026-08-15" }, // vence 12 → snooze válido → oculto
      { key: "debt:c", kind: "snoozed", snoozeUntil: "2026-08-09" }, // snooze expirou → volta
    ];
    const result = applyReminderState(items, states, TODAY);
    expect(result.map((i) => i.key)).toEqual(["debt:a", "debt:c"]);
  });

  it("snooze de item vencido sempre expira (alerta volta)", () => {
    const states: ReminderState[] = [{ key: "debt:a", kind: "snoozed", snoozeUntil: "2026-08-30" }];
    const result = applyReminderState(items, states, TODAY);
    expect(result.map((i) => i.key)).toContain("debt:a");
  });

  it("isSnoozeExpired: venceu/atrasou ou data passou", () => {
    expect(isSnoozeExpired({ key: "k", kind: "snoozed", snoozeUntil: "2026-08-09" }, "2026-08-12", TODAY)).toBe(true);
    expect(isSnoozeExpired({ key: "k", kind: "snoozed", snoozeUntil: "2026-08-15" }, "2026-08-12", TODAY)).toBe(false);
    expect(isSnoozeExpired({ key: "k", kind: "snoozed" }, "2026-08-12", TODAY)).toBe(false);
  });
});

describe("sortReminders (§3.10 — atrasados primeiro)", () => {
  it("ordena atrasados antes e por vencimento", () => {
    const sorted = sortReminders([
      { key: "debt:x", kind: "debt", title: "X", dueDate: "2026-08-20", amountCents: 1, status: "due_soon" },
      { key: "debt:y", kind: "debt", title: "Y", dueDate: "2026-08-01", amountCents: 1, status: "overdue" },
      { key: "debt:z", kind: "debt", title: "Z", dueDate: "2026-07-20", amountCents: 1, status: "overdue" },
    ]);
    expect(sorted.map((i) => i.key)).toEqual(["debt:z", "debt:y", "debt:x"]);
  });
});

describe("buildReminders (§3.10 — consolidação)", () => {
  const input = {
    bills: [
      {
        key: "bill:c1:2026-08",
        title: "Fatura C1 · Ago",
        competenceMonth: "2026-08",
        dueDay: 12,
        balanceCents: 200_000,
      },
      {
        key: "bill:c1:2026-09",
        title: "Fatura C1 · Set",
        competenceMonth: "2026-09",
        dueDay: 12,
        balanceCents: 50_000, // longe → sem alerta
      },
    ],
    debts: [
      {
        key: "debt:d1",
        title: "Dívida vencida",
        dueDate: "2026-08-01",
        amountCents: 50_000,
        paidAt: null,
      },
      {
        key: "debt:d2",
        title: "Dívida quitada",
        dueDate: "2026-08-05",
        amountCents: 50_000,
        paidAt: "2026-08-06",
      },
    ],
    preferences,
    today: TODAY,
  };

  it("consolida faturas e dívidas, aplica estado e ordena", () => {
    const reminders = buildReminders(input, [{ key: "debt:d1", kind: "read" }]);
    expect(reminders.map((r) => r.key)).toEqual(["bill:c1:2026-08"]);
    expect(reminders[0]?.status).toBe("due_soon");
  });

  it("deriveReminderItems retorna todas as faturas e dívidas elegíveis sem filtro de estado", () => {
    const reminders = deriveReminderItems(input);
    expect(reminders.map((r) => r.key)).toEqual(["debt:d1", "bill:c1:2026-08"]);
  });

  it("preferência desabilitada → lista vazia", () => {
    expect(buildReminders({ ...input, preferences: { ...preferences, enabled: false } })).toEqual([]);
    expect(deriveReminderItems({ ...input, preferences: { ...preferences, enabled: false } })).toEqual([]);
  });
});
