import { describe, expect, it } from "vitest";
import { shouldReusePendingPixCharge } from "../../supabase/functions/_shared/asaas.ts";

describe("shouldReusePendingPixCharge — Reúso Inteligente de Pix Pendente", () => {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const now = new Date("2026-10-24T12:00:00Z").getTime();

  it("permite reaproveitamento quando cobrança estiver PENDING, com mesmo valor e criada há menos de 1 hora", () => {
    const createdAtMillis = now - 30 * 60 * 1000; // 30 minutos atrás
    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: "PENDING",
      paymentValue: 178.8,
      expectedValue: 178.8,
      createdAtMillis,
      nowMillis: now,
    });
    expect(canReuse).toBe(true);
  });

  it("rejeita reaproveitamento quando cobrança tiver mais de 1 hora", () => {
    const createdAtMillis = now - (ONE_HOUR_MS + 1000); // 1 hora e 1 segundo atrás
    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: "PENDING",
      paymentValue: 178.8,
      expectedValue: 178.8,
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
        paymentValue: 178.8,
        expectedValue: 178.8,
        createdAtMillis,
        nowMillis: now,
      }),
    ).toBe(false);

    expect(
      shouldReusePendingPixCharge({
        paymentStatus: "RECEIVED",
        paymentValue: 178.8,
        expectedValue: 178.8,
        createdAtMillis,
        nowMillis: now,
      }),
    ).toBe(false);

    expect(
      shouldReusePendingPixCharge({
        paymentStatus: "OVERDUE",
        paymentValue: 178.8,
        expectedValue: 178.8,
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
      expectedValue: 178.8,
      createdAtMillis,
      nowMillis: now,
    });
    expect(canReuse).toBe(false);
  });

  it("rejeita reaproveitamento quando timestamp for no futuro (inconsistência de relógio)", () => {
    const createdAtMillis = now + 5000;
    const canReuse = shouldReusePendingPixCharge({
      paymentStatus: "PENDING",
      paymentValue: 178.8,
      expectedValue: 178.8,
      createdAtMillis,
      nowMillis: now,
    });
    expect(canReuse).toBe(false);
  });
});
