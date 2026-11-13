import { describe, it, expect } from "vitest";
import { resolveBillingPhase, canPhaseWrite } from "./billing-phase";

describe("resolveBillingPhase (Máquina de Estados de Faturamento)", () => {
  const baseNow = new Date("2026-11-12T12:00:00.000Z");

  it("resolve 'lifetime' para contas vitalícias ativas", () => {
    const phase = resolveBillingPhase({
      tier: "lifetime",
      status: "active",
      now: baseNow,
    });
    expect(phase).toBe("lifetime");
    expect(canPhaseWrite(phase)).toBe(true);
  });

  it("resolve 'trial_active' para trial em andamento sem cobrança futura agendada", () => {
    const phase = resolveBillingPhase({
      tier: "trial",
      status: "trialing",
      trialEndsAt: new Date("2026-11-20T12:00:00.000Z"),
      now: baseNow,
    });
    expect(phase).toBe("trial_active");
    expect(canPhaseWrite(phase)).toBe(true);
  });

  it("resolve 'trial_scheduled' quando há primeira cobrança agendada no cartão", () => {
    const phase = resolveBillingPhase({
      tier: "trial",
      status: "trialing",
      trialEndsAt: new Date("2026-11-20T12:00:00.000Z"),
      scheduledPlanId: "pro_monthly",
      scheduledFirstChargeAt: new Date("2026-11-20T12:00:00.000Z"),
      now: baseNow,
    });
    expect(phase).toBe("trial_scheduled");
    expect(canPhaseWrite(phase)).toBe(true);
  });

  it("resolve 'trial_expired' quando o trial já encerrou", () => {
    const phase = resolveBillingPhase({
      tier: "trial",
      status: "trialing",
      trialEndsAt: new Date("2026-11-10T12:00:00.000Z"),
      now: baseNow,
    });
    expect(phase).toBe("trial_expired");
    expect(canPhaseWrite(phase)).toBe(false);
  });

  it("resolve 'active' para assinante Pro com período vigente válido", () => {
    const phase = resolveBillingPhase({
      tier: "pro_monthly",
      status: "active",
      currentPeriodEnd: new Date("2026-12-12T12:00:00.000Z"),
      now: baseNow,
    });
    expect(phase).toBe("active");
    expect(canPhaseWrite(phase)).toBe(true);
  });

  it("resolve 'canceled_until_period_end' quando cancelou mas ainda tem dias pagos", () => {
    const phase = resolveBillingPhase({
      tier: "pro_annual",
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2026-12-12T12:00:00.000Z"),
      now: baseNow,
    });
    expect(phase).toBe("canceled_until_period_end");
    expect(canPhaseWrite(phase)).toBe(true);
  });

  it("resolve 'past_due' para assinante com falha de renovação no grace period", () => {
    const phase = resolveBillingPhase({
      tier: "pro_monthly",
      status: "past_due",
      currentPeriodEnd: new Date("2026-11-11T12:00:00.000Z"),
      now: baseNow,
    });
    expect(phase).toBe("past_due");
    expect(canPhaseWrite(phase)).toBe(true);
  });

  it("resolve 'read_only' quando período pago já expirou", () => {
    const phase = resolveBillingPhase({
      tier: "pro_monthly",
      status: "active",
      currentPeriodEnd: new Date("2026-11-05T12:00:00.000Z"),
      now: baseNow,
    });
    expect(phase).toBe("read_only");
    expect(canPhaseWrite(phase)).toBe(false);
  });
});
