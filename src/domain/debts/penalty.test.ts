import { describe, expect, it } from "vitest";
import {
  calculateDaysOverdue,
  calculateOverdueDebtCharges,
  CDC_STANDARD_FINE_PERCENT,
  CDC_STANDARD_MONTHLY_INTEREST_PERCENT,
} from "./penalty";

describe("calculateDaysOverdue", () => {
  it("retorna 0 se a data de pagamento for anterior ou igual ao vencimento", () => {
    expect(calculateDaysOverdue("2026-03-10", "2026-03-10")).toBe(0);
    expect(calculateDaysOverdue("2026-03-10", "2026-03-05")).toBe(0);
  });

  it("calcula a quantidade correta de dias em atraso", () => {
    expect(calculateDaysOverdue("2026-03-10", "2026-03-15")).toBe(5);
    expect(calculateDaysOverdue("2026-02-25", "2026-03-05")).toBe(8);
  });

  it("normaliza timestamps ISO com hora para análise estrita de data sem drift", () => {
    expect(calculateDaysOverdue("2026-03-10", "2026-03-10T23:59:59.999Z")).toBe(0);
    expect(calculateDaysOverdue("2026-03-10T12:00:00Z", "2026-03-11T08:30:00Z")).toBe(1);
  });
});

describe("calculateOverdueDebtCharges", () => {
  it("formaliza tolerância zero de encargos quando pago no exato dia do vencimento", () => {
    const res = calculateOverdueDebtCharges({
      amountCents: 50000, // R$ 500,00
      dueDate: "2026-03-20",
      paymentDate: "2026-03-20", // Exato dia do vencimento
      finePercent: CDC_STANDARD_FINE_PERCENT, // 2%
      monthlyInterestPercent: CDC_STANDARD_MONTHLY_INTEREST_PERCENT, // 1%
    });

    expect(res.daysOverdue).toBe(0);
    expect(res.fineCents).toBe(0);
    expect(res.interestCents).toBe(0);
    expect(res.discountCents).toBe(0);
    expect(res.totalPaidCents).toBe(50000);
  });

  it("formaliza fronteira exata: dia anterior (0), dia do vencimento (0) e dia posterior (1 dia de atraso com multa + mora)", () => {
    const baseInput = {
      amountCents: 100000, // R$ 1.000,00
      dueDate: "2026-03-15",
      finePercent: CDC_STANDARD_FINE_PERCENT,
      monthlyInterestPercent: CDC_STANDARD_MONTHLY_INTEREST_PERCENT,
    };

    // 1. Dia anterior
    const before = calculateOverdueDebtCharges({ ...baseInput, paymentDate: "2026-03-14" });
    expect(before.daysOverdue).toBe(0);
    expect(before.fineCents).toBe(0);
    expect(before.interestCents).toBe(0);
    expect(before.totalPaidCents).toBe(100000);

    // 2. Dia do vencimento
    const onDue = calculateOverdueDebtCharges({ ...baseInput, paymentDate: "2026-03-15" });
    expect(onDue.daysOverdue).toBe(0);
    expect(onDue.fineCents).toBe(0);
    expect(onDue.interestCents).toBe(0);
    expect(onDue.totalPaidCents).toBe(100000);

    // 3. Dia seguinte (1 dia de atraso)
    const after = calculateOverdueDebtCharges({ ...baseInput, paymentDate: "2026-03-16" });
    expect(after.daysOverdue).toBe(1);
    // Multa CDC 2% de 100000 = 2000 centavos (R$ 20,00)
    expect(after.fineCents).toBe(2000);
    // Mora pro rata die de 1% / 30 * 1 dia: 100000 * (1 / 3000) * 1 = 33.33 -> 33 centavos (R$ 0,33)
    expect(after.interestCents).toBe(33);
    expect(after.totalPaidCents).toBe(102033);
  });

  it("calcula multa padrão de 2% e mora diária para conta atrasada", () => {
    const res = calculateOverdueDebtCharges({
      amountCents: 10000, // R$ 100,00
      dueDate: "2026-03-01",
      paymentDate: "2026-03-31", // 30 dias de atraso
      finePercent: 2, // 2% multa = R$ 2,00 (200 cents)
      monthlyInterestPercent: 1, // 1% ao mês = R$ 1,00 (100 cents)
    });

    expect(res.daysOverdue).toBe(30);
    expect(res.fineCents).toBe(200);
    expect(res.interestCents).toBe(100);
    expect(res.discountCents).toBe(0);
    expect(res.totalPaidCents).toBe(10300); // R$ 103,00
  });

  it("respeita overrides manuais de multa, juros e desconto", () => {
    const res = calculateOverdueDebtCharges({
      amountCents: 50000, // R$ 500,00
      dueDate: "2026-03-01",
      paymentDate: "2026-03-10",
      customFineCents: 1500, // R$ 15,00
      customInterestCents: 550, // R$ 5,50
      discountCents: 1000, // R$ 10,00 desconto
    });

    expect(res.fineCents).toBe(1500);
    expect(res.interestCents).toBe(550);
    expect(res.discountCents).toBe(1000);
    expect(res.totalPaidCents).toBe(51050); // 50000 + 1500 + 550 - 1000 = 51050
  });

  it("não gera multa nem juros se paga em dia", () => {
    const res = calculateOverdueDebtCharges({
      amountCents: 20000,
      dueDate: "2026-03-15",
      paymentDate: "2026-03-10",
      finePercent: 2,
      monthlyInterestPercent: 1,
    });

    expect(res.daysOverdue).toBe(0);
    expect(res.fineCents).toBe(0);
    expect(res.interestCents).toBe(0);
    expect(res.totalPaidCents).toBe(20000);
  });
});
