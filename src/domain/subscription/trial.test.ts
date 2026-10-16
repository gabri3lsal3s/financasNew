import { describe, expect, it } from "vitest";
import {
  calculateTrialResidual,
  resolveCheckoutBillingSchedule,
  STANDARD_TRIAL_DAYS,
  PLAN_PRICES_CENTS,
} from "./trial";

describe("Domain: calculateTrialResidual", () => {
  const baseTime = new Date("2026-05-01T12:00:00Z");

  it("calcula 30 dias para usuário recém-criado sem trialEndsAt explícito", () => {
    const result = calculateTrialResidual({
      createdAt: baseTime,
      now: baseTime,
    });

    expect(result.daysRemaining).toBe(STANDARD_TRIAL_DAYS);
    expect(result.isExpired).toBe(false);
  });

  it("calcula 20 dias restantes quando o usuário já usou 10 dias", () => {
    const tenDaysLater = new Date("2026-05-11T12:00:00Z");
    const result = calculateTrialResidual({
      createdAt: baseTime,
      now: tenDaysLater,
    });

    expect(result.daysRemaining).toBe(20);
    expect(result.isExpired).toBe(false);
  });

  it("marca como expirado (0 dias) após os 30 dias", () => {
    const thirtyOneDaysLater = new Date("2026-06-02T12:00:00Z");
    const result = calculateTrialResidual({
      createdAt: baseTime,
      now: thirtyOneDaysLater,
    });

    expect(result.daysRemaining).toBe(0);
    expect(result.isExpired).toBe(true);
  });
});

describe("Domain: resolveCheckoutBillingSchedule", () => {
  const baseTime = new Date("2026-05-01T12:00:00Z");

  it("agenda primeira cobrança em 30 dias para visitante novo (sem histórico)", () => {
    const schedule = resolveCheckoutBillingSchedule({
      plan: "annual",
      trialDaysRemaining: 30,
      now: baseTime,
    });

    expect(schedule.chargeTodayCents).toBe(0);
    expect(schedule.isDelayedByTrial).toBe(true);
    expect(schedule.daysUntilFirstCharge).toBe(30);
  });

  it("agenda primeira cobrança em 15 dias quando restam 15 dias de trial", () => {
    const schedule = resolveCheckoutBillingSchedule({
      plan: "monthly",
      trialDaysRemaining: 15,
      now: baseTime,
    });

    expect(schedule.chargeTodayCents).toBe(0);
    expect(schedule.isDelayedByTrial).toBe(true);
    expect(schedule.daysUntilFirstCharge).toBe(15);
  });

  it("cobra valor integral hoje quando o trial já expirou (0 dias restantes)", () => {
    const schedule = resolveCheckoutBillingSchedule({
      plan: "annual",
      trialDaysRemaining: 0,
      now: baseTime,
    });

    expect(schedule.chargeTodayCents).toBe(PLAN_PRICES_CENTS.annual);
    expect(schedule.isDelayedByTrial).toBe(false);
    expect(schedule.daysUntilFirstCharge).toBe(0);
  });

  it("cobra valor integral hoje se o usuário é assinante ativo reativando/trocando plano", () => {
    const schedule = resolveCheckoutBillingSchedule({
      plan: "monthly",
      currentTier: "pro_monthly",
      trialDaysRemaining: 20, // ignora trial residual pois já é assinante pagante
      now: baseTime,
    });

    expect(schedule.chargeTodayCents).toBe(PLAN_PRICES_CENTS.monthly);
    expect(schedule.isDelayedByTrial).toBe(false);
    expect(schedule.daysUntilFirstCharge).toBe(0);
  });
});
