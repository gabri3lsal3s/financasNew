import { describe, expect, it } from "vitest";
import {
  buildDebtsSummaryBreakdown,
  buildLoanInstallmentBreakdown,
  buildOverdueDebtChargesBreakdown,
} from "./debts-breakdown";

describe("buildDebtsSummaryBreakdown", () => {
  it("constrói o resumo de pendências com superávit a receber", () => {
    const breakdown = buildDebtsSummaryBreakdown({
      payablePendingCents: 150000,
      receivablePendingCents: 200000,
      netPendingCents: 50000,
      pendingCount: 4,
      paidCount: 12,
    });

    expect(breakdown.id).toBe("debts-summary-net");
    expect(breakdown.title).toBe("Saldo Líquido de Pendências");
    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.result.label).toBe("Superávit Líquido a Receber");
    expect(breakdown.result.rawValue).toBe(50000);
    expect(breakdown.result.tone).toBe("positive");
  });

  it("constrói o resumo de pendências com déficit a pagar", () => {
    const breakdown = buildDebtsSummaryBreakdown({
      payablePendingCents: 300000,
      receivablePendingCents: 100000,
      netPendingCents: -200000,
      pendingCount: 5,
    });

    expect(breakdown.result.label).toBe("Déficit Líquido a Pagar");
    expect(breakdown.result.rawValue).toBe(-200000);
    expect(breakdown.result.tone).toBe("negative");
  });
});

describe("buildOverdueDebtChargesBreakdown", () => {
  it("calcula multa CDC e juros legais moratórios para dívida vencida", () => {
    const breakdown = buildOverdueDebtChargesBreakdown({
      debtName: "Boleto de Energia",
      originalAmountCents: 25000,
      daysOverdue: 15,
      fineCents: 500, // 2% CDC
      finePercent: 2,
      interestCents: 125, // 1% ao mês pro-rata 15 dias
      monthlyInterestPercent: 1,
      totalPaidCents: 25625,
    });

    expect(breakdown.title).toBe("Quitação de Boleto de Energia");
    expect(breakdown.steps).toHaveLength(3); // Original, Multa, Juros
    expect(breakdown.result.rawValue).toBe(25625);
    expect(breakdown.notes?.[0]).toContain("CDC (Art. 52 § 1º)");
  });

  it("inclui abatimento de desconto negociado", () => {
    const breakdown = buildOverdueDebtChargesBreakdown({
      debtName: "Acordo de Renegociação",
      originalAmountCents: 100000,
      daysOverdue: 30,
      fineCents: 2000,
      interestCents: 1000,
      discountCents: 15000,
      totalPaidCents: 88000,
    });

    expect(breakdown.steps).toHaveLength(4);
    expect(breakdown.steps[3]?.label).toBe("Desconto / Abatimento Concedido");
    expect(breakdown.steps[3]?.operator).toBe("-");
    expect(breakdown.result.rawValue).toBe(88000);
  });
});

describe("buildLoanInstallmentBreakdown", () => {
  it("decomponha parcela de empréstimo no Sistema Price", () => {
    const breakdown = buildLoanInstallmentBreakdown({
      loanName: "Crédito Pessoal Nubank",
      installmentNumber: 5,
      totalInstallments: 24,
      system: "price",
      principalAmortizationCents: 38000,
      interestCents: 12000,
      totalInstallmentCents: 50000,
      remainingBalanceCents: 750000,
      monthlyRatePercent: 1.5,
    });

    expect(breakdown.title).toBe("Parcela 5/24 de Crédito Pessoal Nubank");
    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.steps[0]?.rawValue).toBe(38000);
    expect(breakdown.steps[1]?.rawValue).toBe(12000);
    expect(breakdown.result.rawValue).toBe(50000);
    expect(breakdown.notes?.[0]).toContain("Tabela Price");
  });

  it("decomponha parcela de financiamento no Sistema SAC", () => {
    const breakdown = buildLoanInstallmentBreakdown({
      loanName: "Financiamento Imobiliário",
      installmentNumber: 1,
      totalInstallments: 360,
      system: "sac",
      principalAmortizationCents: 83333,
      interestCents: 180000,
      totalInstallmentCents: 263333,
      remainingBalanceCents: 29916667,
      monthlyRatePercent: 0.6,
    });

    expect(breakdown.steps[0]?.hint).toContain("Amortização constante do principal");
    expect(breakdown.notes?.[0]).toContain("Tabela SAC");
  });
});
