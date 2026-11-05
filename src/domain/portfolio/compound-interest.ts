/**
 * Motor puro de cálculo de Juros Compostos e Projeção de Independência Financeira (FIRE).
 *
 * Utilizado por simuladores públicos e ferramentas abertas de planejamento.
 * Cálculos 100% determinísticos em centavos inteiros (AGENTS.md §3).
 */

export interface CompoundInterestInput {
  initialAmountCents: number;
  monthlyContributionCents: number;
  annualRatePercent: number; // ex: 10 para 10% ao ano
  periodYears: number; // ex: 15 anos
  monthlyLivingCostCents?: number; // Custo de vida mensal para cálculo de independência financeira (FIRE)
}

export interface YearProjectionSnapshot {
  year: number;
  balanceCents: number;
  contributedCents: number;
  interestEarnedThisYearCents: number;
  totalInterestCents: number;
  monthlyPassiveIncomeCents: number;
}

export interface CompoundInterestResult {
  finalBalanceCents: number;
  totalContributedCents: number;
  totalInterestCents: number;
  monthlyPassiveIncomeCents: number;
  doublingTimeYears: number | null;
  /** Ano e mês em que o rendimento mensal de juros ultrapassa o valor do aporte mensal */
  interestExceedsContributionAt: { year: number; month: number } | null;
  /** Ano e mês em que a renda passiva estimada atinge o custo de vida desejado (FIRE) */
  fireReachedAt: { year: number; month: number } | null;
  yearsTimeline: YearProjectionSnapshot[];
}

/**
 * Converte taxa de juros anual para taxa mensal equivalente (juros compostos exatos).
 * i_m = (1 + i_a)^(1/12) - 1
 */
export function annualRateToMonthlyRate(annualRatePercent: number): number {
  if (annualRatePercent <= 0) return 0;
  return Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
}

/**
 * Simula a evolução patrimonial mês a mês com aportes e juros compostos.
 */
export function calculateCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  const initial = Math.max(0, Math.round(input.initialAmountCents));
  const contribution = Math.max(0, Math.round(input.monthlyContributionCents));
  const annualRate = Math.max(0, input.annualRatePercent);
  const years = Math.max(1, Math.min(60, Math.round(input.periodYears)));
  const monthlyRate = annualRateToMonthlyRate(annualRate);
  const targetMonthlyCost = input.monthlyLivingCostCents && input.monthlyLivingCostCents > 0
    ? Math.round(input.monthlyLivingCostCents)
    : null;

  let balance = initial;
  let totalContributed = initial;
  let totalInterest = 0;

  let interestExceedsContributionAt: { year: number; month: number } | null = null;
  let fireReachedAt: { year: number; month: number } | null = null;

  const yearsTimeline: YearProjectionSnapshot[] = [
    {
      year: 0,
      balanceCents: initial,
      contributedCents: initial,
      interestEarnedThisYearCents: 0,
      totalInterestCents: 0,
      monthlyPassiveIncomeCents: Math.round(initial * monthlyRate),
    },
  ];

  for (let y = 1; y <= years; y++) {
    let accumulatedInterestYear = 0;

    for (let m = 1; m <= 12; m++) {
      const monthInterest = Math.round(balance * monthlyRate);
      balance += monthInterest;
      totalInterest += monthInterest;
      accumulatedInterestYear += monthInterest;

      // Ponto de inflexão: rendimento mensal supera o aporte realizado
      if (
        !interestExceedsContributionAt &&
        contribution > 0 &&
        monthInterest >= contribution
      ) {
        interestExceedsContributionAt = { year: y, month: m };
      }

      // Ponto FIRE: renda passiva mensal cobre o custo de vida almejado
      const currentPassiveIncome = Math.round(balance * monthlyRate);
      if (!fireReachedAt && targetMonthlyCost !== null && currentPassiveIncome >= targetMonthlyCost) {
        fireReachedAt = { year: y, month: m };
      }

      balance += contribution;
      totalContributed += contribution;
    }

    const yearPassiveIncome = Math.round(balance * monthlyRate);

    yearsTimeline.push({
      year: y,
      balanceCents: balance,
      contributedCents: totalContributed,
      interestEarnedThisYearCents: accumulatedInterestYear,
      totalInterestCents: totalInterest,
      monthlyPassiveIncomeCents: yearPassiveIncome,
    });
  }

  // Regra dos 72 para tempo de duplicação do capital
  const doublingTimeYears = annualRate > 0 ? Math.round((72 / annualRate) * 10) / 10 : null;
  const finalMonthlyPassive = Math.round(balance * monthlyRate);

  return {
    finalBalanceCents: balance,
    totalContributedCents: totalContributed,
    totalInterestCents: totalInterest,
    monthlyPassiveIncomeCents: finalMonthlyPassive,
    doublingTimeYears,
    interestExceedsContributionAt,
    fireReachedAt,
    yearsTimeline,
  };
}
