/**
 * Motor puro de cálculo para edição, recálculo e repactuação de contratos de empréstimo.
 *
 * Suporta:
 * 1. Recálculo total (reset geral ou quando nenhuma parcela foi paga).
 * 2. Repactuação sobre o saldo devedor restante (quando há parcelas já quitadas),
 *    preservando o histórico das parcelas pagas e gerando novas parcelas sobre o saldo amortizado.
 */

import type { AmortizationSystem, Debt, Loan, LoanType } from "@/types";
import { numberToCents } from "@/domain/money";
import { calculateLoanSchedule } from "./index";

export type LoanRenegotiationStrategy = "amortize_remaining" | "reset";

export interface LoanRenegotiationParams {
  name: string;
  loanType: LoanType;
  principalCents: number;
  installmentsCount: number; // No reset: total de parcelas. Na repactuação: quantidade de parcelas restantes.
  monthlyRatePercent: number;
  system: AmortizationSystem;
  startDate: string; // Data da 1ª nova parcela
  strategy: LoanRenegotiationStrategy;
}

export interface RenegotiationResultItem {
  installmentNumber: number;
  dueDate: string;
  amountCents: number;
  principalCents: number;
  interestCents: number;
  remainingBalanceCents: number;
}

export interface LoanRenegotiationResult {
  strategy: LoanRenegotiationStrategy;
  paidCount: number;
  remainingCount: number;
  newTotalInstallments: number;
  balanceRefinancedCents: number;
  totalPaidSoFarCents: number;
  totalEstimatedInterestCents: number;
  firstInstallmentAmountCents: number;
  lastInstallmentAmountCents: number;
  scheduleToInsert: RenegotiationResultItem[];
}

/**
 * Calcula a amortização acumulada até o momento com base nas parcelas quitadas.
 */
export function calculatePaidAmortization(
  loan: Loan,
  contractDebts: readonly Debt[],
): {
  paidCount: number;
  totalPaidAmountCents: number;
  remainingBalanceCents: number;
  nextSuggestedDueDate: string;
} {
  const sorted = [...contractDebts].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paidDebts = sorted.filter((d) => d.paid_at !== null);
  const pendingDebts = sorted.filter((d) => d.paid_at === null);
  const paidCount = paidDebts.length;

  let totalPaidAmountCents = 0;
  for (const debt of paidDebts) {
    totalPaidAmountCents += numberToCents(debt.amount);
  }

  // Gera o cronograma original para descobrir o saldo devedor amortizado exato
  const originalSchedule = calculateLoanSchedule({
    principalCents: numberToCents(loan.principal_amount),
    totalInstallments: loan.total_installments,
    monthlyRatePercent: loan.interest_rate_monthly,
    system: loan.amortization_system,
    startDate: loan.start_date,
  });

  let remainingBalanceCents = numberToCents(loan.principal_amount);
  if (paidCount > 0 && paidCount <= originalSchedule.schedule.length) {
    remainingBalanceCents = originalSchedule.schedule[paidCount - 1]?.remainingBalanceCents ?? 0;
  } else if (paidCount >= originalSchedule.schedule.length && originalSchedule.schedule.length > 0) {
    remainingBalanceCents = 0;
  }

  const nextSuggestedDueDate =
    pendingDebts[0]?.due_date ??
    (sorted.length > 0
      ? sorted[sorted.length - 1]!.due_date
      : loan.start_date);

  return {
    paidCount,
    totalPaidAmountCents,
    remainingBalanceCents,
    nextSuggestedDueDate,
  };
}

/**
 * Executa o recálculo de repactuação do contrato de crédito.
 */
export function calculateLoanRenegotiation(
  loan: Loan,
  contractDebts: readonly Debt[],
  params: LoanRenegotiationParams,
): LoanRenegotiationResult {
  const { paidCount, totalPaidAmountCents, remainingBalanceCents } = calculatePaidAmortization(
    loan,
    contractDebts,
  );

  const shouldAmortizeRemaining = paidCount > 0 && params.strategy === "amortize_remaining";

  if (!shouldAmortizeRemaining) {
    // Modo Reset ou 0 parcelas pagas: recalcula tudo do zero
    const totalN = Math.max(1, params.installmentsCount);
    const scheduleRes = calculateLoanSchedule({
      principalCents: params.principalCents,
      totalInstallments: totalN,
      monthlyRatePercent: params.monthlyRatePercent,
      system: params.system,
      startDate: params.startDate,
    });

    return {
      strategy: "reset",
      paidCount: 0,
      remainingCount: totalN,
      newTotalInstallments: totalN,
      balanceRefinancedCents: params.principalCents,
      totalPaidSoFarCents: 0,
      totalEstimatedInterestCents: scheduleRes.totalInterestCents,
      firstInstallmentAmountCents: scheduleRes.schedule[0]?.amountCents ?? 0,
      lastInstallmentAmountCents: scheduleRes.schedule[scheduleRes.schedule.length - 1]?.amountCents ?? 0,
      scheduleToInsert: scheduleRes.schedule.map((item) => ({
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        amountCents: item.amountCents,
        principalCents: item.principalCents,
        interestCents: item.interestCents,
        remainingBalanceCents: item.remainingBalanceCents,
      })),
    };
  }

  // Modo Amortize Remaining:
  // Financia o saldo devedor restante em M parcelas a partir da próxima data
  const remainingCount = Math.max(1, params.installmentsCount);
  const balanceToRefinance = Math.max(0, remainingBalanceCents);

  const remainingScheduleRes = calculateLoanSchedule({
    principalCents: balanceToRefinance,
    totalInstallments: remainingCount,
    monthlyRatePercent: params.monthlyRatePercent,
    system: params.system,
    startDate: params.startDate,
  });

  const newTotalInstallments = paidCount + remainingCount;

  const scheduleToInsert: RenegotiationResultItem[] = remainingScheduleRes.schedule.map(
    (item, index) => ({
      installmentNumber: paidCount + index + 1,
      dueDate: item.dueDate,
      amountCents: item.amountCents,
      principalCents: item.principalCents,
      interestCents: item.interestCents,
      remainingBalanceCents: item.remainingBalanceCents,
    }),
  );

  return {
    strategy: "amortize_remaining",
    paidCount,
    remainingCount,
    newTotalInstallments,
    balanceRefinancedCents: balanceToRefinance,
    totalPaidSoFarCents: totalPaidAmountCents,
    totalEstimatedInterestCents: remainingScheduleRes.totalInterestCents,
    firstInstallmentAmountCents: scheduleToInsert[0]?.amountCents ?? 0,
    lastInstallmentAmountCents: scheduleToInsert[scheduleToInsert.length - 1]?.amountCents ?? 0,
    scheduleToInsert,
  };
}
