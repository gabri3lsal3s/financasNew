import { describe, expect, it } from "vitest";
import {
  calculateTrialResidual,
  calculateGuaranteeResidual,
  resolveCheckoutBillingSchedule,
  getTrialLifecycleStage,
  getTrialLifecycleMetadata,
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

describe("Domain: getTrialLifecycleStage e getTrialLifecycleMetadata", () => {
  it("classifica como welcome entre 21 e 30 dias de teste", () => {
    expect(getTrialLifecycleStage(30)).toBe("welcome");
    expect(getTrialLifecycleStage(21)).toBe("welcome");

    const meta = getTrialLifecycleMetadata(30);
    expect(meta.stage).toBe("welcome");
    expect(meta.badgeLabel).toBe("Teste Pro Ativo");
    expect(meta.ctaText).toBe("Conhecer Benefícios Pro");
  });

  it("classifica como awareness entre 8 e 20 dias de teste", () => {
    expect(getTrialLifecycleStage(20)).toBe("awareness");
    expect(getTrialLifecycleStage(8)).toBe("awareness");

    const meta = getTrialLifecycleMetadata(15);
    expect(meta.stage).toBe("awareness");
    expect(meta.badgeLabel).toBe("15d restantes");
    expect(meta.title).toContain("15 dias de acesso");
    expect(meta.ctaText).toContain("40% OFF");
  });

  it("classifica como warning entre 3 e 7 dias de teste", () => {
    expect(getTrialLifecycleStage(7)).toBe("warning");
    expect(getTrialLifecycleStage(3)).toBe("warning");

    const meta = getTrialLifecycleMetadata(5);
    expect(meta.stage).toBe("warning");
    expect(meta.badgeVariant).toBe("warning");
    expect(meta.title).toContain("5 dias");
    expect(meta.description).toContain("nunca são apagados");
  });

  it("classifica como imminent para 1 ou 2 dias de teste", () => {
    expect(getTrialLifecycleStage(2)).toBe("imminent");
    expect(getTrialLifecycleStage(1)).toBe("imminent");

    const meta2 = getTrialLifecycleMetadata(2);
    expect(meta2.stage).toBe("imminent");
    expect(meta2.badgeLabel).toBe("Últimas 48 horas");

    const meta1 = getTrialLifecycleMetadata(1);
    expect(meta1.stage).toBe("imminent");
    expect(meta1.badgeLabel).toBe("Último dia");
    expect(meta1.title).toBe("Seu período de teste Pro encerra hoje");
  });

  it("classifica como expired para 0 ou menos dias", () => {
    expect(getTrialLifecycleStage(0)).toBe("expired");
    expect(getTrialLifecycleStage(-1)).toBe("expired");

    const meta = getTrialLifecycleMetadata(0);
    expect(meta.stage).toBe("expired");
    expect(meta.badgeLabel).toBe("Modo Consulta");
    expect(meta.ctaText).toBe("Reativar Plano Pro");
  });
});

