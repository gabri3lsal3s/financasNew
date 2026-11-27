import { describe, expect, it } from "vitest";
import { evaluateGoalProgress } from "./goal-progress";

describe("evaluateGoalProgress (Fase 2A)", () => {
  it("não marca 9.999 de 10.000 centavos como concluída nem como 100%", () => {
    const res = evaluateGoalProgress({
      currentCents: 9999,
      targetCents: 10000,
      deadline: "2026-12-31",
      asOfDate: "2026-11-27",
    });

    expect(res.isCompleted).toBe(false);
    expect(res.displayPct).toBe(99);
    expect(res.remainingCents).toBe(1);
    expect(res.isFinalStretch).toBe(true);
  });

  it("calcula dias civis e ritmo diário necessário considerando ano bissexto", () => {
    const res = evaluateGoalProgress({
      currentCents: 0,
      targetCents: 30000,
      deadline: "2028-03-01",
      asOfDate: "2028-02-28",
    });

    // 2028 é bissexto (29/02 existe): 28/02 -> 01/03 = 2 dias
    expect(res.remainingDays).toBe(2);
    expect(res.requiredDailyCents).toBe(15000);
    expect(res.deadlineStatus).toBe("on_schedule");
  });

  it("identifica hoje, vencida e sem prazo corretamente", () => {
    expect(
      evaluateGoalProgress({
        currentCents: 5000,
        targetCents: 10000,
        deadline: "2026-11-27",
        asOfDate: "2026-11-27",
      }).deadlineStatus,
    ).toBe("due_today");

    expect(
      evaluateGoalProgress({
        currentCents: 5000,
        targetCents: 10000,
        deadline: "2026-11-20",
        asOfDate: "2026-11-27",
      }).deadlineStatus,
    ).toBe("overdue");

    expect(
      evaluateGoalProgress({
        currentCents: 5000,
        targetCents: 10000,
        deadline: null,
        asOfDate: "2026-11-27",
      }).deadlineStatus,
    ).toBe("no_deadline");
  });
});
