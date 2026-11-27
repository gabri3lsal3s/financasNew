import { describe, expect, it } from "vitest";
import { shouldReusePendingPixCharge } from "../../supabase/functions/_shared/asaas.ts";
import {
  classifyPendingPixIntent,
  type PendingPixIntentRow,
} from "../../supabase/functions/_shared/pix-intents.ts";

describe("shouldReusePendingPixCharge — Reúso Inteligente de Pix Pendente", () => {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const now = new Date("2026-10-24T12:00:00Z").getTime();

  it("permite reaproveitamento quando cobrança estiver PENDING, com mesmo valor e criada há menos de 1 hora", () => {
    const createdAtMillis = now - 30 * 60 * 1000; // 30 minutos atrás
    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: "PENDING",
      paymentValue: 143.88,
      expectedValue: 143.88,
      createdAtMillis,
      nowMillis: now,
    });
    expect(canReuse).toBe(true);
  });

  it("rejeita reaproveitamento quando cobrança tiver mais de 1 hora", () => {
    const createdAtMillis = now - (ONE_HOUR_MS + 1000); // 1 hora e 1 segundo atrás
    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: "PENDING",
      paymentValue: 143.88,
      expectedValue: 143.88,
      createdAtMillis,
      nowMillis: now,
    });
    expect(canReuse).toBe(false);
  });

  it("rejeita reaproveitamento quando status não for PENDING (ex.: CONFIRMED, RECEIVED, OVERDUE)", () => {
    const createdAtMillis = now - 10 * 60 * 1000;
    expect(
      shouldReusePendingPixCharge({
        paymentStatus: "CONFIRMED",
        paymentValue: 143.88,
        expectedValue: 143.88,
        createdAtMillis,
        nowMillis: now,
      }),
    ).toBe(false);

    expect(
      shouldReusePendingPixCharge({
        paymentStatus: "RECEIVED",
        paymentValue: 143.88,
        expectedValue: 143.88,
        createdAtMillis,
        nowMillis: now,
      }),
    ).toBe(false);

    expect(
      shouldReusePendingPixCharge({
        paymentStatus: "OVERDUE",
        paymentValue: 143.88,
        expectedValue: 143.88,
        createdAtMillis,
        nowMillis: now,
      }),
    ).toBe(false);
  });

  it("rejeita reaproveitamento quando o valor da cobrança divergir do catálogo", () => {
    const createdAtMillis = now - 15 * 60 * 1000;
    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: "PENDING",
      paymentValue: 99.0, // valor diferente
      expectedValue: 143.88,
      createdAtMillis,
      nowMillis: now,
    });
    expect(canReuse).toBe(false);
  });

  it("rejeita reaproveitamento quando timestamp for no futuro (inconsistência de relógio)", () => {
    const createdAtMillis = now + 5000;
    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: "PENDING",
      paymentValue: 143.88,
      expectedValue: 143.88,
      createdAtMillis,
      nowMillis: now,
    });
    expect(canReuse).toBe(false);
  });
});

describe("classifyPendingPixIntent — Exclusividade e Substituição de PIX Pendente", () => {
  const baseIntent: PendingPixIntentRow = {
    id: "intent-1",
    user_id: "user-1",
    kind: "cumulative_renewal",
    plan_id: "pro_monthly",
    months_count: 2,
    amount_cents: 3798,
    method: "pix",
    status: "pending",
    provider_payment_id: "pay_pix_1",
    created_at: "2026-11-27T23:45:00-03:00", // 23h45 BRT — dateCreated do Asaas seria 2026-11-27 00:00Z!
  };

  it("reaproveita usando intent.created_at mesmo gerado após as 22h BRT", () => {
    const nowMillis = new Date("2026-11-27T23:55:00-03:00").getTime();
    const res = classifyPendingPixIntent({
      intent: baseIntent,
      asaasPayment: { id: "pay_pix_1", status: "PENDING", value: 37.98 },
      desired: { kind: "cumulative_renewal", monthsCount: 2, expectedValue: 37.98 },
      nowMillis,
    });
    expect(res).toEqual({ action: "reuse" });
  });

  it("cancela o PIX anterior ao trocar quantidade de meses (2 -> 3 meses)", () => {
    const nowMillis = new Date("2026-11-27T23:55:00-03:00").getTime();
    const res = classifyPendingPixIntent({
      intent: baseIntent,
      asaasPayment: { id: "pay_pix_1", status: "PENDING", value: 37.98 },
      desired: { kind: "cumulative_renewal", monthsCount: 3, expectedValue: 56.97 },
      nowMillis,
    });
    expect(res).toEqual({ action: "cancel_and_delete" });
  });

  it("cancela o PIX anterior ao trocar de antecipação acumulativa para Plano Anual PIX", () => {
    const nowMillis = new Date("2026-11-27T23:55:00-03:00").getTime();
    const res = classifyPendingPixIntent({
      intent: baseIntent,
      asaasPayment: { id: "pay_pix_1", status: "PENDING", value: 37.98 },
      desired: { kind: "plan_change", expectedValue: 143.88 },
      nowMillis,
    });
    expect(res).toEqual({ action: "cancel_and_delete" });
  });

  it("bloqueia nova geração quando cobrança anterior já foi paga no Asaas (CONFIRMED ou RECEIVED)", () => {
    const nowMillis = new Date("2026-11-27T23:55:00-03:00").getTime();
    expect(
      classifyPendingPixIntent({
        intent: baseIntent,
        asaasPayment: { id: "pay_pix_1", status: "CONFIRMED", value: 37.98 },
        desired: { kind: "cumulative_renewal", monthsCount: 3, expectedValue: 56.97 },
        nowMillis,
      }),
    ).toEqual({ action: "block_already_paid" });

    expect(
      classifyPendingPixIntent({
        intent: baseIntent,
        asaasPayment: { id: "pay_pix_1", status: "RECEIVED", value: 37.98 },
        desired: { kind: "cumulative_renewal", monthsCount: 2, expectedValue: 37.98 },
        nowMillis,
      }),
    ).toEqual({ action: "block_already_paid" });
  });

  it("aguarda em voo quando provider_payment_id ainda é null e tem menos de 15 segundos", () => {
    const nowMillis = new Date("2026-11-27T23:45:10-03:00").getTime();
    const res = classifyPendingPixIntent({
      intent: { ...baseIntent, provider_payment_id: null },
      asaasPayment: null,
      desired: { kind: "cumulative_renewal", monthsCount: 2, expectedValue: 37.98 },
      nowMillis,
    });
    expect(res).toEqual({ action: "wait_in_flight" });
  });

  it("marca para encerramento local quando provider_payment_id é null há >= 15s ou Asaas retornou DELETED", () => {
    const nowMillis = new Date("2026-11-27T23:46:00-03:00").getTime();
    expect(
      classifyPendingPixIntent({
        intent: { ...baseIntent, provider_payment_id: null },
        asaasPayment: null,
        desired: { kind: "cumulative_renewal", monthsCount: 2, expectedValue: 37.98 },
        nowMillis,
      }),
    ).toEqual({ action: "mark_closed_only" });

    expect(
      classifyPendingPixIntent({
        intent: baseIntent,
        asaasPayment: { id: "pay_pix_1", status: "DELETED", value: 37.98 },
        desired: { kind: "cumulative_renewal", monthsCount: 2, expectedValue: 37.98 },
        nowMillis,
      }),
    ).toEqual({ action: "mark_closed_only" });
  });
});
