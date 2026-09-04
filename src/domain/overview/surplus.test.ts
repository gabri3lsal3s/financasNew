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

  it("limita a capacidade de aporte ao Saldo Livre Real da conta corrente quando a sobra contábil for maior", () => {
    // Cenário idêntico ao print do usuário (Agosto/2026):
    // Receitas R$ 1.942,00, Despesas R$ 1.908,98 -> sobra contábil R$ 33,02
    // Saldo Livre Real na conta corrente: R$ 32,65
    const result = calculateSurplusCapacity({
      incomeCents: 194200,
      expenseCents: 190898,
      openInvoicesCents: 0,
      pendingPayableDebtsCents: 0,
      safeToSpendCents: 3265, // R$ 32,65
    });

    expect(result.operatingBalanceCents).toBe(3302);
    expect(result.surplusCents).toBe(3302);
    // Deve limitar exatamente a R$ 32,65 e não R$ 33,02
    expect(result.suggestedAporteCents).toBe(3265);
    expect(result.hasSurplus).toBe(true);
  });

  it("zera a capacidade de aporte e retorna hasSurplus false quando o Saldo Livre Real for negativo ou zero", () => {
    // Cenário de conta deficitária / no vermelho:
    const result = calculateSurplusCapacity({
      incomeCents: 1000000,
      expenseCents: 400000,
      openInvoicesCents: 0,
      safeToSpendCents: -226797, // Saldo Livre Real negativo de R$ -2.267,97
    });

    expect(result.operatingBalanceCents).toBe(600000);
    expect(result.surplusCents).toBe(600000);
    expect(result.suggestedAporteCents).toBe(0);
    expect(result.hasSurplus).toBe(false);
  });

  it("deduz aportes já realizados no mês corrente da sobra de novos aportes", () => {
    const result = calculateSurplusCapacity({
      incomeCents: 500000,
      expenseCents: 200000,
      openInvoicesCents: 50000,
      contributionsAlreadyMadeCents: 150000, // R$ 1.500 já investidos no mês
      safeToSpendCents: 300000,
    });

    // 5000 - 2000 - 500 - 1500 = 1000
    expect(result.surplusCents).toBe(100000);
    expect(result.suggestedAporteCents).toBe(100000);
    expect(result.hasSurplus).toBe(true);
  });
});
