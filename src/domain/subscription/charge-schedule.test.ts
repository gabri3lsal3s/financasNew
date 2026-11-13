import { describe, it, expect } from "vitest";
import { resolveChargeSchedule } from "./charge-schedule";

describe("charge-schedule (Cronograma de Cobrança e Bloqueio de Pix)", () => {
  const baseNow = new Date("2026-11-12T12:00:00.000Z");
  const futureTrialEnds = new Date("2026-11-22T12:00:00.000Z"); // 10 dias restantes

  it("adia a cobrança para o término do trial e bloqueia Pix durante trial ativo", () => {
    const schedule = resolveChargeSchedule({
      plan: "annual",
      phase: "trial_active",
      trialEndsAt: futureTrialEnds,
      now: baseNow,
    });

    expect(schedule.chargeTodayCents).toBe(0);
    expect(schedule.isDelayedByTrial).toBe(true);
    expect(schedule.daysUntilFirstCharge).toBe(10);
    expect(schedule.firstBillingDate.toISOString()).toBe(futureTrialEnds.toISOString());
    expect(schedule.canUsePixToday).toBe(false);
    expect(schedule.pixBlockedReason).toContain("não há valor a pagar hoje");
  });

  it("cobra hoje imediatamente para trial expirado e permite Pix anual", () => {
    const pastTrialEnds = new Date("2026-11-10T12:00:00.000Z");
    const schedule = resolveChargeSchedule({
      plan: "annual",
      phase: "trial_expired",
      trialEndsAt: pastTrialEnds,
      now: baseNow,
    });

    expect(schedule.chargeTodayCents).toBe(14388); // R$ 143,88
    expect(schedule.isDelayedByTrial).toBe(false);
    expect(schedule.daysUntilFirstCharge).toBe(0);
    expect(schedule.canUsePixToday).toBe(true);
  });

  it("cobra hoje para past_due e bloqueia Pix para plano mensal", () => {
    const schedule = resolveChargeSchedule({
      plan: "monthly",
      phase: "past_due",
      now: baseNow,
    });

    expect(schedule.chargeTodayCents).toBe(1999); // R$ 19,99
    expect(schedule.isDelayedByTrial).toBe(false);
    expect(schedule.canUsePixToday).toBe(false);
  });
});
