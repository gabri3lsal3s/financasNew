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
  DashboardAlertDismissals,
  GoalAlertDismissalCheckpoint,
  GoalAlertStage,
  PaceAlertDismissalCheckpoint,
  SurplusAlertDismissalCheckpoint,
  TimedAlertDismissalCheckpoint,
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

export const GOAL_ALERT_DEFAULT_COOLDOWN_DAYS = 30;

export interface GoalAlertEvaluationOptions {
  nowIso?: string;
  cooldownDays?: number;
}

/**
 * Avalia se o alerta da meta deve ser exibido ou se deve permanecer dispensado.
 * Retorna true se deve ser exibido (nunca dispensado, cooldown expirado OU ocorreu marco extraordinário).
 *
 * Política de Descarte com Cooldown:
 * - Permanece pelo menos `cooldownDays` (padrão 30 dias) silenciado após o descarte.
 * - Durante a janela de cooldown:
 *   - Micro-variações de saldo diário (currentCents) ou flutuações de sobra no mês (has_surplus) NÃO reativam o alerta.
 *   - Marcos extraordinários furam o cooldown:
 *     1. Redefinição de valor-alvo (targetCents alterado).
 *     2. Alteração de status (reativação, pausa).
 *     3. Conquista de 100% batido (transição para "completed" / Meta Conquistada).
 *     4. Entrada na Reta Final (transição de regular para >= 80% / "final_stretch").
 * - Após expirar a janela de cooldown (ex: 30 dias corridos), o alerta é reexibido como check-in mensal.
 */
export function shouldShowGoalAlert(
  checkpoint: GoalAlertDismissalCheckpoint | null | undefined,
  current: GoalAlertEvaluation,
  options?: GoalAlertEvaluationOptions,
): boolean {
  if (!checkpoint) {
    return true;
  }

  // 1. Mudança de Alvo (redefinição manual de valor da meta)
  if (checkpoint.targetCents !== current.targetCents) {
    return true;
  }

  // 2. Mudança de Status da Meta (reativação, pausa, etc.)
  if (checkpoint.status !== current.status) {
    return true;
  }

  // 3. Conquista de 100% batido (marco de celebração - fura o cooldown)
  if (current.stage === "completed" && checkpoint.stage !== "completed") {
    return true;
  }

  // 4. Entrada na Reta Final (transição de regular para >= 80% - fura o cooldown)
  if (
    current.stage === "final_stretch" &&
    checkpoint.stage !== "final_stretch" &&
    checkpoint.stage !== "completed"
  ) {
    return true;
  }

  // Avaliação temporal do Cooldown (padrão 30 dias corridos ou dismissedUntil explícito)
  const now = options?.nowIso ? new Date(options.nowIso) : new Date();
  const nowMs = now.getTime();

  if (checkpoint.dismissedUntil !== undefined) {
    if (nowMs < checkpoint.dismissedUntil) {
      // Dentro da janela de 7 ou 30 dias: permanece dispensado
      return false;
    }
    // Cooldown expirou: reexibe o alerta
    return true;
  }

  const cooldownDays = options?.cooldownDays ?? GOAL_ALERT_DEFAULT_COOLDOWN_DAYS;
  const dismissedDate = new Date(checkpoint.dismissedAt);
  const isDateValid = !isNaN(dismissedDate.getTime()) && !isNaN(now.getTime());

  if (isDateValid) {
    const elapsedMs = now.getTime() - dismissedDate.getTime();
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    if (elapsedMs < cooldownMs) {
      // Dentro do período de cooldown: permanece dispensado mesmo com oscilações diárias
      return false;
    }
    // Cooldown expirou: reexibe o alerta como check-in de progresso
    return true;
  }

  return false;
}

/**
 * Cria o checkpoint do estado da meta no momento do descarte.
 */
export function createGoalDismissalCheckpoint(
  goal: GoalAlertEvaluation,
  durationDaysOrNowIso?: 7 | 30 | string,
  nowIso?: string,
): GoalAlertDismissalCheckpoint {
  const durationDays = typeof durationDaysOrNowIso === "number" ? durationDaysOrNowIso : 30;
  const actualNowIso = typeof durationDaysOrNowIso === "string" ? durationDaysOrNowIso : nowIso;
  const now = actualNowIso ? new Date(actualNowIso) : new Date();
  const dismissedUntil = now.getTime() + durationDays * 24 * 60 * 60 * 1000;
  return {
    dismissedAt: now.toISOString(),
    dismissedUntil,
    currentCents: goal.currentCents,
    targetCents: goal.targetCents,
    stage: goal.stage,
    percentage: goal.percentage,
    status: goal.status,
  };
}

