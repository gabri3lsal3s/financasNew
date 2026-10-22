import { describe, expect, it } from "vitest";
import {
  calculateEmergencyFund,
  classifyEmergencyHealth,
  EMERGENCY_HEALTH_LABELS,
} from "./emergency-fund";

describe("calculateEmergencyFund — Motor Preditivo de Reserva de Emergência", () => {
  it("projeta marcos de 3, 6 e 12 meses com base na velocidade de poupança", () => {
    const result = calculateEmergencyFund({
      currentLiquidCents: 600_000, // R$ 6.000 (cobre 2 meses)
      monthlyExpensesCents: 300_000, // R$ 3.000 / mês
      monthlySavingsVelocityCents: 150_000, // R$ 1.500 / mês
      referenceMonth: "2026-08",
    });

    expect(result.currentMonthsCovered).toBe(2);
    expect(result.health).toBe("critico");

    // 3 meses = R$ 9.000. Falta R$ 3.000 -> 2 meses -> 2026-10
    expect(result.milestone3m.targetCents).toBe(900_000);
    expect(result.milestone3m.isReached).toBe(false);
    expect(result.milestone3m.progressPercent).toBe(67);
    expect(result.milestone3m.monthsRemaining).toBe(2);
    expect(result.milestone3m.estimatedCompletionMonth).toBe("2026-10");

    // 6 meses = R$ 18.000. Falta R$ 12.000 -> 8 meses -> 2027-04
    expect(result.milestone6m.targetCents).toBe(1_800_000);
    expect(result.milestone6m.isReached).toBe(false);
    expect(result.milestone6m.progressPercent).toBe(33);
    expect(result.milestone6m.monthsRemaining).toBe(8);
    expect(result.milestone6m.estimatedCompletionMonth).toBe("2027-04");

    // 12 meses = R$ 36.000. Falta R$ 30.000 -> 20 meses -> 2028-04
    expect(result.milestone12m.targetCents).toBe(3_600_000);
    expect(result.milestone12m.isReached).toBe(false);
    expect(result.milestone12m.progressPercent).toBe(17);
    expect(result.milestone12m.monthsRemaining).toBe(20);
    expect(result.milestone12m.estimatedCompletionMonth).toBe("2028-04");
  });

  it("reconhece marcos já atingidos", () => {
    const result = calculateEmergencyFund({
      currentLiquidCents: 2_000_000, // R$ 20.000
      monthlyExpensesCents: 200_000, // R$ 2.000 / mês (cobre 10 meses)
      monthlySavingsVelocityCents: 100_000,
      referenceMonth: "2026-08",
    });

    expect(result.currentMonthsCovered).toBe(10);
    expect(result.health).toBe("adequado");

    expect(result.milestone3m.isReached).toBe(true);
    expect(result.milestone3m.progressPercent).toBe(100);
    expect(result.milestone3m.monthsRemaining).toBe(0);
    expect(result.milestone3m.estimatedCompletionMonth).toBe("2026-08");

    expect(result.milestone6m.isReached).toBe(true);
    expect(result.milestone6m.progressPercent).toBe(100);

    expect(result.milestone12m.isReached).toBe(false);
    expect(result.milestone12m.progressPercent).toBe(83);
  });

  it("classifica corretamente as faixas de saúde da reserva", () => {
    expect(classifyEmergencyHealth(0)).toBe("critico");
    expect(classifyEmergencyHealth(2.9)).toBe("critico");
    expect(classifyEmergencyHealth(3)).toBe("baixo");
    expect(classifyEmergencyHealth(5.9)).toBe("baixo");
    expect(classifyEmergencyHealth(6)).toBe("adequado");
    expect(classifyEmergencyHealth(11.9)).toBe("adequado");
    expect(classifyEmergencyHealth(12)).toBe("saudavel");
    expect(classifyEmergencyHealth(24)).toBe("saudavel");

    expect(EMERGENCY_HEALTH_LABELS.critico).toBe("Crítico");
    expect(EMERGENCY_HEALTH_LABELS.baixo).toBe("Baixo");
    expect(EMERGENCY_HEALTH_LABELS.adequado).toBe("Adequado");
    expect(EMERGENCY_HEALTH_LABELS.saudavel).toBe("Saudável");
  });
});
