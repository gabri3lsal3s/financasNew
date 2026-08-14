import { describe, expect, it } from "vitest";
import { addDaysISO, debtStatus, todayISO } from "./index";

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