/**
 * Avalia se o alerta de ritmo de gastos (PaceAlertBanner) deve ser exibido.
 * Retorna true se houver virada de mês, se expirou o cooldown de 7 ou 30 dias,
 * ou (no modo legado sem prazo) se houver agravamento de >= 5% no % gasto ou entrada em déficit.
 */
export function shouldShowPaceAlert(
  checkpoint: PaceAlertDismissalCheckpoint | null | undefined,
  current: {
    month: string;
    spentPercent: number;
    surplusCents: number | null;
  },
  options?: { nowMs?: number },
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

  // 3. Avaliação temporal de Cooldown (7 dias ou 30 dias)
  const nowMs = options?.nowMs ?? Date.now();
  if (checkpoint.dismissedUntil !== undefined) {
    if (nowMs < checkpoint.dismissedUntil) {
      // Dentro da janela de 7 ou 30 dias: permanece silenciado!
      return false;
    }
    // Expirou o cooldown de 7 ou 30 dias: reavalia
    return true;
  }

  // Fallback legado (caso venha checkpoint antigo sem dismissedUntil):
  // 4. Agravamento do ritmo de gastos em 5% ou mais
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
  durationDaysOrNowIso?: 7 | 30 | string,
  nowIso?: string,
): PaceAlertDismissalCheckpoint {
  const hasDuration = typeof durationDaysOrNowIso === "number";
  const actualNowIso = typeof durationDaysOrNowIso === "string" ? durationDaysOrNowIso : nowIso;
  const now = actualNowIso ? new Date(actualNowIso) : new Date();
  const checkpoint: PaceAlertDismissalCheckpoint = {
    dismissedAt: now.toISOString(),
    month: current.month,
    spentPercent: current.spentPercent,
    surplusCents: current.surplusCents,
  };
  if (hasDuration) {
    checkpoint.dismissedUntil = now.getTime() + durationDaysOrNowIso * 24 * 60 * 60 * 1000;
  }
  return checkpoint;
}

/**
 * Avalia se o banner de capacidade de aporte (SurplusAporteBanner) deve ser exibido.
 * Retorna true se houver virada de mês ou se expirou o cooldown de 7 ou 30 dias.
 */
export function shouldShowSurplusAlert(
  checkpoint: SurplusAlertDismissalCheckpoint | null | undefined,
  current: {
    month: string;
    surplusCents: number;
  },
  options?: { nowMs?: number },
): boolean {
  if (!checkpoint) {
    return true;
  }

  // 1. Virada de mês
  if (checkpoint.month !== current.month) {
    return true;
  }

  // 2. Avaliação temporal de Cooldown (7 dias ou 30 dias)
  const nowMs = options?.nowMs ?? Date.now();
  if (checkpoint.dismissedUntil !== undefined) {
    if (nowMs < checkpoint.dismissedUntil) {
      // Dentro da janela de 7 ou 30 dias: permanece silenciado!
      return false;
    }
    // Expirou o cooldown de 7 ou 30 dias
    return true;
  }

  // Fallback legado (sem prazo definido): variação significativa de sobra estimada (>= R$ 50,00)
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
  durationDaysOrNowIso?: 7 | 30 | string,
  nowIso?: string,
): SurplusAlertDismissalCheckpoint {
  const hasDuration = typeof durationDaysOrNowIso === "number";
  const actualNowIso = typeof durationDaysOrNowIso === "string" ? durationDaysOrNowIso : nowIso;
  const now = actualNowIso ? new Date(actualNowIso) : new Date();
  const checkpoint: SurplusAlertDismissalCheckpoint = {
    dismissedAt: now.toISOString(),
    month: current.month,
    surplusCents: current.surplusCents,
  };
  if (hasDuration) {
    checkpoint.dismissedUntil = now.getTime() + durationDaysOrNowIso * 24 * 60 * 60 * 1000;
  }
  return checkpoint;
}

