import { describe, expect, it } from "vitest";
import { calculateChargesBreakdown } from "./index";

describe("calculateChargesBreakdown", () => {
  it("agrega corretamente despesas por natureza", () => {
    const expenses = [
      { value: 100, report_weight: 1, charge_kind: "regular" as const },
      { value: 20, report_weight: 1, charge_kind: "interest" as const },
      { value: 10, report_weight: 1, charge_kind: "fine" as const },
      { value: 50, report_weight: 0.5, charge_kind: "tax" as const },
      { value: 15, report_weight: 1, charge_kind: "bank_fee" as const },
    ];

    const result = calculateChargesBreakdown(expenses);

    // Juros (20) + Multas (10) = 30 (3000 centavos)
    expect(result.wastedGrossCents).toBe(3000);
    expect(result.wastedWeightedCents).toBe(3000);

    // Impostos: 50 bruto (5000), 25 ponderado (2500)
    expect(result.taxGrossCents).toBe(5000);
    expect(result.taxWeightedCents).toBe(2500);

    // Taxas bancárias: 15 (1500)
    expect(result.feeGrossCents).toBe(1500);

    // Consumo regular: 100 (10000)
    expect(result.regularGrossCents).toBe(10000);

    // Total de encargos: 20 + 10 + 50 + 15 = 95 bruto (9500)
    expect(result.totalChargesGrossCents).toBe(9500);
    // Ponderado: 20 + 10 + 25 + 15 = 70 (7000)
    expect(result.totalChargesWeightedCents).toBe(7000);
  });
});
