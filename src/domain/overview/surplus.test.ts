import { describe, expect, it } from "vitest";
import { calculateSurplusCapacity } from "./surplus";

describe("calculateSurplusCapacity — apuração da capacidade de aporte (F50)", () => {
  it("calcula sobra positiva deduzindo despesas e faturas/dívidas pendentes", () => {
    const result = calculateSurplusCapacity({
      incomeCents: 1000000, // R$ 10.000,00
      expenseCents: 400000, // R$ 4.000,00
      openInvoicesCents: 150000, // R$ 1.500,00
      pendingPayableDebtsCents: 50000, // R$ 500,00
    });

    // Operacional = 10000 - 4000 = 6000
    expect(result.operatingBalanceCents).toBe(600000);
    // Compromissos = 1500 + 500 = 2000
    expect(result.committedObligationsCents).toBe(200000);
    // Sobra = 6000 - 2000 = 4000
    expect(result.surplusCents).toBe(400000);
    expect(result.suggestedAporteCents).toBe(400000);
    expect(result.hasSurplus).toBe(true);
  });

  it("retorna suggestedAporteCents zerado e hasSurplus false quando a sobra é negativa", () => {
    const result = calculateSurplusCapacity({
      incomeCents: 300000,
      expenseCents: 350000,
      openInvoicesCents: 100000,
      pendingPayableDebtsCents: 50000,
    });

    expect(result.operatingBalanceCents).toBe(-50000);
    expect(result.surplusCents).toBe(-200000);
    expect(result.suggestedAporteCents).toBe(0);
    expect(result.hasSurplus).toBe(false);
  });

  it("trata valores ausentes com padrão zero de forma resiliente", () => {
    const result = calculateSurplusCapacity({
      incomeCents: 500000,
      expenseCents: 300000,
    });

    expect(result.operatingBalanceCents).toBe(200000);
    expect(result.committedObligationsCents).toBe(0);
    expect(result.surplusCents).toBe(200000);
    expect(result.suggestedAporteCents).toBe(200000);
    expect(result.hasSurplus).toBe(true);
  });
});
