import { describe, expect, it } from "vitest";
import { calculateBusinessDre, isBusinessFiscalTaxExpense } from "./dre-calculator";

describe("dre-calculator (DRE Simplificado Mensal PJ)", () => {
  it("desambigua charge_kind = 'tax' (IOF de cartão vs imposto fiscal pago)", () => {
    expect(
      isBusinessFiscalTaxExpense({
        scope: "business",
        is_internal_transfer: false,
        charge_kind: "tax",
        payment_method: "pix",
        card_id: null,
      }),
    ).toBe(true);

    expect(
      isBusinessFiscalTaxExpense({
        scope: "business",
        is_internal_transfer: false,
        charge_kind: "tax",
        payment_method: "credit_card",
        card_id: "card-1",
      }),
    ).toBe(false);
  });

  it("calcula receita, custos ponderados, IOF em custos operacionais, DAS, pró-labore e recebíveis sem dupla contagem", () => {
    const dre = calculateBusinessDre({
      incomes: [
        { value: 5000, scope: "business", is_internal_transfer: false, report_weight: 1 },
        { value: 1000, scope: "business", is_internal_transfer: true, report_weight: 1 }, // capital injection ignorado no DRE
        { value: 2000, scope: "personal", is_internal_transfer: false, report_weight: 1 }, // PF ignorado
      ],
      expenses: [
        // Aluguel compartilhado 50% (R$ 1.200 * 0.5 = R$ 600)
        { value: 1200, report_weight: 0.5, scope: "business", is_internal_transfer: false, charge_kind: "regular", payment_method: "pix" },
        // IOF no cartão PJ (R$ 40) -> entra em custos operacionais, não impostos fiscais
        { value: 40, report_weight: 1, scope: "business", is_internal_transfer: false, charge_kind: "tax", payment_method: "credit_card", card_id: "c1" },
        // DAS MEI pago via Pix (R$ 75,90) -> entra em impostos fiscais pagos
        { value: 75.9, report_weight: 1, scope: "business", is_internal_transfer: false, charge_kind: "tax", payment_method: "pix", card_id: null },
        // Reembolso cartão misto -> transferência interna não duplica no DRE
        { value: 300, report_weight: 1, scope: "business", is_internal_transfer: true, transfer_kind: "card_reimbursement" },
        // Pró-labore retirado
        { value: 2500, report_weight: 1, scope: "business", is_internal_transfer: true, transfer_kind: "pro_labore" },
      ],
      debts: [
        { amount: 850, type: "receivable", paid_at: null, scope: "business" },
        { amount: 300, type: "receivable", paid_at: "2026-10-10", scope: "business" },
      ],
    });

    expect(dre.grossRevenueCents).toBe(500_000);
    expect(dre.operationalCostsCents).toBe(64_000); // R$ 600 + R$ 40 IOF
    expect(dre.operationalProfitCents).toBe(436_000);
    expect(dre.fiscalTaxesPaidCents).toBe(7_590);
    expect(dre.netProfitAfterTaxCents).toBe(428_410);
    expect(dre.proLaboreWithdrawnCents).toBe(250_000);
    expect(dre.retainedEarningsCents).toBe(178_410);
    expect(dre.pendingReceivablesCents).toBe(85_000);
    expect(dre.marginPct).toBeCloseTo(85.68, 2);
  });

  it("retorna margem 0% quando receita bruta for zero (proteção NaN)", () => {
    const dre = calculateBusinessDre({ incomes: [], expenses: [] });
    expect(dre.marginPct).toBe(0);
    expect(dre.retainedEarningsCents).toBe(0);
  });
});
