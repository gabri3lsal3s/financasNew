/**
 * Motor Preditivo de Reserva de Emergência — Domínio de Projeção.
 *
 * Projeta o tempo e a data estimada para atingimento dos marcos de
 * 3, 6 e 12 meses de custo de vida com base no capital acumulado e
 * na velocidade de poupança mensal.
 *
 * 100% puro — sem dependências de UI, DOM ou Supabase.
 */

import { shiftMonth } from "@/lib/date";

export type EmergencyHealth = "critico" | "baixo" | "adequado" | "saudavel";

export const EMERGENCY_HEALTH_LABELS: Record<EmergencyHealth, string> = {
  critico: "Crítico",
  baixo: "Baixo",
  adequado: "Adequado",
  saudavel: "Saudável",
};

export interface EmergencyMilestone {
  monthsOfExpenses: 3 | 6 | 12;
  targetCents: number;
  progressPercent: number;
  isReached: boolean;
  monthsRemaining: number | null;
  estimatedCompletionMonth: string | null;
}

export interface EmergencyProjectionParams {
  /** Saldo acumulado destinado à reserva (centavos). */
  currentLiquidCents: number;
  /** Custo de vida mensal de referência (centavos). */
  monthlyExpensesCents: number;
  /** Velocidade / aporte mensal destinado à reserva (centavos). */
  monthlySavingsVelocityCents: number;
  /** Mês de referência no formato "YYYY-MM". */
  referenceMonth: string;
}

export interface EmergencyProjectionResult {
  monthlyExpensesCents: number;
  currentLiquidCents: number;
  currentMonthsCovered: number;
  health: EmergencyHealth;
  monthlySavingsVelocityCents: number;
  milestone3m: EmergencyMilestone;
  milestone6m: EmergencyMilestone;
  milestone12m: EmergencyMilestone;
}

/**
 * Classifica a saúde da reserva com base nos meses de custo de vida cobertos:
 *   - < 3 meses: crítico
 *   - 3 a 5.9 meses: baixo
 *   - 6 a 11.9 meses: adequado
 *   - >= 12 meses: saudável
 */
export function classifyEmergencyHealth(monthsCovered: number): EmergencyHealth {
  if (monthsCovered < 3) return "critico";
  if (monthsCovered < 6) return "baixo";
  if (monthsCovered < 12) return "adequado";
  return "saudavel";
}

/**
 * Calcula os marcos e projeção da Reserva de Emergência.
 */
export function calculateEmergencyFund(params: EmergencyProjectionParams): EmergencyProjectionResult {
  const { currentLiquidCents, monthlyExpensesCents, monthlySavingsVelocityCents, referenceMonth } = params;

  const validLiquid = Math.max(0, currentLiquidCents);
  const validExpenses = Math.max(0, monthlyExpensesCents);
  const validSavings = Math.max(0, monthlySavingsVelocityCents);

  const currentMonthsCovered = validExpenses > 0
    ? Number((validLiquid / validExpenses).toFixed(1))
    : 0;

  const health = classifyEmergencyHealth(currentMonthsCovered);

  function calculateMilestone(months: 3 | 6 | 12): EmergencyMilestone {
    const targetCents = Math.round(validExpenses * months);
    const isReached = targetCents > 0 ? validLiquid >= targetCents : false;
    const progressPercent = targetCents > 0
      ? Math.min(100, Math.round((validLiquid / targetCents) * 100))
      : 0;

    let monthsRemaining: number | null = null;
    let estimatedCompletionMonth: string | null = null;

    if (isReached) {
      monthsRemaining = 0;
      estimatedCompletionMonth = referenceMonth;
    } else if (validSavings > 0 && targetCents > validLiquid) {
      const remainingCents = targetCents - validLiquid;
      monthsRemaining = Math.ceil(remainingCents / validSavings);
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
    monthlyExpensesCents: validExpenses,
    currentLiquidCents: validLiquid,
    currentMonthsCovered,
    health,
    monthlySavingsVelocityCents: validSavings,
    milestone3m: calculateMilestone(3),
    milestone6m: calculateMilestone(6),
    milestone12m: calculateMilestone(12),
  };
}

// Alias de retrocompatibilidade
export const projectEmergencyFund = calculateEmergencyFund;
