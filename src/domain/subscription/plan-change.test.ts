import { describe, it, expect } from "vitest";
import { schedulePlanChange, canCancelPlanChange } from "./plan-change";

describe("plan-change (Troca de Plano Mensal <-> Anual)", () => {
  const baseNow = new Date("2026-11-12T12:00:00.000Z");
  const futurePeriodEnd = new Date("2026-12-12T12:00:00.000Z");

  it("agenda troca de Mensal para Anual com efeito na próxima renovação", () => {
    const result = schedulePlanChange({
      currentPlan: "monthly",
      targetPlan: "annual",
      currentPeriodEnd: futurePeriodEnd,
      now: baseNow,
    });

    expect(result.canSchedule).toBe(true);
    expect(result.fromPlan).toBe("monthly");
    expect(result.toPlan).toBe("annual");
    expect(result.effectiveAt?.toISOString()).toBe(futurePeriodEnd.toISOString());
  });

  it("agenda troca de Anual para Mensal com efeito na próxima renovação", () => {
    const result = schedulePlanChange({
      currentPlan: "annual",
      targetPlan: "monthly",
      currentPeriodEnd: futurePeriodEnd,
      now: baseNow,
    });

    expect(result.canSchedule).toBe(true);
    expect(result.fromPlan).toBe("annual");
    expect(result.toPlan).toBe("monthly");
    expect(result.effectiveAt?.toISOString()).toBe(futurePeriodEnd.toISOString());
  });

  it("rejeita agendamento quando o plano de destino é igual ao atual", () => {
    const result = schedulePlanChange({
      currentPlan: "monthly",
      targetPlan: "monthly",
      currentPeriodEnd: futurePeriodEnd,
      now: baseNow,
    });

    expect(result.canSchedule).toBe(false);
    expect(result.reason).toContain("idêntico");
  });

  it("rejeita agendamento quando o período atual já expirou", () => {
    const pastPeriodEnd = new Date("2026-11-10T12:00:00.000Z");
    const result = schedulePlanChange({
      currentPlan: "monthly",
      targetPlan: "annual",
      currentPeriodEnd: pastPeriodEnd,
      now: baseNow,
    });

    expect(result.canSchedule).toBe(false);
    expect(result.reason).toContain("expirou");
  });

  it("avalia permissão de cancelamento da mudança agendada", () => {
    expect(canCancelPlanChange(futurePeriodEnd, baseNow)).toBe(true);
    expect(canCancelPlanChange(new Date("2026-11-10T12:00:00.000Z"), baseNow)).toBe(false);
    expect(canCancelPlanChange(null, baseNow)).toBe(false);
  });
});
