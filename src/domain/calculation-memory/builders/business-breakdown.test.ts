import { describe, expect, it } from "vitest";
import { calculateBusinessBreakEven, calculateBusinessDre, calculateMeiAnnualLimit, calculateTaxShield } from "@/domain/business";
import {
  buildBreakEvenBreakdown,
  buildBusinessDreBreakdown,
  buildDerivedCashBreakdown,
  buildMeiCeilingBreakdown,
  buildTaxShieldBreakdown,
} from "./business-breakdown";

describe("business-breakdown (Memória de Cálculo PJ)", () => {
  it("constrói todos os breakdowns de negócio com formulaExpression e steps consistentes", () => {
    const dre = calculateBusinessDre({
      incomes: [{ value: 8000, scope: "business" }],
      expenses: [{ value: 1000, scope: "business", charge_kind: "regular" }],
    });
    const dreMem = buildBusinessDreBreakdown(dre, "Nov/2026");
    expect(dreMem.id).toBe("business-dre-retained");
    expect(dreMem.result.rawValue).toBe(700_000);

    const shield = calculateTaxShield({
      profileKind: "mei",
      grossRevenueCents: 800_000,
      expenses: [],
    });
    const shieldMem = buildTaxShieldBreakdown(shield, {
      profileLabel: "MEI",
      grossRevenueCents: 800_000,
    });
    expect(shieldMem.id).toBe("business-tax-shield");
    expect(shieldMem.result.rawValue).toBe(7_590);

    const mei = calculateMeiAnnualLimit({
      annualIncomes: [{ value: 24300, date: "2026-11-01", scope: "business" }],
    });
    const meiMem = buildMeiCeilingBreakdown(mei, "2026");
    expect(meiMem.id).toBe("business-mei-ceiling");
    expect(meiMem.result.rawValue).toBe(30);

    const be = calculateBusinessBreakEven({
      operationalCostsCents: 100_000,
      estimatedTaxCents: 7_590,
      targetProLaboreCents: 200_000,
      grossRevenueCents: 307_590,
    });
    const beMem = buildBreakEvenBreakdown(be, {
      operationalCostsCents: 100_000,
      estimatedTaxCents: 7_590,
      targetProLaboreCents: 200_000,
    });
    expect(beMem.id).toBe("business-break-even");
    expect(beMem.result.rawValue).toBe(300_000);

    const cashMem = buildDerivedCashBreakdown({
      openingBalanceCents: 50_000,
      capitalInjectionsCents: 20_000,
      grossRevenueCents: 300_000,
      taxWithheldCents: 15_000,
      netRevenueReceivedCents: 285_000,
      cashExpensesCents: 100_000,
      proLaboreWithdrawnCents: 150_000,
      cardReimbursementsPaidCents: 25_000,
      derivedCashBalanceCents: 80_000,
    });
    expect(cashMem.id).toBe("business-derived-cash");
    expect(cashMem.result.rawValue).toBe(80_000);
    expect(cashMem.steps).toHaveLength(6);
  });
});
