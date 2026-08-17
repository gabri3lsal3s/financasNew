/**
 * Motor puro de cálculo de contratos de empréstimo e financiamento.
 *
 * ESPECIFICAÇÃO Módulo 5 (Empréstimos & Financiamentos).
 * Suporte a Tabela Price (parcelas fixas), SAC (parcelas decrescentes)
 * e Simulador de Amortização Extraordinária com desconto a valor presente.
 * Cálculos 100% em centavos (inteiros) e funções puras.
 */

import type { AmortizationSystem, LoanType } from "@/types";

export interface LoanScheduleInput {
  principalCents: number;
  totalInstallments: number;
  monthlyRatePercent: number; // ex: 1.5 para 1,5% a.m.
  system: AmortizationSystem;
  startDate: string; // YYYY-MM-DD
  fixedInstallmentCents?: number; // Usado quando system === 'fixed_installment'
}

export interface LoanInstallmentScheduleItem {
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  amountCents: number;
  principalCents: number;
  interestCents: number;
  remainingBalanceCents: number;
}

export interface LoanScheduleResult {
  principalCents: number;
  totalPaidCents: number;
  totalInterestCents: number;
  schedule: LoanInstallmentScheduleItem[];
}

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  personal: "Empréstimo pessoal",
  financing: "Financiamento (veículo/imóvel)",
  payroll: "Empréstimo consignado",
  other: "Outro contrato de crédito",
};

export const AMORTIZATION_SYSTEM_LABELS: Record<AmortizationSystem, string> = {
  price: "Tabela Price (parcelas fixas)",
  sac: "Tabela SAC (parcelas decrescentes)",
  fixed_installment: "Valor fixo por parcela",
};

