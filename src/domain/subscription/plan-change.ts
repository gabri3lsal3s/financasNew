import type { SubscriptionPlan } from "@/types";

export interface PlanChangeRequestInput {
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  currentPeriodEnd: Date | string | null;
  now?: Date;
}

export interface PlanChangeScheduleResult {
  canSchedule: boolean;
  fromPlan: SubscriptionPlan;
  toPlan: SubscriptionPlan;
  effectiveAt: Date | null;
  reason?: string;
}

/**
 * Resolve o agendamento de troca de plano (Mensal <-> Anual).
 *
 * Regra Estrita (§4.3 do Plano 26):
 * - A alteração de ciclo tem efeito EXCLUSIVAMENTE na próxima renovação.
 * - Sem cobrança proporcional, sem crédito retroativo e sem mudança imediata no gateway.
 * - O usuário mantém o plano e período atual até a data efetiva (`current_period_end`).
 */
export function schedulePlanChange(input: PlanChangeRequestInput): PlanChangeScheduleResult {
  const now = input.now ?? new Date();

  if (input.currentPlan === input.targetPlan) {
    return {
      canSchedule: false,
      fromPlan: input.currentPlan,
      toPlan: input.targetPlan,
      effectiveAt: null,
      reason: "O plano de destino é idêntico ao plano atual.",
    };
  }

  if (!input.currentPeriodEnd) {
    return {
      canSchedule: false,
      fromPlan: input.currentPlan,
      toPlan: input.targetPlan,
      effectiveAt: null,
      reason: "Assinatura sem data de vigência para agendamento.",
    };
  }

  const effectiveAt = new Date(input.currentPeriodEnd);
  if (isNaN(effectiveAt.getTime()) || effectiveAt.getTime() <= now.getTime()) {
    return {
      canSchedule: false,
      fromPlan: input.currentPlan,
      toPlan: input.targetPlan,
      effectiveAt: null,
      reason: "A data de término do período atual já expirou.",
    };
  }

  return {
    canSchedule: true,
    fromPlan: input.currentPlan,
    toPlan: input.targetPlan,
    effectiveAt,
  };
}

/**
 * Valida se um cancelamento de mudança de plano agendada ainda é permitido.
 */
export function canCancelPlanChange(effectiveAt: Date | string | null, now = new Date()): boolean {
  if (!effectiveAt) return false;
  const d = new Date(effectiveAt);
  return !isNaN(d.getTime()) && d.getTime() > now.getTime();
}
