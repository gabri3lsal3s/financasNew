import { describe, expect, it } from "vitest";
import { resolveEarlyWebhookSettlement } from "../../supabase/functions/_shared/asaas";

describe("resolveEarlyWebhookSettlement", () => {
  it("retorna active sem sobrescrever intent/assinatura quando webhook antecipado já liquidou a mesma intenção", () => {
    const res = resolveEarlyWebhookSettlement({
      latestIntent: {
        status: "paid",
        provider_subscription_id: "sub_new_123",
        provider_payment_id: "pay_first_123",
      },
      subscriptionId: "sub_new_123",
      firstPaymentId: "pay_first_123",
      prevCancelOk: true,
    });

    expect(res).toEqual({
      confirmedByEarlyWebhook: true,
      responseStatus: "active",
      shouldPersistPending: false,
      shouldMarkPendingResync: false,
    });
  });

  it("preserva active e sinaliza pending_resync quando webhook antecipado liquidou mas o cancelamento da recorrência anterior falhou", () => {
    const res = resolveEarlyWebhookSettlement({
      latestIntent: {
        status: "paid",
        provider_subscription_id: "sub_new_123",
        provider_payment_id: "pay_first_123",
      },
      subscriptionId: "sub_new_123",
      firstPaymentId: "pay_first_123",
      prevCancelOk: false,
    });

    expect(res).toEqual({
      confirmedByEarlyWebhook: true,
      responseStatus: "active",
      shouldPersistPending: false,
      shouldMarkPendingResync: true,
    });
  });

  it("não confia em active de outra fatura/recorrência quando a intent atual ainda está processing ou diverge", () => {
    const stillProcessing = resolveEarlyWebhookSettlement({
      latestIntent: {
        status: "processing",
        provider_subscription_id: null,
        provider_payment_id: null,
      },
      subscriptionId: "sub_new_123",
      firstPaymentId: "pay_first_123",
      prevCancelOk: true,
    });
    expect(stillProcessing.confirmedByEarlyWebhook).toBe(false);
    expect(stillProcessing.responseStatus).toBe("incomplete");
    expect(stillProcessing.shouldPersistPending).toBe(true);

    const mismatchedPayment = resolveEarlyWebhookSettlement({
      latestIntent: {
        status: "paid",
        provider_subscription_id: "sub_new_123",
        provider_payment_id: "pay_other_999",
      },
      subscriptionId: "sub_new_123",
      firstPaymentId: "pay_first_123",
      prevCancelOk: true,
    });
    expect(mismatchedPayment.confirmedByEarlyWebhook).toBe(false);
    expect(mismatchedPayment.responseStatus).toBe("incomplete");
    expect(mismatchedPayment.shouldPersistPending).toBe(true);
  });
});
