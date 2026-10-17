import { describe, it, expect } from "vitest";
import {
  getPlanDetails,
  calculateAnnualSavingsCents,
  isWithinCoolingOffPeriod,
  calculateCancellationRefund,
} from "./plans";

describe("Domain: Plans & Pricing", () => {
  it("fornece configurações corretas para Plano Pro Mensal e Anual", () => {
    const monthly = getPlanDetails("monthly");
    expect(monthly.priceCents).toBe(1990);
    expect(monthly.monthlyEquivalentCents).toBe(1990);
    expect(monthly.intervalMonths).toBe(1);

    const annual = getPlanDetails("annual");
    expect(annual.priceCents).toBe(17880);
    expect(annual.monthlyEquivalentCents).toBe(1490);
    expect(annual.intervalMonths).toBe(12);
    expect(annual.discountPercentage).toBe(25);
  });

  it("calcula economia anual de R$ 60,00 (6000 centavos) com precisão", () => {
    // (19,90 * 12) - 178,80 = 238,80 - 178,80 = 60,00
    const savings = calculateAnnualSavingsCents();
    expect(savings).toBe(6000);
  });
});

describe("Domain: CDC & Cancellation Refund Rules", () => {
  it("identifica período de arrependimento do CDC (<= 7 dias)", () => {
    const paidAt = "2026-05-01T10:00:00Z";

    // 3 dias depois: dentro
    expect(
      isWithinCoolingOffPeriod({
        paidAt,
        now: "2026-05-04T10:00:00Z",
      }),
    ).toBe(true);

    // Exatos 7 dias depois: dentro
    expect(
      isWithinCoolingOffPeriod({
        paidAt,
        now: "2026-05-08T10:00:00Z",
      }),
    ).toBe(true);

    // 8 dias depois: fora
    expect(
      isWithinCoolingOffPeriod({
        paidAt,
        now: "2026-05-09T10:00:00Z",
      }),
    ).toBe(false);
  });

  it("reembolsa 100% integral dentro dos primeiros 7 dias (CDC Artigo 49)", () => {
    const paidAt = "2026-05-01T10:00:00Z";
    const cancelAt = "2026-05-05T10:00:00Z";

    // Plano Mensal
    const monthlyRefund = calculateCancellationRefund({
      plan: "monthly",
      paidAt,
      currentDate: cancelAt,
    });
    expect(monthlyRefund.eligibleForRefund).toBe(true);
    expect(monthlyRefund.refundAmountCents).toBe(1990);
    expect(monthlyRefund.isCdcArrependimento).toBe(true);

    // Plano Anual
    const annualRefund = calculateCancellationRefund({
      plan: "annual",
      paidAt,
      currentDate: cancelAt,
    });
    expect(annualRefund.eligibleForRefund).toBe(true);
    expect(annualRefund.refundAmountCents).toBe(17880);
    expect(annualRefund.isCdcArrependimento).toBe(true);
  });

  it("não concede reembolso residual para plano mensal após o 7º dia", () => {
    const paidAt = "2026-05-01T10:00:00Z";
    const cancelAt = "2026-05-15T10:00:00Z"; // 14 dias depois

    const refund = calculateCancellationRefund({
      plan: "monthly",
      paidAt,
      currentDate: cancelAt,
    });

    expect(refund.eligibleForRefund).toBe(false);
    expect(refund.refundAmountCents).toBe(0);
    expect(refund.isCdcArrependimento).toBe(false);
  });

  it("calcula estorno pró-rata correto para plano anual após o 7º dia", () => {
    const paidAt = "2026-01-01T00:00:00Z";
    // Cancelamento após 65 dias (~2.16 meses -> 3 meses usados, 9 meses restantes)
    const cancelAt = new Date(new Date(paidAt).getTime() + 65 * 24 * 60 * 60 * 1000);

    const refund = calculateCancellationRefund({
      plan: "annual",
      paidAt,
      currentDate: cancelAt,
    });

    expect(refund.eligibleForRefund).toBe(true);
    expect(refund.isCdcArrependimento).toBe(false);
    expect(refund.monthsUsed).toBe(3);
    expect(refund.monthsRemaining).toBe(9);
    // Preço por mês: Math.floor(17880 / 12) = 1490. 1490 * 9 = 13410 centavos
    expect(refund.refundAmountCents).toBe(1490 * 9);
  });

  it("retorna zero de reembolso quando todo o ciclo anual de 12 meses foi usufruído", () => {
    const paidAt = "2026-01-01T00:00:00Z";
    const cancelAt = "2026-12-31T00:00:00Z"; // 365 dias depois

    const refund = calculateCancellationRefund({
      plan: "annual",
      paidAt,
      currentDate: cancelAt,
    });

    expect(refund.eligibleForRefund).toBe(false);
    expect(refund.refundAmountCents).toBe(0);
    expect(refund.monthsRemaining).toBe(0);
  });
});
