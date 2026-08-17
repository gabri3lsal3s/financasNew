/**
 * Motor puro de cálculo de parcelamento de fatura de cartão de crédito.
 *
 * ESPECIFICAÇÃO §3.3 e Módulo de Assistente de Fatura.
 * Cálculos 100% em centavos (inteiros) e competências em snapshot YYYY-MM.
 */

export interface BillRefinanceInput {
  remainingBalanceCents: number;
  installmentsCount: number;
  monthlyInterestRatePercent: number; // ex: 3.5 para 3,5% a.m.
  firstCompetenceMonth: string; // YYYY-MM
}

export interface RefinanceInstallmentItem {
  installmentNumber: number;
  installmentsTotal: number;
  billCompetence: string; // YYYY-MM
  date: string; // YYYY-MM-DD estimada para a competência
  amountCents: number;
  interestCents: number;
  principalCents: number;
}

export interface BillRefinancePlanResult {
  originalBalanceCents: number;
  totalWithInterestCents: number;
  totalInterestCents: number;
  monthlyInterestRatePercent: number;
  installments: RefinanceInstallmentItem[];
}

/** Avança um mês no formato YYYY-MM. */
export function addMonthsToCompetence(competence: string, monthsToAdd: number): string {
  const [yearStr, monthStr] = competence.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;

  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/**
 * Calcula o plano de parcelamento de saldo remanescente de fatura.
 */
export function calculateBillRefinancePlan(input: BillRefinanceInput): BillRefinancePlanResult {
  const pv = Math.max(0, Math.round(input.remainingBalanceCents));
  const n = Math.max(1, Math.min(60, Math.floor(input.installmentsCount)));
  const rate = Math.max(0, input.monthlyInterestRatePercent) / 100;

  if (pv === 0) {
    return {
      originalBalanceCents: 0,
      totalWithInterestCents: 0,
      totalInterestCents: 0,
      monthlyInterestRatePercent: input.monthlyInterestRatePercent,
      installments: [],
    };
  }

  const installmentCents =
    rate === 0
      ? Math.floor(pv / n)
      : Math.round((pv * (rate * Math.pow(1 + rate, n))) / (Math.pow(1 + rate, n) - 1));

  const totalWithInterestCents = installmentCents * n;
  const totalInterestCents = Math.max(0, totalWithInterestCents - pv);

  // Divide o juro total proporcionalmente entre as parcelas
  const interestPerInstallment = Math.floor(totalInterestCents / n);
  const interestRemainder = totalInterestCents % n;

  // Divide o principal proporcionalmente
  const principalPerInstallment = Math.floor(pv / n);
  const principalRemainder = pv % n;

  const installments: RefinanceInstallmentItem[] = [];

  for (let i = 1; i <= n; i++) {
    const comp = addMonthsToCompetence(input.firstCompetenceMonth, i);
    // Distribui restos nas primeiras parcelas
    const currInterest = interestPerInstallment + (i <= interestRemainder ? 1 : 0);
    const currPrincipal = principalPerInstallment + (i <= principalRemainder ? 1 : 0);
    const currTotal = currInterest + currPrincipal;

    installments.push({
      installmentNumber: i,
      installmentsTotal: n,
      billCompetence: comp,
      date: `${comp}-10`,
      amountCents: currTotal,
      interestCents: currInterest,
      principalCents: currPrincipal,
    });
  }

  return {
    originalBalanceCents: pv,
    totalWithInterestCents,
    totalInterestCents,
    monthlyInterestRatePercent: input.monthlyInterestRatePercent,
    installments,
  };
}
