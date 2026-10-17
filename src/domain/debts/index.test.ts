import { describe, expect, it } from "vitest";
import { addDaysISO, calculateDebtsSummary, debtStatus, todayISO } from "./index";


const TODAY = "2026-08-13";

describe("debtStatus (§3.4 — status derivado, nunca armazenado)", () => {
  it("quitada quando paid_at presente, independente do vencimento", () => {
    expect(debtStatus("2020-01-01", "2026-08-01", TODAY)).toBe("paid");
    expect(debtStatus("2026-08-13", "2026-08-13", TODAY)).toBe("paid");
  });

  it("vencida quando vencimento anterior a hoje", () => {
    expect(debtStatus("2026-08-12", null, TODAY)).toBe("overdue");
  });

  it("vence hoje", () => {
    expect(debtStatus("2026-08-13", null, TODAY)).toBe("due_today");
  });

  it("vence em breve (janela de 3 dias)", () => {
    expect(debtStatus("2026-08-14", null, TODAY)).toBe("due_soon");
    expect(debtStatus("2026-08-16", null, TODAY)).toBe("due_soon");
    expect(debtStatus(addDaysISO(TODAY, 3), null, TODAY)).toBe("due_soon");
  });

  it("pendente além da janela", () => {
    expect(debtStatus("2026-08-17", null, TODAY)).toBe("pending");
    expect(debtStatus(addDaysISO(TODAY, 4), null, TODAY)).toBe("pending");
  });

  it("produz uma referência de hoje válida", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("calculateDebtsSummary", () => {
  it("returns zeros for empty debt list", () => {
    const result = calculateDebtsSummary([]);
    expect(result).toEqual({
      payablePendingCents: 0,
      receivablePendingCents: 0,
      netPendingCents: 0,
      paidCount: 0,
      pendingCount: 0,
    });
  });

  it("calculates pending payable and receivable debts in cents", () => {
    const debts = [
      { type: "payable" as const, amount: 150.5, paid_at: null },
      { type: "payable" as const, amount: 50, paid_at: "2026-08-10" }, // paid, ignored in pending
      { type: "receivable" as const, amount: 300, paid_at: null },
      { type: "receivable" as const, amount: 100, paid_at: "2026-08-01" }, // paid, ignored in pending
    ];

    const result = calculateDebtsSummary(debts);
    expect(result.payablePendingCents).toBe(15050);
    expect(result.receivablePendingCents).toBe(30000);
    expect(result.netPendingCents).toBe(14950);
    expect(result.paidCount).toBe(2);
    expect(result.pendingCount).toBe(2);
  });

  it("respects beforeDueDateExclusive option", () => {
    const debts = [
      { type: "payable" as const, amount: 100, paid_at: null, due_date: "2026-08-15" },
      { type: "payable" as const, amount: 200, paid_at: null, due_date: "2026-09-01" },
    ];

    const result = calculateDebtsSummary(debts, { beforeDueDateExclusive: "2026-09-01" });
    expect(result.payablePendingCents).toBe(10000);
    expect(result.pendingCount).toBe(1);
  });
});

