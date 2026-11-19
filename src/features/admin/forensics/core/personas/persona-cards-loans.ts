/**
 * Persona Cartões, Parcelas & Empréstimos — Dízimas Periódicas e Amortização
 *
 * Módulos: Cartões de Crédito, Dívidas/Empréstimos, Fluxo de Caixa.
 * Valida a conservação de centavos em dízimas periódicas (R$ 100 em 3x, R$ 10.000 em 7x),
 * corte no dia de fechamento da fatura, estornos futuros, juros de rotativo e
 * cronogramas SAC vs. Price com antecipação a valor presente (CDC art. 52 § 2º).
 */

import type { TheoreticalPersona, CardsLoansState } from "./types";
import { splitCents } from "@/domain/money/parcelar";

export const personaCardsLoans: TheoreticalPersona<CardsLoansState> = {
  id: "persona-cards-loans",
  name: "Cartões, Parcelas & Empréstimos",
  description:
    "Testa partição exata de centavos em dízimas periódicas, regra de corte de fatura, estorno de compras, crédito rotativo e CDC art. 52.",
  targetModules: ["cards", "loans", "debts"],
  instantiate: (): CardsLoansState => {
    // Casos canônicos de dízimas periódicas
    const periodicSplits = [
      {
        totalCents: 10_000, // R$ 100,00 em 3x
        installmentsCount: 3,
        expectedParts: splitCents(10_000, 3), // [3334, 3333, 3333]
      },
      {
        totalCents: 1_000_000, // R$ 10.000,00 em 7x
        installmentsCount: 7,
        expectedParts: splitCents(1_000_000, 7), // [142858, 142857, 142857, ...]
      },
      {
        totalCents: 100_000, // R$ 1.000,00 em 60x
        installmentsCount: 60,
        expectedParts: splitCents(100_000, 60),
      },
    ] as const;

    // Cenário de estorno: Compra original de 6x R$ 100,00 (60.000 centavos).
    // Parcela 1 paga. Estorno de R$ 250,00 (25.000 centavos) amortiza parcelas futuras:
    // P2 (10000 -> 0), P3 (10000 -> 0), P4 (10000 -> 5000), P5 (10000), P6 (10000).
    const expectedAdjustedInstallments = [10_000, 0, 0, 5_000, 10_000, 10_000] as const;

    // Contrato de empréstimo: 24 parcelas de R$ 2.496,21 (Price)
    const remainingInstallments = Array.from({ length: 12 }, (_, i) => ({
      id: `inst-loan-${i + 13}`,
      installmentNumber: i + 13,
      amountCents: 249_621,
      dueDate: `2027-${String(i + 1).padStart(2, "0")}-15`,
    }));

    return {
      periodicSplits,
      closingDayTest: {
        closingDay: 20,
        dueDay: 27,
        purchaseBeforeCutoffIso: "2026-10-19",
        purchaseAfterCutoffIso: "2026-10-20",
        expectedCompetenceBefore: "2026-10",
        expectedCompetenceAfter: "2026-11",
      },
      refundScenario: {
        originalTotalCents: 60_000,
        installmentsCount: 6,
        paidInstallmentsCount: 1,
        refundCents: 25_000,
        expectedAdjustedInstallments,
      },
      revolvingCreditScenario: {
        invoiceTotalCents: 200_000, // R$ 2.000,00
        paidCents: 50_000, // R$ 500,00 pagos
        penaltyRatePercent: 2.0, // 2% multa
        revolvingRatePercent: 12.0, // 12% a.m.
        daysLate: 30,
        expectedPenaltyCents: 3_000, // 2% de R$ 1.500,00 = R$ 30,00
      },
      loanPrice: {
        principalCents: 5_000_000, // R$ 50.000,00
        monthlyRatePercent: 1.5,
        totalInstallments: 24,
        startDate: "2026-01-15",
      },
      loanSac: {
        principalCents: 5_000_000, // R$ 50.000,00
        monthlyRatePercent: 1.5,
        totalInstallments: 24,
        startDate: "2026-01-15",
      },
      earlyAmortization: {
        remainingInstallments,
        monthlyRatePercent: 1.5,
      },
    };
  },
};
