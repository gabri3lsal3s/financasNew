/**
 * Conversor de Impacto FIRE ("O Custo do Hábito na Aposentadoria") — FASE 52.
 *
 * Demonstra quanto a economia de um gasto supérfluo ou assinatura recorrente
 * capitaliza no longo prazo e quantos anos/meses antecipa a independência financeira.
 *
 * 100% puro — sem dependências de UI ou Supabase.
 */

import { DEFAULT_REAL_RETURN_RATE, fireProjection } from "./index";

export interface HabitFireImpactParams {
  habitMonthlyCostCents: number;
  baselineAnnualExpensesCents: number;
  baselineInitialCapitalCents: number;
  baselineMonthlyContributionCents: number;
  realReturnRate?: number;
}

export interface HabitFireImpactResult {
  habitMonthlyCostCents: number;
  habitAnnualCostCents: number;
  /** Valor futuro capitalizado do valor poupado em 10, 20 e 30 anos (centavos). */
  futureValue10yCents: number;
  futureValue20yCents: number;
  futureValue30yCents: number;
  /** Redução na meta patrimonial FIRE necessária (25x a despesa anual economizada). */
  fireTargetReductionCents: number;
  /** Anos até a meta FIRE no cenário base. */
  baselineYearsToFire: number | null;
  /** Anos até a meta FIRE no cenário otimizado (revertendo o gasto em aporte). */
  optimizedYearsToFire: number | null;
  /** Total de anos antecipados na conquista da independência financeira. */
  yearsSaved: number;
  /** Mensagem resumida em pt-BR. */
  impactSummary: string;
}

function calculateFutureValue(monthlyCents: number, years: number, realRate: number): number {
  let capital = 0;
  const yearlyContribution = monthlyCents * 12;
  for (let y = 1; y <= years; y++) {
    capital = Math.round((capital + yearlyContribution) * (1 + realRate));
  }
  return capital;
}

export function calculateHabitFireImpact(params: HabitFireImpactParams): HabitFireImpactResult {
  const {
    habitMonthlyCostCents,
    baselineAnnualExpensesCents,
    baselineInitialCapitalCents,
    baselineMonthlyContributionCents,
    realReturnRate = DEFAULT_REAL_RETURN_RATE,
  } = params;

  const habitAnnualCostCents = habitMonthlyCostCents * 12;
  const fireTargetReductionCents = habitAnnualCostCents * 25;

  const futureValue10yCents = calculateFutureValue(habitMonthlyCostCents, 10, realReturnRate);
  const futureValue20yCents = calculateFutureValue(habitMonthlyCostCents, 20, realReturnRate);
  const futureValue30yCents = calculateFutureValue(habitMonthlyCostCents, 30, realReturnRate);

  const baseline = fireProjection({
    annualExpensesCents: baselineAnnualExpensesCents,
    initialCapitalCents: baselineInitialCapitalCents,
    monthlyContributionCents: baselineMonthlyContributionCents,
    realReturnRate,
  });

  const optimizedExpenses = Math.max(0, baselineAnnualExpensesCents - habitAnnualCostCents);
  const optimizedContribution = baselineMonthlyContributionCents + habitMonthlyCostCents;

  const optimized = fireProjection({
    annualExpensesCents: optimizedExpenses,
    initialCapitalCents: baselineInitialCapitalCents,
    monthlyContributionCents: optimizedContribution,
    realReturnRate,
  });

  let yearsSaved = 0;
  if (baseline.yearsToFire !== null && optimized.yearsToFire !== null) {
    yearsSaved = Math.max(0, baseline.yearsToFire - optimized.yearsToFire);
  }

  const impactSummary =
    yearsSaved > 0
      ? `Converter essa economia em aporte reduz sua meta FIRE e antecipa sua independência em cerca de ${yearsSaved} ${yearsSaved === 1 ? "ano" : "anos"}.`
      : `Essa economia acumula um patrimônio relevante no longo prazo e reduz sua meta necessária de independência.`;

  return {
    habitMonthlyCostCents,
    habitAnnualCostCents,
    futureValue10yCents,
    futureValue20yCents,
    futureValue30yCents,
    fireTargetReductionCents,
    baselineYearsToFire: baseline.yearsToFire,
    optimizedYearsToFire: optimized.yearsToFire,
    yearsSaved,
    impactSummary,
  };
}
