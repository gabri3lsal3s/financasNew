/**
 * Motor Puro de Elegibilidade e Descarte Inteligente de Alertas (§Fase Overview).
 *
 * Determina se um card ou alerta dispensado deve permanecer oculto ou se houve
 * alguma mudança relevante (aporte realizado, meta batida, virada de mês,
 * agravamento do ritmo de gastos ou variação significativa de sobra)
 * que justifique sua reativação imediata.
 *
 * 100% puro — sem dependências de UI, DOM ou Supabase.
 */

import type {
  GoalAlertDismissalCheckpoint,
  GoalAlertStage,
  PaceAlertDismissalCheckpoint,
  SurplusAlertDismissalCheckpoint,
  ZeroGuiltDismissalCheckpoint,
} from "@/types/schema";

export interface GoalAlertEvaluation {
  goalId: string;
  currentCents: number;
  targetCents: number;
  percentage: number;
  stage: GoalAlertStage;
  status?: string;
}

/**
 * Avalia se o alerta da meta deve ser exibido ou se deve permanecer dispensado.
 * Retorna true se deve ser exibido (nunca dispensado OU ocorreu mudança relevante).
 */
export function shouldShowGoalAlert(
  checkpoint: GoalAlertDismissalCheckpoint | null | undefined,
  current: GoalAlertEvaluation,
): boolean {
  if (!checkpoint) {
    return true;
  }

  // 1. Mudança de Alvo (redefinição de valor da meta)
  if (checkpoint.targetCents !== current.targetCents) {
    return true;
  }

  // 2. Mudança de Saldo Acumulado (novo aporte realizado ou retirada)
  if (checkpoint.currentCents !== current.currentCents) {
    return true;
  }

  // 3. Mudança de Status da Meta (reativação, pausa, etc.)
  if (checkpoint.status !== current.status) {
    return true;
  }

  // 4. Mudança de Estágio / Marco Cognitivo
  if (checkpoint.stage !== current.stage) {
    // Transição para Conquistada (100% batido)
    if (current.stage === "completed") {
      return true;
    }
    // Transição para Reta Final (>= 80%) a partir de ritmo inicial ou sobra
    if (current.stage === "final_stretch") {
      return true;
    }
    // Qualquer outra mudança de estágio estrutural
    return true;
  }

  // Se nenhum dado relevante mudou, o alerta permanece dispensado
  return false;
}

/**
 * Cria o checkpoint do estado da meta no momento do descarte.
 */
export function createGoalDismissalCheckpoint(
  goal: GoalAlertEvaluation,
  nowIso?: string,
): GoalAlertDismissalCheckpoint {
  return {
    dismissedAt: nowIso ?? new Date().toISOString(),
    currentCents: goal.currentCents,
    targetCents: goal.targetCents,
    stage: goal.stage,
    percentage: goal.percentage,
    status: goal.status,
  };
}

/**
 * Avalia se o alerta de ritmo de gastos (PaceAlertBanner) deve ser exibido.
 * Retorna true se houver virada de mês, agravamento de >= 5% no % gasto ou entrada em déficit.
 */
export function shouldShowPaceAlert(
  checkpoint: PaceAlertDismissalCheckpoint | null | undefined,
  current: {
    month: string;
    spentPercent: number;
    surplusCents: number | null;
  },
): boolean {
  if (!checkpoint) {
    return true;
  }

  // 1. Virada de mês
  if (checkpoint.month !== current.month) {
    return true;
  }

  // 2. Entrada em déficit projetado (surplus < 0 quando antes era superávit/nulo)
  const prevWasDeficit = checkpoint.surplusCents !== null && checkpoint.surplusCents < 0;
  const currentIsDeficit = current.surplusCents !== null && current.surplusCents < 0;
  if (!prevWasDeficit && currentIsDeficit) {
    return true;
  }

  // 3. Agravamento do ritmo de gastos em 5% ou mais
  if (current.spentPercent - checkpoint.spentPercent >= 5) {
    return true;
  }

  return false;
}

/**
 * Cria o checkpoint de descarte do PaceAlertBanner.
 */
export function createPaceDismissalCheckpoint(
  current: {
    month: string;
    spentPercent: number;
    surplusCents: number | null;
  },
  nowIso?: string,
): PaceAlertDismissalCheckpoint {
  return {
    dismissedAt: nowIso ?? new Date().toISOString(),
    month: current.month,
    spentPercent: current.spentPercent,
    surplusCents: current.surplusCents,
  };
}

/**
 * Avalia se o banner de capacidade de aporte (SurplusAporteBanner) deve ser exibido.
 * Retorna true se houver virada de mês ou variação de >= R$ 50,00 (5000 centavos) na sobra.
 */
export function shouldShowSurplusAlert(
  checkpoint: SurplusAlertDismissalCheckpoint | null | undefined,
  current: {
    month: string;
    surplusCents: number;
  },
): boolean {
  if (!checkpoint) {
    return true;
  }

  // 1. Virada de mês
  if (checkpoint.month !== current.month) {
    return true;
  }

  // 2. Variação significativa de sobra estimada (>= R$ 50,00)
  if (Math.abs(current.surplusCents - checkpoint.surplusCents) >= 5000) {
    return true;
  }

  return false;
}

/**
 * Cria o checkpoint de descarte do SurplusAporteBanner.
 */
export function createSurplusDismissalCheckpoint(
  current: {
    month: string;
    surplusCents: number;
  },
  nowIso?: string,
): SurplusAlertDismissalCheckpoint {
  return {
    dismissedAt: nowIso ?? new Date().toISOString(),
    month: current.month,
    surplusCents: current.surplusCents,
  };
}

/**
 * Avalia se o banner de alinhamento em 60s (Zero Guilt) deve ser exibido.
 * Retorna true se virou o dia civil ou ainda não foi dispensado hoje.
 */
export function shouldShowZeroGuiltAlert(
  checkpoint: ZeroGuiltDismissalCheckpoint | null | undefined,
  todayDate: string,
): boolean {
  if (!checkpoint) {
    return true;
  }
  return checkpoint.dismissedAtDate !== todayDate;
}

/**
 * Cria o checkpoint de descarte do ZeroGuilt.
 */
export function createZeroGuiltDismissalCheckpoint(
  todayDate: string,
): ZeroGuiltDismissalCheckpoint {
  return {
    dismissedAtDate: todayDate,
  };
}
