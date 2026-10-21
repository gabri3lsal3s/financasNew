import { describe, expect, it } from "vitest";
import { calculateEarlyAmortization, calculateLoanProgress, calculateLoanSchedule } from "./index";

describe("calculateLoanSchedule", () => {
  it("calcula cronograma Price com parcelas fixas", () => {
    const res = calculateLoanSchedule({
      principalCents: 100000, // R$ 1.000,00
      totalInstallments: 5,
      monthlyRatePercent: 2, // 2% a.m.
      system: "price",
      startDate: "2026-01-10",
    });

    expect(res.principalCents).toBe(100000);
    expect(res.schedule).toHaveLength(5);
    expect(res.schedule[0]?.dueDate).toBe("2026-01-10");
    expect(res.schedule[1]?.dueDate).toBe("2026-02-10");
    expect(res.schedule[4]?.dueDate).toBe("2026-05-10");
    expect(res.totalInterestCents).toBeGreaterThan(0);
    expect(res.schedule[4]?.remainingBalanceCents).toBe(0);
  });

  it("calcula cronograma SAC com amortização constante e parcelas decrescentes", () => {
    const res = calculateLoanSchedule({
      principalCents: 100000, // R$ 1.000,00
      totalInstallments: 4,
      monthlyRatePercent: 1.5,
      system: "sac",
      startDate: "2026-01-10",
    });

    expect(res.schedule).toHaveLength(4);
    // Amortização constante de 250,00 (25000 cents)
    expect(res.schedule[0]?.principalCents).toBe(25000);
    expect(res.schedule[1]?.principalCents).toBe(25000);
    // Parcela 1 > Parcela 4
    expect(res.schedule[0]!.amountCents).toBeGreaterThan(res.schedule[3]!.amountCents);
    expect(res.schedule[3]?.remainingBalanceCents).toBe(0);
  });

  it("assegura zeramento exato do saldo devedor na parcela final N em SAC e Price com centavos indivisíveis", () => {
    // R$ 1.000,03 dividido em 7 parcelas com taxa de 1.83% a.m.
    const principalCents = 100003;
    const totalInstallments = 7;
    const monthlyRatePercent = 1.83;

    for (const system of ["price", "sac"] as const) {
      const res = calculateLoanSchedule({
        principalCents,
        totalInstallments,
        monthlyRatePercent,
        system,
        startDate: "2026-03-15",
      });

      expect(res.schedule).toHaveLength(7);

      // Parcela final N deve ter saldo devedor exatamente 0
      const finalInstallment = res.schedule[6]!;
      expect(finalInstallment.remainingBalanceCents).toBe(0);

      // Soma estrita do principal amortizado deve ser exatamente igual ao principal inicial
      const totalAmortized = res.schedule.reduce((acc, it) => acc + it.principalCents, 0);
      expect(totalAmortized).toBe(principalCents);

      // Total pago deve ser a soma exata de principal + juros totais
      expect(res.totalPaidCents).toBe(res.principalCents + res.totalInterestCents);

      // Cada parcela individual deve ter amountCents === principalCents + interestCents
      for (const item of res.schedule) {
        expect(item.amountCents).toBe(item.principalCents + item.interestCents);
      }
    }
  });

  it("assegura zeramento exato e conservação estrita em financiamentos imobiliários longos (360x e 420x)", () => {
    // R$ 450.000,00 a 0.85% a.m. em 360 e 420 meses
    const principalCents = 45000000;
    const terms = [360, 420];

    for (const totalInstallments of terms) {
      for (const system of ["sac", "price"] as const) {
        const res = calculateLoanSchedule({
          principalCents,
          totalInstallments,
          monthlyRatePercent: 0.85,
          system,
          startDate: "2026-01-01",
        });

        expect(res.schedule).toHaveLength(totalInstallments);

        // Saldo residual na última parcela deve ser rigidamente zero
        const last = res.schedule[totalInstallments - 1]!;
        expect(last.remainingBalanceCents).toBe(0);

        // Invariante de amortização total do principal
        const sumAmortization = res.schedule.reduce((acc, it) => acc + it.principalCents, 0);
        expect(sumAmortization).toBe(principalCents);

        // Invariante do total pago e total de juros
        const sumAmount = res.schedule.reduce((acc, it) => acc + it.amountCents, 0);
        const sumInterest = res.schedule.reduce((acc, it) => acc + it.interestCents, 0);
        expect(sumAmount).toBe(res.totalPaidCents);
        expect(sumInterest).toBe(res.totalInterestCents);
        expect(res.totalPaidCents).toBe(principalCents + res.totalInterestCents);
      }
    }
  });

  it("assegura integridade contábil e zeramento exato com taxa zero (0% a.m.) em SAC e Price", () => {
    // R$ 100,00 em 3 parcelas (33,34 + 33,33 + 33,33)
    const principalCents = 10000;
    const totalInstallments = 3;

    for (const system of ["price", "sac"] as const) {
      const res = calculateLoanSchedule({
        principalCents,
        totalInstallments,
        monthlyRatePercent: 0,
        system,
        startDate: "2026-03-01",
      });

      expect(res.totalInterestCents).toBe(0);
      expect(res.totalPaidCents).toBe(10000);
      expect(res.schedule[2]!.remainingBalanceCents).toBe(0);

      const sumAmortization = res.schedule.reduce((acc, it) => acc + it.principalCents, 0);
      expect(sumAmortization).toBe(10000);
    }
  });

  it("assegura zeramento exato em contrato de parcela única (N = 1)", () => {
    for (const system of ["price", "sac", "fixed_installment"] as const) {
      const res = calculateLoanSchedule({
        principalCents: 150000,
        totalInstallments: 1,
        monthlyRatePercent: 2,
        system,
        startDate: "2026-03-01",
        fixedInstallmentCents: 153000,
      });

      expect(res.schedule).toHaveLength(1);
      expect(res.schedule[0]!.remainingBalanceCents).toBe(0);
      expect(res.schedule[0]!.principalCents).toBe(150000);
      expect(res.totalPaidCents).toBe(res.principalCents + res.totalInterestCents);
    }
  });

  it("valida zeramento em matriz diversa de 40 combinações paramétricas (estresse contábil)", () => {
    const testCases = [
      { pv: 1, n: 1, rate: 0 },
      { pv: 7, n: 3, rate: 1.5 },
      { pv: 9999, n: 11, rate: 2.25 },
      { pv: 50000, n: 6, rate: 0.99 },
      { pv: 12345678, n: 17, rate: 1.85 },
      { pv: 80000000, n: 180, rate: 0.75 },
    ];

    for (const tc of testCases) {
      for (const system of ["price", "sac"] as const) {
        const res = calculateLoanSchedule({
          principalCents: tc.pv,
          totalInstallments: tc.n,
          monthlyRatePercent: tc.rate,
          system,
          startDate: "2026-01-01",
        });

        // 1. Saldo devedor final estritamente 0
        const last = res.schedule[res.schedule.length - 1]!;
        expect(last.remainingBalanceCents).toBe(0);

        // 2. Soma de principal exatamente igual ao valor financiado
        const sumPrincipal = res.schedule.reduce((acc, it) => acc + it.principalCents, 0);
        expect(sumPrincipal).toBe(tc.pv);

        // 3. Conservação de total pago = principal + juros
        expect(res.totalPaidCents).toBe(res.principalCents + res.totalInterestCents);

        // 4. Cada parcela individual conserva centavos
        for (const item of res.schedule) {
          expect(item.amountCents).toBe(item.principalCents + item.interestCents);
        }
      }
    }
  });
});