/** Adiciona N meses a uma data YYYY-MM-DD. */
export function addMonthsToDate(dateIso: string, monthsToAdd: number): string {
  const [yStr, mStr, dStr] = dateIso.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  const totalMonths = y * 12 + (m - 1) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;

  // Clampa o dia no mês de destino (ex.: dia 31 em fev -> 28/29)
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const clampedDay = Math.min(d, lastDay);

  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/**
 * Gera o cronograma completo de parcelas de um empréstimo/financiamento.
 */
export function calculateLoanSchedule(input: LoanScheduleInput): LoanScheduleResult {
  const pv = Math.max(0, Math.round(input.principalCents));
  const n = Math.max(1, Math.min(420, Math.floor(input.totalInstallments)));
  const rate = Math.max(0, input.monthlyRatePercent) / 100;

  if (pv === 0) {
    return {
      principalCents: 0,
      totalPaidCents: 0,
      totalInterestCents: 0,
      schedule: [],
    };
  }

  const schedule: LoanInstallmentScheduleItem[] = [];
  let balance = pv;
  let totalPaidCents = 0;
  let totalInterestCents = 0;

  if (input.system === "sac") {
    // SAC: Amortização constante A = PV / n
    const baseAmortization = Math.floor(pv / n);
    const amortRemainder = pv % n;

    for (let i = 1; i <= n; i++) {
      const amortization = baseAmortization + (i <= amortRemainder ? 1 : 0);
      const interest = Math.round(balance * rate);
      const installmentTotal = amortization + interest;
      balance = Math.max(0, balance - amortization);

      totalPaidCents += installmentTotal;
      totalInterestCents += interest;

      schedule.push({
        installmentNumber: i,
        dueDate: addMonthsToDate(input.startDate, i),
        amountCents: installmentTotal,
        principalCents: amortization,
        interestCents: interest,
        remainingBalanceCents: balance,
      });
    }
  } else if (input.system === "fixed_installment" && input.fixedInstallmentCents && input.fixedInstallmentCents > 0) {
    // Parcela fixa informada pelo usuário
    const pmt = Math.round(input.fixedInstallmentCents);
    for (let i = 1; i <= n; i++) {
      const interest = Math.round(balance * rate);
      let principal = Math.max(0, pmt - interest);
      if (i === n || principal > balance) {
        principal = balance;
      }
      const actualPmt = i === n ? balance + interest : pmt;
      balance = Math.max(0, balance - principal);

      totalPaidCents += actualPmt;
      totalInterestCents += interest;

      schedule.push({
        installmentNumber: i,
        dueDate: addMonthsToDate(input.startDate, i),
        amountCents: actualPmt,
        principalCents: principal,
        interestCents: interest,
        remainingBalanceCents: balance,
      });
    }
  } else {
    // Price padrão: parcelas constantes
    const pmt =
      rate === 0
        ? Math.floor(pv / n)
        : Math.round((pv * (rate * Math.pow(1 + rate, n))) / (Math.pow(1 + rate, n) - 1));

    for (let i = 1; i <= n; i++) {
      const interest = Math.round(balance * rate);
      let principal = Math.max(0, pmt - interest);
      if (i === n) {
        principal = balance; // Ajuste na última parcela para zerar saldo
      }
      const actualPmt = principal + interest;
      balance = Math.max(0, balance - principal);

      totalPaidCents += actualPmt;
      totalInterestCents += interest;

      schedule.push({
        installmentNumber: i,
        dueDate: addMonthsToDate(input.startDate, i),
        amountCents: actualPmt,
        principalCents: principal,
        interestCents: interest,
        remainingBalanceCents: balance,
      });
    }
  }

  return {
    principalCents: pv,
    totalPaidCents,
    totalInterestCents,
    schedule,
  };
}

export interface EarlyAmortizationInputItem {
  id: string;
  installmentNumber: number;
  amountCents: number;
  dueDate: string;
}

export interface EarlyAmortizationResult {
  eliminatedInstallmentIds: string[];
  totalOriginalAmountCents: number;
  totalPresentValuePaidCents: number;
  totalDiscountCents: number;
}

/**
 * Calcula a antecipação de parcelas futuras com desconto a valor presente.
 * Desconta as parcelas de trás para frente (maior economia de juros).
 */
export function calculateEarlyAmortization(
  remainingInstallments: readonly EarlyAmortizationInputItem[],
  monthlyRatePercent: number,
  targetPaymentCents: number,
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): EarlyAmortizationResult {
  const rate = Math.max(0, monthlyRatePercent) / 100;
  const budget = Math.max(0, Math.round(targetPaymentCents));

  if (budget === 0 || remainingInstallments.length === 0) {
    return {
      eliminatedInstallmentIds: [],
      totalOriginalAmountCents: 0,
      totalPresentValuePaidCents: 0,
      totalDiscountCents: 0,
    };
  }

  // Ordena parcelas pendentes da última para a primeira (elimina o final do contrato)
  const sorted = [...remainingInstallments].sort(
    (a, b) => b.installmentNumber - a.installmentNumber
  );

  let accumulatedPv = 0;
  let accumulatedNominal = 0;
  const eliminatedIds: string[] = [];

  const [refY, refM] = referenceDateIso.split("-").map(Number);
  const refTotalMonths = (refY ?? 0) * 12 + ((refM ?? 1) - 1);

  for (const item of sorted) {
    const [dueY, dueM] = item.dueDate.split("-").map(Number);
    const dueTotalMonths = (dueY ?? 0) * 12 + ((dueM ?? 1) - 1);
    const monthsAhead = Math.max(1, dueTotalMonths - refTotalMonths);

    // Valor presente: VP = VF / (1 + i)^t
    let presentValue = item.amountCents;
    if (rate > 0) {
      presentValue = Math.round(item.amountCents / Math.pow(1 + rate, monthsAhead));
    }

    if (accumulatedPv + presentValue <= budget) {
      accumulatedPv += presentValue;
      accumulatedNominal += item.amountCents;
      eliminatedIds.push(item.id);
    } else {
      // Orçamento insuficiente para a próxima parcela completa
      break;
    }
  }

  const totalDiscountCents = Math.max(0, accumulatedNominal - accumulatedPv);

  return {
    eliminatedInstallmentIds: eliminatedIds,
    totalOriginalAmountCents: accumulatedNominal,
    totalPresentValuePaidCents: accumulatedPv,
    totalDiscountCents,
  };
}
