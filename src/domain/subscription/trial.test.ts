import { describe, expect, it } from "vitest";
import {
  calculateTrialResidual,
  calculateGuaranteeResidual,
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

describe("Domain: calculateGuaranteeResidual", () => {
  const baseTime = new Date("2026-05-01T12:00:00Z");

  it("retorna isWithinGuarantee=false se o usuário não for Pro", () => {
    const result = calculateGuaranteeResidual({
      startsAt: baseTime,
      isPro: false,
      now: baseTime,
    });

    expect(result.isWithinGuarantee).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it("retorna isWithinGuarantee=true com 7 dias no momento exato da ativação", () => {
    const result = calculateGuaranteeResidual({
      startsAt: baseTime,
      isPro: true,
      now: baseTime,
    });

    expect(result.isWithinGuarantee).toBe(true);
    expect(result.daysRemaining).toBe(7);
  });

  it("retorna 4 dias restantes quando se passaram 3 dias desde a contratação", () => {
    const threeDaysLater = new Date("2026-05-04T12:00:00Z");
    const result = calculateGuaranteeResidual({
      startsAt: baseTime,
      isPro: true,
      now: threeDaysLater,
    });

    expect(result.isWithinGuarantee).toBe(true);
    expect(result.daysRemaining).toBe(4);
  });

  it("retorna 1 dia restante no 7º dia (últimas horas do prazo de arrependimento)", () => {
    const sixDaysLater = new Date("2026-05-07T12:00:00Z");
    const result = calculateGuaranteeResidual({
      startsAt: baseTime,
      isPro: true,
      now: sixDaysLater,
    });

    expect(result.isWithinGuarantee).toBe(true);
    expect(result.daysRemaining).toBe(1);
  });

  it("expira a garantia (isWithinGuarantee=false, 0 dias) após 7 dias corridos", () => {
    const eightDaysLater = new Date("2026-05-09T12:00:00Z");
    const result = calculateGuaranteeResidual({
      startsAt: baseTime,
      isPro: true,
      now: eightDaysLater,
    });

    expect(result.isWithinGuarantee).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });
});
