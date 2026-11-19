/**
 * Invariantes Matemáticos de Cartões, Parcelas & Empréstimos (cards-loans-invariants.ts).
 *
 * Assertivas:
 * 1. Conservação de Centavos em Dízimas Periódicas (R$ 100 em 3x, R$ 10.000 em 7x)
 * 2. Corte de Competência de Fatura no Closing Day
 * 3. Amortização de Estorno em Parcelas Futuras
 * 4. Quitação Antecipada com Desconto a Valor Presente (CDC art. 52 § 2º)
 * 5. Saldo Devedor Final Estritamente R$ 0,00 em Financiamentos (SAC/Price)
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult } from "./helpers";
import type { CardsLoansState } from "../personas/types";
import { somaCents } from "@/domain/money/parcelar";
import { resolveBillCompetence } from "@/domain/competence";
import { calculateLoanSchedule, calculateEarlyAmortization } from "@/domain/loans";

export const assertCentConservation: InvariantAssertion<CardsLoansState> = {
  id: "INV-CARD-01",
  name: "Conservação Estrita de Centavos em Parcelamentos",
  module: "cards",
  description: "Assegura que a partição de valores com dízima periódica preserva 100% da soma original em centavos.",
  execute: (state: CardsLoansState) => {
    let allPassed = true;
    let totalOriginal = 0;
    let totalSummed = 0;

    for (const split of state.periodicSplits) {
      const sum = somaCents([...split.expectedParts]);
      totalOriginal += split.totalCents;
      totalSummed += sum;
      if (sum !== split.totalCents) {
        allPassed = false;
      }
    }

    return createAssertionResult({
      id: "INV-CARD-01",
      name: "Conservação Estrita de Centavos em Parcelamentos",
      module: "cards",
      expected: totalOriginal,
      found: totalSummed,
      passed: allPassed,
      origin: "src/domain/money/parcelar.ts",
    });
  },
};

export const assertClosingDayCompetence: InvariantAssertion<CardsLoansState> = {
  id: "INV-CARD-02",
  name: "Corte de Competência de Fatura (Closing Day)",
  module: "cards",
  description: "Garante que compras antes do fechamento pertencem à fatura atual e a partir do fechamento à fatura seguinte.",
  execute: (state: CardsLoansState) => {
    const { closingDayTest } = state;
    const compBefore = resolveBillCompetence(closingDayTest.purchaseBeforeCutoffIso, closingDayTest.closingDay);
    const compAfter = resolveBillCompetence(closingDayTest.purchaseAfterCutoffIso, closingDayTest.closingDay);

    const passedBefore = compBefore === closingDayTest.expectedCompetenceBefore;
    const passedAfter = compAfter === closingDayTest.expectedCompetenceAfter;
    const passed = passedBefore && passedAfter;

    return createAssertionResult({
      id: "INV-CARD-02",
      name: "Corte de Competência de Fatura (Closing Day)",
      module: "cards",
      expected: `${closingDayTest.expectedCompetenceBefore} | ${closingDayTest.expectedCompetenceAfter}`,
      found: `${compBefore} | ${compAfter}`,
      passed,
      origin: "src/domain/competence/index.ts",
    });
  },
};

export const assertEarlyAmortizationDiscount: InvariantAssertion<CardsLoansState> = {
  id: "INV-LOAN-01",
  name: "Desconto a Valor Presente em Quitação Antecipada (CDC art. 52)",
  module: "loans",
  description: "Comprova que a quitação de parcelas futuras abate juros e reduz o valor total a ser pago.",
  execute: (state: CardsLoansState) => {
    const { earlyAmortization } = state;
    // Orçamento para quitar as 12 parcelas futuras
    const targetBudgetCents = 3_000_000; // R$ 30.000,00
    const result = calculateEarlyAmortization(
      earlyAmortization.remainingInstallments,
      earlyAmortization.monthlyRatePercent,
      targetBudgetCents,
      "2026-11-18",
    );

    const hasDiscount = result.totalDiscountCents > 0;
    const paidLessThanOriginal = result.totalPresentValuePaidCents < result.totalOriginalAmountCents;
    const passed = hasDiscount && paidLessThanOriginal && result.eliminatedInstallmentIds.length > 0;

    return createAssertionResult({
      id: "INV-LOAN-01",
      name: "Desconto a Valor Presente em Quitação Antecipada (CDC art. 52)",
      module: "loans",
      expected: `Valor pago < Original (${result.totalOriginalAmountCents} cts)`,
      found: `Valor pago = ${result.totalPresentValuePaidCents} cts (desconto = ${result.totalDiscountCents} cts)`,
      passed,
      origin: "src/domain/loans/index.ts",
    });
  },
};

export const assertLoanScheduleZeroFinalBalance: InvariantAssertion<CardsLoansState> = {
  id: "INV-LOAN-02",
  name: "Saldo Devedor Final Rigorosamente R$ 0,00",
  module: "loans",
  description: "Verifica se os motores SAC e Price amortizam a totalidade do saldo principal ao final do cronograma.",
  execute: (state: CardsLoansState) => {
    const priceResult = calculateLoanSchedule({
      principalCents: state.loanPrice.principalCents,
      monthlyRatePercent: state.loanPrice.monthlyRatePercent,
      totalInstallments: state.loanPrice.totalInstallments,
      system: "price",
      startDate: state.loanPrice.startDate,
    });

    const sacResult = calculateLoanSchedule({
      principalCents: state.loanSac.principalCents,
      monthlyRatePercent: state.loanSac.monthlyRatePercent,
      totalInstallments: state.loanSac.totalInstallments,
      system: "sac",
      startDate: state.loanSac.startDate,
    });

    const priceFinalBalance = priceResult.schedule[priceResult.schedule.length - 1]?.remainingBalanceCents ?? -1;
    const sacFinalBalance = sacResult.schedule[sacResult.schedule.length - 1]?.remainingBalanceCents ?? -1;
    const passed = priceFinalBalance === 0 && sacFinalBalance === 0;

    return createAssertionResult({
      id: "INV-LOAN-02",
      name: "Saldo Devedor Final Rigorosamente R$ 0,00",
      module: "loans",
      expected: "Saldo final SAC = 0 e Price = 0",
      found: `Saldo final SAC = ${sacFinalBalance} cts e Price = ${priceFinalBalance} cts`,
      passed,
      origin: "src/domain/loans/index.ts",
    });
  },
};

export const cardsLoansInvariantSuite: InvariantSuite = {
  name: "Suíte Forense de Cartões, Parcelas & Empréstimos",
  module: "cards",
  assertions: [
    assertCentConservation,
    assertClosingDayCompetence,
    assertEarlyAmortizationDiscount,
    assertLoanScheduleZeroFinalBalance,
  ],
};
