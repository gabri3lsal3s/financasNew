import { describe, expect, it } from "vitest";
import { calculateTaxShield } from "./tax-shield";

describe("tax-shield (Escudo Tributário Líquido)", () => {
  it("não permite que IOF de cartão abata a provisão tributária e soma despesas dedutíveis", () => {
    const shield = calculateTaxShield({
      profileKind: "mei",
      grossRevenueCents: 600_000,
      monthlyDasCents: 7_590,
      expenses: [
        // IOF no cartão (NÃO deve abater provisão)
        {
          value: 50,
          scope: "business",
          is_internal_transfer: false,
          charge_kind: "tax",
          payment_method: "credit_card",
          card_id: "c1",
          is_tax_deductible: false,
        },
        // Despesa dedutível operacional (ex: consultório)
        {
          value: 400,
          scope: "business",
          is_internal_transfer: false,
          charge_kind: "regular",
          payment_method: "pix",
          is_tax_deductible: true,
        },
      ],
    });

    expect(shield.estimatedTaxCents).toBe(7_590);
    expect(shield.paidFiscalTaxesCents).toBe(0);
    expect(shield.netProvisionRemainingCents).toBe(7_590);
    expect(shield.isFullyCovered).toBe(false);
    expect(shield.deductibleExpensesCents).toBe(40_000);
  });

  it("zera provisão restante quando guia DAS / imposto fiscal sem cartão é pago", () => {
    const shield = calculateTaxShield({
      profileKind: "liberal",
      grossRevenueCents: 1_000_000,
      taxProvisionRatePct: 10,
      expenses: [
        {
          value: 1000,
          scope: "business",
          is_internal_transfer: false,
          charge_kind: "tax",
          payment_method: "pix",
          card_id: null,
        },
      ],
    });

    expect(shield.estimatedTaxCents).toBe(100_000);
    expect(shield.paidFiscalTaxesCents).toBe(100_000);
    expect(shield.netProvisionRemainingCents).toBe(0);
    expect(shield.coveragePct).toBe(100);
    expect(shield.isFullyCovered).toBe(true);
  });
});
