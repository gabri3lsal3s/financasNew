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
        value: 143.88,
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
        value: 143.88,
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
        value: 143.88,
      },
      currentSub: alreadyActiveSub,
    });

    expect(decision.action).toBe("ignore_duplicate");
  });

  it("reconhece idempotência para pagamentos repetidos da mesma fatura de cartão", () => {
    const activeCardSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      plan_id: "pro_monthly",
      asaas_subscription_id: "sub_card_777",
      asaas_payment_id: "pay_first_invoice",
    };

    const duplicateDecision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_first_invoice",
        subscription: "sub_card_777",
        billingType: "CREDIT_CARD",
        value: 19.99,
      },
      currentSub: activeCardSub,
    });

    expect(duplicateDecision.action).toBe("ignore_duplicate");
    if (duplicateDecision.action === "ignore_duplicate") {
      expect(duplicateDecision.reason).toBe("already_active");
    }
  });

  it("permite renovação do segundo mês quando nova fatura recorrente chega da mesma assinatura (F-01)", () => {
    const activeCardSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      plan_id: "pro_monthly",
      asaas_subscription_id: "sub_card_777",
      asaas_payment_id: "pay_first_invoice",
      current_period_end: "2026-11-24T12:00:00.000Z",
    };

    const renewalDecision = decideWebhookAction({
      eventType: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_second_invoice",
        subscription: "sub_card_777",
        billingType: "CREDIT_CARD",
        value: 19.99,
        confirmedDate: "2026-11-24T10:00:00.000Z",
      },
      currentSub: activeCardSub,
      now: new Date("2026-11-24T10:00:00.000Z"),
    });

    expect(renewalDecision.action).toBe("activate");
    if (renewalDecision.action === "activate") {
      expect(renewalDecision.targetTier).toBe("pro_monthly");
      // Deve avançar 1 mês a partir da data de vencimento anterior
      const nextEnd = new Date(renewalDecision.currentPeriodEnd);
      expect(nextEnd.getFullYear()).toBe(2026);
      expect(nextEnd.getMonth()).toBe(11); // Dezembro
      expect(nextEnd.getDate()).toBe(24);
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

  it("transiciona status para 'past_due' em PAYMENT_OVERDUE vinculado à assinatura recorrente ativa", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      asaas_subscription_id: "sub_rec_123",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: { id: "pay_123", billingType: "CREDIT_CARD", subscription: "sub_rec_123" },
      currentSub: activeSub,
    });

    expect(decision.action).toBe("mark_past_due");
  });

  it("ignora PAYMENT_OVERDUE de PIX avulso ou cobrança sem vínculo com a assinatura recorrente ativa (B-06)", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      asaas_subscription_id: "sub_rec_123",
    };

    const pixOverdue = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: { id: "pay_pix_avulso", billingType: "PIX" },
      currentSub: activeSub,
    });
    expect(pixOverdue.action).toBe("ignore_unrelated_payment");

    const mismatchOverdue = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: { id: "pay_old_sub", billingType: "CREDIT_CARD", subscription: "sub_old_999" },
      currentSub: activeSub,
    });
    expect(mismatchOverdue.action).toBe("ignore_unrelated_payment");
  });

  it("descarta repetido PAYMENT_OVERDUE se a assinatura já estiver past_due (idempotência)", () => {
    const pastDueSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "past_due",
      asaas_subscription_id: "sub_rec_123",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: { id: "pay_123", billingType: "CREDIT_CARD", subscription: "sub_rec_123" },
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

  it("retorna 'mark_refunded' ao receber PAYMENT_REFUNDED para revogar Pro imediatamente", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_annual",
      cancel_at_period_end: false,
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_REFUNDED",
      payment: { id: "pay_pix_999" },
      currentSub: activeSub,
    });

    expect(decision.action).toBe("mark_refunded");
  });

  it("descarta repetido PAYMENT_REFUNDED se o usuário já estiver com status canceled e tier read_only", () => {
    const refundedSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "canceled",
      tier: "read_only",
      cancel_at_period_end: false,
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_REFUNDED",
      payment: { id: "pay_123" },
      currentSub: refundedSub,
    });

    expect(decision.action).toBe("ignore_duplicate");
    if (decision.action === "ignore_duplicate") {
      expect(decision.reason).toBe("already_refunded");
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

  it("processa SUBSCRIPTION_DELETED e SUBSCRIPTION_UPDATED com payload subscription sem payment (B-03 / D-16)", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      asaas_subscription_id: "sub_rec_123",
      cancel_at_period_end: false,
    };

    const deletedDecision = decideWebhookAction({
      eventType: "SUBSCRIPTION_DELETED",
      payment: null,
      subscription: { id: "sub_rec_123", status: "INACTIVE" },
      currentSub: activeSub,
    });
    expect(deletedDecision.action).toBe("mark_cancelled");

    const updatedDecision = decideWebhookAction({
      eventType: "SUBSCRIPTION_UPDATED",
      payment: null,
      subscription: { id: "sub_rec_123", status: "ACTIVE", nextDueDate: "2026-12-24" },
      currentSub: activeSub,
    });
    expect(updatedDecision.action).toBe("sync_subscription_updated");
  });

  it("trata PAYMENT_CHARGEBACK_REQUESTED com mark_chargeback e deduplica se já sinalizado (D-06)", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      asaas_subscription_id: "sub_rec_123",
    };

    const cbDecision = decideWebhookAction({
      eventType: "PAYMENT_CHARGEBACK_REQUESTED",
      payment: { id: "pay_cb_1", subscription: "sub_rec_123" },
      currentSub: activeSub,
    });
    expect(cbDecision.action).toBe("mark_chargeback");

    const dupCb = decideWebhookAction({
      eventType: "PAYMENT_CHARGEBACK_REQUESTED",
      payment: { id: "pay_cb_1", subscription: "sub_rec_123" },
      currentSub: {
        ...activeSub,
        tier: "read_only",
        status: "canceled",
        chargeback_flagged_at: "2026-11-24T12:00:00.000Z",
      },
    });
    expect(dupCb.action).toBe("ignore_duplicate");
  });

  it("trata disputas de chargeback, estorno parcial, dunning e estorno de antecipação acumulativa (D-16)", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      current_period_end: "2027-04-24T12:00:00.000Z",
    };

    expect(
      decideWebhookAction({
        eventType: "PAYMENT_CHARGEBACK_DISPUTE",
        payment: { id: "pay_1" },
        currentSub: activeSub,
      }).action,
    ).toBe("record_chargeback_dispute");

    expect(
      decideWebhookAction({
        eventType: "PAYMENT_PARTIALLY_REFUNDED",
        payment: { id: "pay_1", value: 10 },
        currentSub: activeSub,
      }).action,
    ).toBe("record_partial_refund");

    expect(
      decideWebhookAction({
        eventType: "PAYMENT_DUNNING_RECEIVED",
        payment: { id: "pay_dunning_1", billingType: "CREDIT_CARD", value: 19.99 },
        currentSub: { ...activeSub, status: "past_due" },
        now,
      }).action,
    ).toBe("activate");

    const cumRefund = decideWebhookAction({
      eventType: "PAYMENT_REFUNDED",
      payment: { id: "pay_cum_1", billingType: "PIX", value: 53.97 },
      currentSub: activeSub,
      intent: {
        id: "intent_cum_1",
        user_id: activeSub.user_id,
        kind: "cumulative_renewal",
        months_count: 3,
        amount_cents: 5397,
        status: "paid",
      },
      processedPaymentKind: "cumulative_renewal",
      now,
    });
    expect(cumRefund.action).toBe("refund_cumulative_renewal");
    if (cumRefund.action === "refund_cumulative_renewal") {
      expect(cumRefund.monthsCount).toBe(3);
      expect(cumRefund.newPeriodEnd).toBe("2027-01-24T12:00:00.000Z");
    }
  });

  it("ancora referenceDate date-only (YYYY-MM-DD) no fim do dia BRT para evitar corte de 1 dia (D-16)", () => {
    const decision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_dateonly",
        billingType: "PIX",
        value: 143.88,
        confirmedDate: "2026-11-24",
      },
      currentSub: baseTrialSub,
      now: new Date("2026-11-24T22:00:00-03:00"),
    });

    expect(decision.action).toBe("activate");
    if (decision.action === "activate") {
      // 2026-11-24T23:59:59-03:00 = 2026-11-25T02:59:59Z -> +12 meses = 2027-11-25T02:59:59Z (24/11/2027 23:59 BRT)
      expect(decision.currentPeriodEnd.slice(0, 10)).toBe("2027-11-25");
    }
  });

  it("não revoga acesso ativo quando PAYMENT_REFUNDED refere-se a um paymentId antigo diferente do vigente (M-02)", () => {
    const activeSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "active",
      tier: "pro_monthly",
      asaas_payment_id: "pay_atual_999",
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_REFUNDED",
      payment: { id: "pay_antigo_111", billingType: "CREDIT_CARD", value: 19.99 },
      currentSub: activeSub,
    });

    expect(decision).toEqual({
      action: "ignore_unrelated_payment",
      reason: "refund_for_non_current_payment",
    });
  });

  it("transiciona assinatura trialing agendada para past_due quando 1ª cobrança após trial falha (PAYMENT_OVERDUE)", () => {
    const trialingScheduledSub: UserSubscriptionSnapshot = {
      ...baseTrialSub,
      status: "trialing",
      tier: "trial",
      asaas_subscription_id: "sub_trial_sched_1",
    };

    const matched = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: {
        id: "pay_first_failed",
        billingType: "CREDIT_CARD",
        subscription: "sub_trial_sched_1",
      },
      currentSub: trialingScheduledSub,
    });
    expect(matched.action).toBe("mark_past_due");

    const unscheduledTrial = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: {
        id: "pay_other",
        billingType: "CREDIT_CARD",
        subscription: "sub_trial_sched_1",
      },
      currentSub: { ...baseTrialSub, status: "trialing", asaas_subscription_id: null },
    });
    expect(unscheduledTrial.action).toBe("ignore_unrelated_payment");
  });

  it("sinaliza para revisão manual (flag_canceled_intent_paid) quando pagamento PIX chega para intent cancelada ou expirada", () => {
    const canceledCumulativeDecision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_pix_canceled_1",
        billingType: "PIX",
        value: 37.98,
      },
      currentSub: {
        ...baseTrialSub,
        tier: "pro_monthly",
        status: "active",
      },
      intent: {
        id: "intent-canceled-1",
        user_id: baseTrialSub.user_id,
        kind: "cumulative_renewal",
        months_count: 2,
        amount_cents: 3798,
        status: "canceled",
      },
    });
    expect(canceledCumulativeDecision).toEqual({
      action: "flag_canceled_intent_paid",
      intentId: "intent-canceled-1",
      intentKind: "cumulative_renewal",
      intentStatus: "canceled",
    });

    const expiredAnnualDecision = decideWebhookAction({
      eventType: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_pix_expired_2",
        billingType: "PIX",
        value: 143.88,
      },
      currentSub: {
        ...baseTrialSub,
        tier: "pro_monthly",
        status: "active",
      },
      intent: {
        id: "intent-expired-2",
        user_id: baseTrialSub.user_id,
        kind: "plan_change",
        plan_id: "pro_annual",
        amount_cents: 14388,
        status: "expired",
      },
    });
    expect(expiredAnnualDecision).toEqual({
      action: "flag_canceled_intent_paid",
      intentId: "intent-expired-2",
      intentKind: "plan_change",
      intentStatus: "expired",
    });
  });
});
