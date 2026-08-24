/**
 * Motor Preditivo de Conclusão da Reserva de Emergência — FASE 52.
 *
 * Projeta o tempo e a data estimada para atingimento dos marcos de
 * 3, 6 e 12 meses de custo de vida com base na velocidade de poupança.
 *
 * 100% puro — sem dependências de UI ou Supabase.
 */

import { shiftMonth } from "@/lib/date";

export interface EmergencyMilestone {
  monthsOfExpenses: 3 | 6 | 12;
  targetCents: number;
  progressPercent: number;
  isReached: boolean;
  monthsRemaining: number | null;
  estimatedCompletionMonth: string | null;
}

export interface EmergencyProjectionParams {
  currentLiquidCents: number;
  monthlyExpensesCents: number;
  monthlySavingsVelocityCents: number;
  referenceMonth: string; // "YYYY-MM"
}

export interface EmergencyProjectionResult {
  monthlyExpensesCents: number;
  currentLiquidCents: number;
  currentMonthsCovered: number;
  monthlySavingsVelocityCents: number;
  milestone3m: EmergencyMilestone;
  milestone6m: EmergencyMilestone;
  milestone12m: EmergencyMilestone;
}

export function projectEmergencyFund(params: EmergencyProjectionParams): EmergencyProjectionResult {
  const { currentLiquidCents, monthlyExpensesCents, monthlySavingsVelocityCents, referenceMonth } = params;

  const currentMonthsCovered = monthlyExpensesCents > 0
    ? Number((currentLiquidCents / monthlyExpensesCents).toFixed(1))
    : 0;

  function calculateMilestone(months: 3 | 6 | 12): EmergencyMilestone {
    const targetCents = Math.round(monthlyExpensesCents * months);
    const isReached = targetCents > 0 ? currentLiquidCents >= targetCents : false;
    const progressPercent = targetCents > 0
      ? Math.min(100, Math.round((currentLiquidCents / targetCents) * 100))
      : 0;

    let monthsRemaining: number | null = null;
    let estimatedCompletionMonth: string | null = null;

    if (isReached) {
      monthsRemaining = 0;
      estimatedCompletionMonth = referenceMonth;
    } else if (monthlySavingsVelocityCents > 0 && targetCents > currentLiquidCents) {
      const remainingCents = targetCents - currentLiquidCents;
      monthsRemaining = Math.ceil(remainingCents / monthlySavingsVelocityCents);
      estimatedCompletionMonth = shiftMonth(referenceMonth, monthsRemaining);
    }

    return {
      monthsOfExpenses: months,
      targetCents,
      progressPercent,
      isReached,
      monthsRemaining,
      estimatedCompletionMonth,
    };
  }

  return {
    monthlyExpensesCents,
    currentLiquidCents,
    currentMonthsCovered,
    monthlySavingsVelocityCents,
    milestone3m: calculateMilestone(3),
    milestone6m: calculateMilestone(6),
    milestone12m: calculateMilestone(12),
  };
}
