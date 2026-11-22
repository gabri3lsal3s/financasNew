import { describe, expect, it } from "vitest";
import {
  buildReminders,
  deriveReminderItems,
  applyReminderState,
  sortReminders,
  isSnoozeExpired,
  isDebtLinkedToSplit,
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
    expect(item?.direction).toBe("payable");
  });

  it("fatura vencendo hoje vira alerta due_today", () => {
    const item = billReminder(
      { key: "bill:c1:2026-08", title: "Fatura C1 · Ago", dueDate: TODAY, amountCents: 100_000 },
      100_000,
      10,
      TODAY,
      3,
    );
    expect(item?.status).toBe("due_today");
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
  it("dívida a pagar vencida vira alerta overdue", () => {
    const item = debtReminder(
      { key: "debt:d1", title: "Dívida 1", direction: "payable", dueDate: "2026-08-01", amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(item?.status).toBe("overdue");
  });

  it("dívida a pagar vencendo hoje vira due_today", () => {
    const item = debtReminder(
      { key: "debt:d1", title: "Dívida 1", direction: "payable", dueDate: TODAY, amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(item?.status).toBe("due_today");
  });

  it("dívida dentro da janela vira due_soon e respeita daysBefore 0, 1 e 2", () => {
    const inTwoDays = debtReminder(
      { key: "debt:d1", title: "Dívida 1", direction: "payable", dueDate: "2026-08-12", amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(inTwoDays?.status).toBe("due_soon");

    expect(
      debtReminder(
        { key: "debt:d1", title: "Dívida 1", direction: "payable", dueDate: "2026-08-12", amountCents: 50_000 },
        null,
        TODAY,
        1,
      ),
    ).toBeNull();

    expect(
      debtReminder(
        { key: "debt:d1", title: "Dívida 1", direction: "payable", dueDate: "2026-08-11", amountCents: 50_000 },
        null,
        TODAY,
        0,
      ),
    ).toBeNull();
  });

  it("dívida a receber (receivable) nunca vira overdue ou due_today (permanece pending/informativa)", () => {
    const overdueReceivable = debtReminder(
      { key: "debt:r1", title: "Empréstimo João", direction: "receivable", dueDate: "2026-08-01", amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(overdueReceivable?.status).toBe("pending");
    expect(overdueReceivable?.direction).toBe("receivable");

    const todayReceivable = debtReminder(
      { key: "debt:r2", title: "Cobrança Ana", direction: "receivable", dueDate: TODAY, amountCents: 50_000 },
      null,
      TODAY,
      3,
    );
    expect(todayReceivable?.status).toBe("pending");
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

describe("isDebtLinkedToSplit", () => {
  it("detecta dívida a receber vinculada a racha por prefixo ou public_share", () => {
    expect(isDebtLinkedToSplit({ id: "d1", name: "Racha: Churrasco", type: "receivable" })).toBe(true);
    expect(
      isDebtLinkedToSplit(
        { id: "d2", name: "Churrasco", type: "receivable", expense_id: "exp-1" },
        [{ payload: { expense_id: "exp-1" } }],
      ),
    ).toBe(true);
    expect(
      isDebtLinkedToSplit(
        { id: "d3", name: "Reembolso", type: "receivable" },
        [{ debt_id: "d3" }],
      ),
    ).toBe(true);
    expect(isDebtLinkedToSplit({ id: "d4", name: "Racha: Fatura", type: "payable" })).toBe(false);
    expect(isDebtLinkedToSplit({ id: "d5", name: "Freela", type: "receivable" })).toBe(false);
    expect(isDebtLinkedToSplit({ id: "d6", name: "Borracha escolar", type: "receivable" })).toBe(false);
    expect(isDebtLinkedToSplit({ id: "d7", name: "Divisão racha amigos", type: "receivable" })).toBe(true);
    expect(
      isDebtLinkedToSplit(
        { id: "d8-2", name: "Churrasco 2/2", type: "receivable", installment_group_id: "grp-1" },
        [{ debt_id: "d8-1" }],
        [
          { id: "d8-1", installment_group_id: "grp-1" },
          { id: "d8-2", installment_group_id: "grp-1" },
        ],
      ),
    ).toBe(true);
  });
});

describe("applyReminderState (§3.10 — lido/snooze por data civil)", () => {
  const items: ReminderItem[] = [
    { key: "debt:a", kind: "debt", title: "A", dueDate: "2026-08-05", amountCents: 100, status: "overdue" },
    { key: "debt:b", kind: "debt", title: "B", dueDate: "2026-08-19", amountCents: 100, status: "due_soon" },
    { key: "debt:c", kind: "debt", title: "C", dueDate: "2026-08-20", amountCents: 100, status: "due_soon" },
  ];

  it("lido sai da lista", () => {
    const states: ReminderState[] = [{ key: "debt:a", kind: "read" }];
    const result = applyReminderState(items, states, TODAY);
    expect(result.map((i) => i.key)).toEqual(["debt:b", "debt:c"]);
  });

  it("snooze oculta enquanto today < snoozeUntil (inclusive itens vencidos ou com dueDate > snoozeUntil) e reexibe quando today >= snoozeUntil", () => {
    const states: ReminderState[] = [
      { key: "debt:a", kind: "snoozed", snoozeUntil: "2026-08-13" }, // vencido, adiado para +3d -> oculto hoje
      { key: "debt:b", kind: "snoozed", snoozeUntil: "2026-08-17" }, // dueDate 19 > 17 -> continua oculto até dia 17
      { key: "debt:c", kind: "snoozed", snoozeUntil: "2026-08-10" }, // snoozeUntil == TODAY -> expirou -> volta
    ];
    const result = applyReminderState(items, states, TODAY);
    expect(result.map((i) => i.key)).toEqual(["debt:c"]);
  });

  it("isSnoozeExpired: hoje >= snoozeUntil retorna true", () => {
    expect(isSnoozeExpired({ key: "k", kind: "snoozed", snoozeUntil: "2026-08-09" }, "2026-08-12", TODAY)).toBe(true);
    expect(isSnoozeExpired({ key: "k", kind: "snoozed", snoozeUntil: TODAY }, "2026-08-12", TODAY)).toBe(true);
    expect(isSnoozeExpired({ key: "k", kind: "snoozed", snoozeUntil: "2026-08-15" }, "2026-08-19", TODAY)).toBe(false);
    expect(isSnoozeExpired({ key: "k", kind: "snoozed" }, "2026-08-12", TODAY)).toBe(false);
  });
});

describe("sortReminders (§3.10 — atrasados primeiro)", () => {
  it("ordena atrasados, hoje, em breve e informativos", () => {
    const sorted = sortReminders([
      { key: "debt:p", kind: "debt", title: "P", dueDate: "2026-08-01", amountCents: 1, status: "pending" },
      { key: "debt:x", kind: "debt", title: "X", dueDate: "2026-08-20", amountCents: 1, status: "due_soon" },
      { key: "debt:h", kind: "debt", title: "H", dueDate: "2026-08-10", amountCents: 1, status: "due_today" },
      { key: "debt:y", kind: "debt", title: "Y", dueDate: "2026-08-01", amountCents: 1, status: "overdue" },
      { key: "debt:z", kind: "debt", title: "Z", dueDate: "2026-07-20", amountCents: 1, status: "overdue" },
    ]);
    expect(sorted.map((i) => i.key)).toEqual(["debt:z", "debt:y", "debt:h", "debt:x", "debt:p"]);
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
        direction: "payable" as const,
        dueDate: "2026-08-01",
        amountCents: 50_000,
        paidAt: null,
      },
      {
        key: "debt:d2",
        title: "Dívida quitada",
        direction: "payable" as const,
        dueDate: "2026-08-05",
        amountCents: 50_000,
        paidAt: "2026-08-06",
      },
      {
        key: "debt:split1",
        title: "Racha: Pizza",
        direction: "receivable" as const,
        isSplitLinked: true,
        dueDate: "2026-08-01",
        amountCents: 5_000,
        paidAt: null,
      },
    ],
    preferences,
    today: TODAY,
  };

  it("consolida faturas e dívidas, exclui dívidas de racha, aplica estado e ordena", () => {
    const reminders = buildReminders(input, [{ key: "debt:d1", kind: "read" }]);
    expect(reminders.map((r) => r.key)).toEqual(["bill:c1:2026-08"]);
    expect(reminders[0]?.status).toBe("due_soon");
  });

  it("deriveReminderItems retorna todas as faturas e dívidas elegíveis sem filtro de estado (sem racha)", () => {
    const reminders = deriveReminderItems(input);
    expect(reminders.map((r) => r.key)).toEqual(["debt:d1", "bill:c1:2026-08"]);
  });

  it("preferência desabilitada → lista vazia", () => {
    expect(buildReminders({ ...input, preferences: { ...preferences, enabled: false } })).toEqual([]);
    expect(deriveReminderItems({ ...input, preferences: { ...preferences, enabled: false } })).toEqual([]);
  });
});
