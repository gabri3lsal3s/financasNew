import { describe, expect, it } from "vitest";
import { calculateDaysOverdue, calculateOverdueDebtCharges } from "./penalty";

describe("calculateDaysOverdue", () => {
  it("retorna 0 se a data de pagamento for anterior ou igual ao vencimento", () => {
    expect(calculateDaysOverdue("2026-03-10", "2026-03-10")).toBe(0);
    expect(calculateDaysOverdue("2026-03-10", "2026-03-05")).toBe(0);
  });

  it("calcula a quantidade correta de dias em atraso", () => {
    expect(calculateDaysOverdue("2026-03-10", "2026-03-15")).toBe(5);
    expect(calculateDaysOverdue("2026-02-25", "2026-03-05")).toBe(8);
  });
});

describe("calculateOverdueDebtCharges", () => {
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
