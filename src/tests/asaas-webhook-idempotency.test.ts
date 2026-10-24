import { describe, expect, it } from "vitest";
import {
  computeNextPeriodEnd,
  decideWebhookAction,
  type UserSubscriptionSnapshot,
} from "../../supabase/functions/_shared/asaas-webhook-logic.ts";

describe("Webhook Asaas — Lógica de Decisão e Idempotência", () => {
  const baseTrialSub: UserSubscriptionSnapshot = {
    id: "sub-uuid-123",
    user_id: "user-uuid-abc",
    tier: "trial",
    plan_id: "trial",
    status: "trialing",
    asaas_payment_id: "pay_pix_999",
    asaas_customer_id: "cus_001",
    cancel_at_period_end: false,
    current_period_end: null,
  };

  it("calcula nextPeriodEnd para plano anual (+1 ano)", () => {
    const fixedNow = new Date("2026-10-24T12:00:00Z");
    const endIso = computeNextPeriodEnd("pro_annual", fixedNow);
    const end = new Date(endIso);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(9); // Outubro
    expect(end.getDate()).toBe(24);
  });

  it("calcula nextPeriodEnd para plano mensal (+1 mês)", () => {
    const fixedNow = new Date("2026-10-24T12:00:00Z");
    const endIso = computeNextPeriodEnd("pro_monthly", fixedNow);
    const end = new Date(endIso);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(10); // Novembro
    expect(end.getDate()).toBe(24);
  });

  it("ativa plano anual no primeiro recebimento de PAYMENT_RECEIVED via Pix", () => {
    const decision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_pix_999",
        billingType: "PIX",
        value: 178.8,
      },
      currentSub: baseTrialSub,
    });

    expect(decision.action).toBe("activate");
    if (decision.action === "activate") {
      expect(decision.targetTier).toBe("pro_annual");
      expect(decision.currentPeriodEnd).toBeDefined();
    }
  });

  it("descarta com 'already_active' quando evento PAYMENT_CONFIRMED chegar após PAYMENT_RECEIVED para a mesma cobrança (idempotência)", () => {
    const alreadyActiveSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_annual",
      plan_id: "pro_annual",
      asaas_payment_id: "pay_pix_999",
      current_period_end: "2027-10-24T12:00:00.000Z",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_pix_999",
        billingType: "PIX",
        value: 178.8,
      },
      currentSub: alreadyActiveSub,
    });

    expect(decision.action).toBe("ignore_duplicate");
    if (decision.action === "ignore_duplicate") {
      expect(decision.reason).toBe("already_active");
    }
  });

  it("descarta com 'already_active' quando o mesmo evento PAYMENT_RECEIVED for reenviado por retry de rede", () => {
    const alreadyActiveSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_annual",
      plan_id: "pro_annual",
      asaas_payment_id: "pay_pix_999",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_pix_999",
        billingType: "PIX",
        value: 178.8,
      },
      currentSub: alreadyActiveSub,
    });

    expect(decision.action).toBe("ignore_duplicate");
  });

  it("reconhece idempotência para assinaturas de cartão de crédito via subscriptionId", () => {
    const activeCardSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      plan_id: "pro_monthly",
      asaas_subscription_id: "sub_card_777",
      asaas_payment_id: "pay_first_invoice",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_second_invoice",
        subscription: "sub_card_777",
        billingType: "CREDIT_CARD",
        value: 19.9,
      },
      currentSub: activeCardSub,
    });

    expect(decision.action).toBe("ignore_duplicate");
    if (decision.action === "ignore_duplicate") {
      expect(decision.reason).toBe("already_active");
    }
  });

  it("rejeita com 'ignore_unknown_plan' quando o valor não corresponder a nenhum plano oficial", () => {
    const decision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_weird_123",
        billingType: "CREDIT_CARD",
        value: 55.0,
      },
      currentSub: baseTrialSub,
    });

    expect(decision.action).toBe("ignore_unknown_plan");
  });

  it("transiciona status para 'past_due' em PAYMENT_OVERDUE", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: { id: "pay_123" },
      currentSub: activeSub,
    });

    expect(decision.action).toBe("mark_past_due");
  });

  it("descarta repetido PAYMENT_OVERDUE se a assinatura já estiver past_due (idempotência)", () => {
    const pastDueSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "past_due",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: { id: "pay_123" },
      currentSub: pastDueSub,
    });

    expect(decision.action).toBe("ignore_duplicate");
    if (decision.action === "ignore_duplicate") {
      expect(decision.reason).toBe("already_past_due");
    }
  });

  it("marca cancelamento ao final do período em SUBSCRIPTION_DELETED", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      cancel_at_period_end: false,
    };

    const decision = decideWebhookAction({
      eventType: "SUBSCRIPTION_DELETED",
      payment: { id: "pay_123" },
      currentSub: activeSub,
    });

    expect(decision.action).toBe("mark_cancelled");
  });

  it("descarta repetido SUBSCRIPTION_DELETED se já cancelado ao final do período (idempotência)", () => {
    const cancelledSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      cancel_at_period_end: true,
    };

    const decision = decideWebhookAction({
      eventType: "SUBSCRIPTION_DELETED",
      payment: { id: "pay_123" },
      currentSub: cancelledSub,
    });

    expect(decision.action).toBe("ignore_duplicate");
    if (decision.action === "ignore_duplicate") {
      expect(decision.reason).toBe("already_cancelled");
    }
  });

  it("retorna 'unsupported_event' para eventos não mapeados", () => {
    const decision = decideWebhookAction({
      eventType: "UNKNOWN_CUSTOM_EVENT",
      payment: { id: "pay_123" },
      currentSub: baseTrialSub,
    });

    expect(decision.action).toBe("unsupported_event");
  });
});