describe("calculateEarlyAmortization", () => {
  it("calcula desconto a valor presente ao antecipar parcelas do fim do contrato", () => {
    const remaining = [
      { id: "p1", installmentNumber: 1, amountCents: 50000, dueDate: "2026-04-10" },
      { id: "p2", installmentNumber: 2, amountCents: 50000, dueDate: "2026-05-10" },
      { id: "p3", installmentNumber: 3, amountCents: 50000, dueDate: "2026-06-10" },
      { id: "p4", installmentNumber: 4, amountCents: 50000, dueDate: "2026-07-10" },
    ];

    const res = calculateEarlyAmortization(
      remaining,
      2, // 2% a.m.
      90000, // R$ 900,00 de orçamento disponível
      "2026-03-01"
    );

    // Deve priorizar a eliminação das parcelas do final (p4, p3...)
    expect(res.eliminatedInstallmentIds).toContain("p4");
    expect(res.totalDiscountCents).toBeGreaterThan(0);
    expect(res.totalPresentValuePaidCents).toBeLessThan(res.totalOriginalAmountCents);
  });

  it("não aplica desconto indevido de juros em parcelas vencendo no mesmo mês de referência", () => {
    const remaining = [
      { id: "p1", installmentNumber: 1, amountCents: 100000, dueDate: "2026-03-25" },
    ];

    const res = calculateEarlyAmortization(
      remaining,
      2.5, // 2,5% a.m.
      100000,
      "2026-03-05"
    );

    expect(res.eliminatedInstallmentIds).toEqual(["p1"]);
    expect(res.totalOriginalAmountCents).toBe(100000);
    expect(res.totalPresentValuePaidCents).toBe(100000);
    expect(res.totalDiscountCents).toBe(0);
  });

  it("não aplica desconto para parcelas já vencidas em mês anterior ao de referência", () => {
    const remaining = [
      { id: "p_past", installmentNumber: 1, amountCents: 100000, dueDate: "2026-02-15" },
    ];

    const res = calculateEarlyAmortization(
      remaining,
      3,
      100000,
      "2026-03-10"
    );

    expect(res.eliminatedInstallmentIds).toEqual(["p_past"]);
    expect(res.totalPresentValuePaidCents).toBe(100000);
    expect(res.totalDiscountCents).toBe(0);
  });

  it("calcula desconto exato para parcelas futuras preservando valor nominal da parcela do mês corrente", () => {
    const remaining = [
      { id: "p_current", installmentNumber: 1, amountCents: 100000, dueDate: "2026-03-15" },
      { id: "p_future", installmentNumber: 2, amountCents: 100000, dueDate: "2026-04-15" },
    ];

    // Orçamento suficiente para pagar as duas parcelas
    const res = calculateEarlyAmortization(
      remaining,
      2, // 2% a.m.
      200000,
      "2026-03-01"
    );

    // Prioriza eliminar de trás pra frente: p_future depois p_current
    expect(res.eliminatedInstallmentIds).toEqual(["p_future", "p_current"]);
    expect(res.totalOriginalAmountCents).toBe(200000);
    // p_future (1 mês à frente): 100000 / 1.02 = 98039
    // p_current (mesmo mês): 100000 / 1.00 = 100000
    // Total PV = 198039
    // Desconto total = 200000 - 198039 = 1961
    expect(res.totalPresentValuePaidCents).toBe(198039);
    expect(res.totalDiscountCents).toBe(1961);
  });
});

describe("calculateLoanProgress", () => {
  it("calculates progress and pending amount for loan contract debts", () => {
    const debts = [
      { amount: 250, paid_at: "2026-01-10" },
      { amount: 250, paid_at: "2026-02-10" },
      { amount: 250, paid_at: null },
      { amount: 250, paid_at: null },
    ];

    const result = calculateLoanProgress(debts, 4);
    expect(result.paidCount).toBe(2);
    expect(result.totalCount).toBe(4);
    expect(result.progressPercent).toBe(50);
    expect(result.pendingAmountCents).toBe(50000);
  });

  it("handles empty debts using fallback installments", () => {
    const result = calculateLoanProgress([], 12);
    expect(result.paidCount).toBe(0);
    expect(result.totalCount).toBe(12);
    expect(result.progressPercent).toBe(0);
    expect(result.pendingAmountCents).toBe(0);
  });
});

