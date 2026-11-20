import { describe, expect, it } from "vitest";
import { formatCentsAsBRL } from "@/services/masks/money";
import {
  buildBudgetCategoryConsumptionBreakdown,
  buildBudgetSpendModeExplanationBreakdown,
  buildBudgetSpendWeightBreakdown,
  buildEmergencyFundBreakdown,
} from "./budgets-breakdown";

describe("budgets-breakdown builders (Fase 4.5 e Fase 5)", () => {
  it("deve construir a memoria de ponderacao de gastos no modo Minha Parte", () => {
    const breakdown = buildBudgetSpendWeightBreakdown({
      spendMetric: "personal",
      totalGrossCents: 500000, // R$ 5.000,00
      totalWeightedCents: 350000, // R$ 3.500,00
      monthLabel: "Agosto 2026",
    });

    expect(breakdown.id).toBe("budget-spend-weight-breakdown");
    expect(breakdown.result.rawValue).toBe(350000);
    expect(breakdown.result.formattedValue).toBe(formatCentsAsBRL(350000));
    expect(breakdown.steps[0]!.formattedValue).toBe(formatCentsAsBRL(500000));
    expect(breakdown.steps[1]!.formattedValue).toBe(formatCentsAsBRL(150000));
  });

  it("deve construir a memoria de ponderacao de gastos no modo Total Bruto", () => {
    const breakdown = buildBudgetSpendWeightBreakdown({
      spendMetric: "household",
      totalGrossCents: 500000,
      totalWeightedCents: 350000,
    });

    expect(breakdown.result.rawValue).toBe(500000);
    expect(breakdown.result.formattedValue).toBe(formatCentsAsBRL(500000));
  });

  it("deve construir a explicacao dos modos de visualizacao", () => {
    const breakdown = buildBudgetSpendModeExplanationBreakdown({
      currentMetric: "personal",
    });

    expect(breakdown.id).toBe("budget-spend-mode-explanation");
    expect(breakdown.result.formattedValue).toBe("Minha Parte (Individual)");
    expect(breakdown.steps).toHaveLength(2);
  });

  it("deve calcular corretamente a autonomia financeira da reserva de emergencia (Runway)", () => {
    const breakdown = buildEmergencyFundBreakdown({
      liquidReserveCents: 3000000, // R$ 30.000,00
      monthlyExpensesCents: 500000, // R$ 5.000,00
      targetMonths: 6,
    });

    expect(breakdown.id).toBe("emergency-fund-runway-breakdown");
    expect(breakdown.unit).toBe("months");
    expect(breakdown.result.rawValue).toBe(6.0);
    expect(breakdown.result.formattedValue).toContain("6,0 meses");
    expect(breakdown.result.tone).toBe("positive");
    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.steps[0]!.formattedValue).toBe(formatCentsAsBRL(3000000));
    expect(breakdown.steps[1]!.formattedValue).toBe(formatCentsAsBRL(500000));
  });

  it("deve calcular o consumo de limite de categoria com ritmo diario", () => {
    const breakdown = buildBudgetCategoryConsumptionBreakdown({
      categoryName: "Alimentação",
      limitCents: 150000, // R$ 1.500,00
      spentCents: 90000, // R$ 900,00
      currentDay: 15,
      daysInMonth: 30,
    });

    expect(breakdown.id).toBe("budget-consumption-alimentação");
    expect(breakdown.result.rawValue).toBe(60000); // R$ 600,00 restante
    expect(breakdown.result.formattedValue).toBe(formatCentsAsBRL(60000));
    expect(breakdown.result.tone).toBe("positive");
    // Ritmo atual: 900 / 15 = 60/dia
    expect(breakdown.steps[3]!.formattedValue).toBe(formatCentsAsBRL(6000));
    // Teto sugerido: 600 / 15 = 40/dia
    expect(breakdown.steps[4]!.formattedValue).toBe(formatCentsAsBRL(4000));
  });
});
