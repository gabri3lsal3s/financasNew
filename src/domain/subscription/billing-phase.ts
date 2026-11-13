import type { SubscriptionStatus, SubscriptionTier } from "@/types";

/**
 * Fases canônicas do ciclo de vida de faturamento (Billing Phase).
 * Derivadas de forma determinística por função pura, sem imports de UI ou banco.
 */
export type BillingPhase =
  | "lifetime"
  | "trial_active"
  | "trial_scheduled"
  | "trial_expired"
  | "active"
  | "past_due"
  | "canceled_until_period_end"
  | "read_only";

export interface ResolveBillingPhaseInput {
  tier?: SubscriptionTier | string | null;
  status?: SubscriptionStatus | string | null;
  trialStartedAt?: string | Date | null;
  trialEndsAt?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  cancelAtPeriodEnd?: boolean | null;
  scheduledPlanId?: string | null;
  scheduledFirstChargeAt?: string | Date | null;
  pendingPlanId?: string | null;
  pendingPlanEffectiveAt?: string | Date | null;
  now?: Date;
}

/**
 * Converte com segurança uma entrada de data flexível para Date válida ou null.
 */
function toValidDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a fase de faturamento do usuário de forma pura e determinística.
 *
 * Precedência de Resolução (§5.1 do Plano 26):
 * 1. tier = 'lifetime' e status ativo -> 'lifetime'.
 * 2. tier = 'trial':
 *    - trialEndsAt > now e com scheduledFirstChargeAt / scheduledPlanId -> 'trial_scheduled';
 *    - trialEndsAt > now sem agendamento -> 'trial_active';
 *    - trialEndsAt <= now (ou expirado) -> 'trial_expired'.
 * 3. cancelAtPeriodEnd = true e currentPeriodEnd > now -> 'canceled_until_period_end'.
 * 4. status = 'past_due' e currentPeriodEnd dentro do grace period -> 'past_due'.
 * 5. tier in ('pro_monthly', 'pro_annual') e status = 'active' e currentPeriodEnd > now -> 'active'.
 * 6. Qualquer outro caso expirado ou sem assinatura -> 'read_only'.
 */
export function resolveBillingPhase(input: ResolveBillingPhaseInput): BillingPhase {
  const now = input.now ?? new Date();
  const tier = input.tier ?? null;
  const status = input.status ?? null;
  const trialEnds = toValidDate(input.trialEndsAt);
  const currentPeriodEnd = toValidDate(input.currentPeriodEnd);
  const scheduledCharge = toValidDate(input.scheduledFirstChargeAt);

  // 1. Vitalício
  if (tier === "lifetime" && status === "active") {
    return "lifetime";
  }

  // 2. Trial
  if (tier === "trial" || status === "trialing") {
    if (trialEnds && trialEnds.getTime() > now.getTime()) {
      if (input.scheduledPlanId || (scheduledCharge && scheduledCharge.getTime() >= now.getTime())) {
        return "trial_scheduled";
      }
      return "trial_active";
    }
    return "trial_expired";
  }

  // 3. Cancelamento agendado com período residual pago
  if (Boolean(input.cancelAtPeriodEnd) && currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()) {
    return "canceled_until_period_end";
  }

  // 4. Inadimplência temporária (Past Due)
  if (status === "past_due") {
    return "past_due";
  }

  // 5. Assinante Pro Ativo
  if ((tier === "pro_monthly" || tier === "pro_annual") && status === "active") {
    if (!currentPeriodEnd || currentPeriodEnd.getTime() > now.getTime()) {
      return "active";
    }
    return "read_only";
  }

  // 6. Demais estados caem em somente-leitura
  return "read_only";
}

/**
 * Avalia se o usuário na fase atual tem permissão plena de escrita no aplicativo.
 */
export function canPhaseWrite(phase: BillingPhase): boolean {
  switch (phase) {
    case "lifetime":
    case "trial_active":
    case "trial_scheduled":
    case "active":
    case "canceled_until_period_end":
    case "past_due": // Grace period de 3 dias cobre past_due
      return true;
    case "trial_expired":
    case "read_only":
    default:
      return false;
  }
}
