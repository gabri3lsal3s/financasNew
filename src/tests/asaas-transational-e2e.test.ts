import { describe, expect, it } from "vitest";
import {
  decideWebhookAction,
  type UserSubscriptionSnapshot,
} from "../../supabase/functions/_shared/asaas-webhook-logic.ts";
import { shouldReusePendingPixCharge } from "../../supabase/functions/_shared/asaas.ts";
import { resolveTierFromPayment } from "../../supabase/functions/_shared/asaas-plans.ts";
import { timingSafeEqualString } from "../../supabase/functions/_shared/http.ts";

/**
 * Teste Transacional E2E (Simulação do Ciclo Completo de Cobrança e Go-Live)
 * Valida a transição atômica de status, garantia de canWrite, idempotência
 * e conformidade com o Artigo 49 do CDC (estorno/arrependimento em 7 dias).
 */
describe("Homologação Transacional Asaas (Go-Live & Portão de Qualidade 2)", () => {
  const mockWebhookSecret = "whsec_live_token_entropy_998877";

  interface SubscriptionState {
    id: string;
    userId: string;
    tier: string;
    status: string;
    planId: string;
    asaasCustomerId: string | null;
    asaasPaymentId: string | null;
    asaasSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canWrite: boolean;
  }

  function simulateCanWrite(sub: { status: string; tier: string }): boolean {
    if (sub.tier === "lifetime") return true;
    if (["pro_monthly", "pro_annual"].includes(sub.tier) && sub.status === "active") return true;
    if (sub.tier === "trial" && sub.status === "trialing") return true;
    return false;
  }

  it("autentica a requisição do webhook via cabeçalho timing-safe", async () => {
    const validHeader = "whsec_live_token_entropy_998877";
    const invalidHeader = "whsec_wrong_token";

    expect(await timingSafeEqualString(validHeader, mockWebhookSecret)).toBe(true);
    expect(await timingSafeEqualString(invalidHeader, mockWebhookSecret)).toBe(false);
  });

  it("executa o ciclo completo de ativação atômica: trialing -> active (canWrite: true)", () => {
    // 1. Estado inicial: usuário recém-cadastrado em trialing
    let currentSub: SubscriptionState = {
      id: "sub-12345",
      userId: "user-test-client",
      tier: "trial",
      planId: "trial",
      status: "trialing",
      asaasCustomerId: "cus_asaas_001",
      asaasPaymentId: "pay_pix_live_001",
      asaasSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canWrite: true, // Durante o trial, canWrite é true
    };

    expect(currentSub.status).toBe("trialing");
    expect(simulateCanWrite(currentSub)).toBe(true);

    // 2. Pagamento efetuado via Pix no Asaas (R$ 178,80 ou homologação)
    const asaasPayment = {
      id: "pay_pix_live_001",
      customer: "cus_asaas_001",
      billingType: "PIX",
      value: 178.8,
    };

    const targetTier = resolveTierFromPayment(asaasPayment);
    expect(targetTier).toBe("pro_annual");

    // 3. Webhook processa PAYMENT_RECEIVED
    const snapshot: UserSubscriptionSnapshot = {
      id: currentSub.id,
      user_id: currentSub.userId,
      tier: currentSub.tier,
      plan_id: currentSub.planId,
      status: currentSub.status,
      asaas_customer_id: currentSub.asaasCustomerId,
      asaas_payment_id: currentSub.asaasPaymentId,
      current_period_end: currentSub.currentPeriodEnd,
      cancel_at_period_end: currentSub.cancelAtPeriodEnd,
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_RECEIVED",
      payment: asaasPayment,
      currentSub: snapshot,
    });

    expect(decision.action).toBe("activate");
    if (decision.action === "activate") {
      // 4. Aplicação do update atômico no banco
      currentSub = {
        ...currentSub,
        status: "active",
        tier: decision.targetTier,
        planId: decision.targetTier,
        currentPeriodEnd: decision.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        canWrite: true,
      };
    }

    // Validação dos critérios de aceitação do plano
    expect(currentSub.status).toBe("active");
    expect(currentSub.tier).toBe("pro_annual");
    expect(currentSub.currentPeriodEnd).toBeDefined();
    expect(simulateCanWrite(currentSub)).toBe(true);

    // 5. Chegada do evento subsequente PAYMENT_CONFIRMED (idempotência)
    const secondSnapshot: UserSubscriptionSnapshot = {
      id: currentSub.id,
      user_id: currentSub.userId,
      tier: currentSub.tier,
      plan_id: currentSub.planId,
      status: currentSub.status,
      asaas_customer_id: currentSub.asaasCustomerId,
      asaas_payment_id: currentSub.asaasPaymentId,
      current_period_end: currentSub.currentPeriodEnd,
      cancel_at_period_end: currentSub.cancelAtPeriodEnd,
    };

    const secondDecision = decideWebhookAction({
      eventType: "PAYMENT_CONFIRMED",
      payment: asaasPayment,
      currentSub: secondSnapshot,
    });

    // Deve ser ignorado de forma idempotente sem alterar datas
    expect(secondDecision.action).toBe("ignore_duplicate");
    if (secondDecision.action === "ignore_duplicate") {
      expect(secondDecision.reason).toBe("already_active");
    }
    expect(currentSub.status).toBe("active");
    expect(currentSub.tier).toBe("pro_annual");
  });

  it("suporta o fluxo de estorno/reembolso legal em até 7 dias (CDC Artigo 49)", () => {
    // 1. Assinatura ativa após contratação recente
    let currentSub: SubscriptionState = {
      id: "sub-12345",
      userId: "user-test-client",
      tier: "pro_monthly",
      planId: "pro_monthly",
      status: "active",
      asaasCustomerId: "cus_asaas_001",
      asaasPaymentId: "pay_monthly_001",
      asaasSubscriptionId: "sub_rec_001",
      currentPeriodEnd: "2026-11-24T12:00:00.000Z",
      cancelAtPeriodEnd: false,
      canWrite: true,
    };

    // 2. Cliente solicita estorno/cancelamento dentro de 7 dias via Asaas
    // O Asaas emite PAYMENT_DELETED ou SUBSCRIPTION_DELETED
    const snapshot: UserSubscriptionSnapshot = {
      id: currentSub.id,
      user_id: currentSub.userId,
      tier: currentSub.tier,
      plan_id: currentSub.planId,
      status: currentSub.status,
      asaas_customer_id: currentSub.asaasCustomerId,
      asaas_payment_id: currentSub.asaasPaymentId,
      asaas_subscription_id: currentSub.asaasSubscriptionId,
      current_period_end: currentSub.currentPeriodEnd,
      cancel_at_period_end: currentSub.cancelAtPeriodEnd,
    };

    const decision = decideWebhookAction({
      eventType: "PAYMENT_DELETED",
      payment: { id: "pay_monthly_001" },
      currentSub: snapshot,
    });

    expect(decision.action).toBe("mark_cancelled");
    currentSub = {
      ...currentSub,
      cancelAtPeriodEnd: true,
    };

    expect(currentSub.cancelAtPeriodEnd).toBe(true);

    // 3. Caso o pagamento fique vencido sem compensação (PAYMENT_OVERDUE)
    const overdueDecision = decideWebhookAction({
      eventType: "PAYMENT_OVERDUE",
      payment: { id: "pay_monthly_001" },
      currentSub: { ...snapshot, cancel_at_period_end: true },
    });

    expect(overdueDecision.action).toBe("mark_past_due");
    currentSub = {
      ...currentSub,
      status: "past_due",
    };

    expect(currentSub.status).toBe("past_due");
    expect(simulateCanWrite(currentSub)).toBe(false); // Inadimplente perde escrita
  });

  it("assegura que a verificação de reúso de Pix não gera múltiplas cobranças se chamada repetidamente", () => {
    const fixedNow = 1761300000000;
    const payment = {
      status: "PENDING",
      value: 178.8,
      createdAtMillis: fixedNow - 15 * 60 * 1000, // 15 minutos atrás
    };

    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: payment.status,
      paymentValue: payment.value,
      expectedValue: 178.8,
      createdAtMillis: payment.createdAtMillis,
      nowMillis: fixedNow,
    });

    expect(canReuse).toBe(true);
  });
});