/**
 * Avalia se o banner de governança de teses está em período de dispensa ativa (7 ou 30 dias).
 */
export function isGovernanceAlertDismissed(
  checkpoint: { dismissedUntil?: number } | null | undefined,
  nowMs?: number,
): boolean {
  if (!checkpoint?.dismissedUntil) return false;
  const currentNow = nowMs ?? Date.now();
  return currentNow < checkpoint.dismissedUntil;
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

/**
 * Cria um checkpoint de dispensa temporária padronizada (7 ou 30 dias) para cards de carrossel.
 */
export function createTimedDismissalCheckpoint(
  days: 7 | 30 = 7,
  nowMs: number = Date.now(),
): TimedAlertDismissalCheckpoint {
  return {
    dismissedAt: new Date(nowMs).toISOString(),
    dismissedUntil: nowMs + days * 24 * 60 * 60 * 1000,
  };
}

/**
 * Retorna true se o card ainda estiver dentro da janela de dispensa (7 ou 30 dias).
 */
export function isTimedAlertDismissed(
  checkpoint: TimedAlertDismissalCheckpoint | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!checkpoint?.dismissedUntil) return false;
  return nowMs < checkpoint.dismissedUntil;
}

/**
 * Avalia elegibilidade do banner de trial na Home.
 * Permite dispensa temporária (7d/30d), mas fura o cooldown automaticamente
 * quando restarem <= 3 dias (janela crítica iminente).
 */
export function shouldShowTrialBanner(
  daysRemaining: number | null,
  hasAutoRenew: boolean,
  checkpoint: TimedAlertDismissalCheckpoint | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (hasAutoRenew || daysRemaining === null) {
    return false;
  }
  if (daysRemaining <= 3) {
    return true;
  }
  return !isTimedAlertDismissed(checkpoint, nowMs);
}

function resolveCheckpointTimestamp(
  cp: { dismissedUntil?: number; dismissedAt?: string } | undefined,
): number {
  if (!cp) return -1;
  if (typeof cp.dismissedUntil === "number" && Number.isFinite(cp.dismissedUntil)) {
    return cp.dismissedUntil;
  }
  if (cp.dismissedAt) {
    const parsed = Date.parse(cp.dismissedAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function pickNewerCheckpoint<T extends { dismissedUntil?: number; dismissedAt?: string }>(
  a?: T,
  b?: T,
): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return resolveCheckpointTimestamp(b) >= resolveCheckpointTimestamp(a) ? b : a;
}

function mergeCheckpointMap<T extends { dismissedUntil?: number; dismissedAt?: string }>(
  cloudMap?: Record<string, T>,
  localMap?: Record<string, T>,
): Record<string, T> | undefined {
  if (!cloudMap && !localMap) return undefined;
  const merged: Record<string, T> = {};
  for (const key of new Set([...Object.keys(cloudMap ?? {}), ...Object.keys(localMap ?? {})])) {
    const chosen = pickNewerCheckpoint(cloudMap?.[key], localMap?.[key]);
    if (chosen) merged[key] = chosen;
  }
  return merged;
}

/**
 * Mescla dispensas locais e da nuvem escolhendo sempre o checkpoint com expiração mais recente.
 */
export function mergeDashboardAlertDismissals(
  cloud?: DashboardAlertDismissals,
  local?: DashboardAlertDismissals,
): DashboardAlertDismissals {
  const zeroGuilt =
    cloud?.zeroGuilt && local?.zeroGuilt
      ? local.zeroGuilt.dismissedAtDate >= cloud.zeroGuilt.dismissedAtDate
        ? local.zeroGuilt
        : cloud.zeroGuilt
      : local?.zeroGuilt ?? cloud?.zeroGuilt;

  return {
    goals: mergeCheckpointMap(cloud?.goals, local?.goals) ?? {},
    pace: pickNewerCheckpoint(cloud?.pace, local?.pace),
    surplus: pickNewerCheckpoint(cloud?.surplus, local?.surplus),
    zeroGuilt,
    governance: pickNewerCheckpoint(cloud?.governance, local?.governance),
    cards: mergeCheckpointMap(cloud?.cards, local?.cards) ?? {},
  };
}
