import type { SubscriptionPlan } from "@/types";
import { PLAN_PRICES_CENTS } from "./trial";
import type { BillingPhase } from "./billing-phase";

export interface ChargeScheduleInput {
  plan: SubscriptionPlan;
  phase: BillingPhase;
  trialEndsAt?: Date | string | null;
  now?: Date;
}

export interface ResolvedChargeSchedule {
  plan: SubscriptionPlan;
  chargeTodayCents: number;
  firstBillingDate: Date;
  isDelayedByTrial: boolean;
  daysUntilFirstCharge: number;
  canUsePixToday: boolean;
  pixBlockedReason?: string;
}

/**
 * Resolve o cronograma de cobrança com autoridade total de datas e valores.
 *
 * Regras Estritas (§4.1 e §4.2 do Plano 26):
 * 1. Trial ativo: primeira cobrança adiada para o final do trial; Pix hoje bloqueado
 *    (não gerar QR Code quando não há valor a pagar hoje).
 * 2. Trial expirado / past_due / read_only: cobrança hoje imediata; Pix anual permitido.
 * 3. Assinante ativo: sem trial residual; cobrança calculada conforme o ciclo.
 */
export function resolveChargeSchedule(input: ChargeScheduleInput): ResolvedChargeSchedule {
  const now = input.now ?? new Date();
  const fullPriceCents = PLAN_PRICES_CENTS[input.plan];

  const isTrialActive = input.phase === "trial_active" || input.phase === "trial_scheduled";

  if (isTrialActive && input.trialEndsAt) {
    const trialEnds = new Date(input.trialEndsAt);
    if (!isNaN(trialEnds.getTime()) && trialEnds.getTime() > now.getTime()) {
      const diffMs = trialEnds.getTime() - now.getTime();
      const daysUntilFirstCharge = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      return {
        plan: input.plan,
        chargeTodayCents: 0,
        firstBillingDate: trialEnds,
        isDelayedByTrial: true,
        daysUntilFirstCharge,
        canUsePixToday: false,
        pixBlockedReason:
          "Durante o período de teste gratuito ativo não há valor a pagar hoje. Cadastre seu cartão para agendar a primeira cobrança para o término do teste.",
      };
    }
  }

  // Cobrança imediata no ato
  const canUsePixToday = input.plan === "annual";

  return {
    plan: input.plan,
    chargeTodayCents: fullPriceCents,
    firstBillingDate: now,
    isDelayedByTrial: false,
    daysUntilFirstCharge: 0,
    canUsePixToday,
    pixBlockedReason: input.plan === "monthly" ? "Pix disponível exclusivamente para o Plano Anual." : undefined,
  };
}
