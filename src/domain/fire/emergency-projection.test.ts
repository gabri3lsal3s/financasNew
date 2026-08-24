import { describe, expect, it } from "vitest";
import { projectEmergencyFund } from "./emergency-projection";

describe("projectEmergencyFund — Motor Preditivo de Reserva de Emergência (§F52)", () => {
  it("projeta marcos de 3, 6 e 12 meses com base na velocidade de poupança", () => {
    const result = projectEmergencyFund({
      currentLiquidCents: 600000, // R$ 6.000,00 atuais
      monthlyExpensesCents: 300000, // R$ 3.000,00 de custo de vida mensal (cobre 2 meses)
      monthlySavingsVelocityCents: 100000, // R$ 1.000,00 de aporte/poupança mensal
      referenceMonth: "2026-08",
    });

    expect(result.currentMonthsCovered).toBe(2);

    // Marco de 3 meses (R$ 9.000,00) -> falta R$ 3.000,00 -> 3 meses (2026-11)
    expect(result.milestone3m.targetCents).toBe(900000);
    expect(result.milestone3m.isReached).toBe(false);
    expect(result.milestone3m.monthsRemaining).toBe(3);
    expect(result.milestone3m.estimatedCompletionMonth).toBe("2026-11");
    expect(result.milestone3m.progressPercent).toBe(67);

    // Marco de 6 meses (R$ 18.000,00) -> falta R$ 12.000,00 -> 12 meses
    expect(result.milestone6m.targetCents).toBe(1800000);
    expect(result.milestone6m.monthsRemaining).toBe(12);
  });

  it("reconhece marcos já atingidos", () => {
    const result = projectEmergencyFund({
      currentLiquidCents: 1500000, // R$ 15.000,00 (cobre 5 meses)
      monthlyExpensesCents: 300000,
      monthlySavingsVelocityCents: 50000,
      referenceMonth: "2026-08",
    });

    expect(result.milestone3m.isReached).toBe(true);
    expect(result.milestone3m.monthsRemaining).toBe(0);
    expect(result.milestone3m.estimatedCompletionMonth).toBe("2026-08");
    expect(result.milestone3m.progressPercent).toBe(100);

    expect(result.milestone6m.isReached).toBe(false);
  });
});
