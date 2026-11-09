import type { SubscriptionPlan, SubscriptionTier } from "@/types";
import { PLAN_CONFIGS } from "./plans";

export interface TrialResidualResult {
  /** Quantidade inteira de dias restantes de teste (0 quando expirado). */
  daysRemaining: number;
  /** Se o período de teste de 30 dias já foi totalmente consumido. */
  isExpired: boolean;
  /** Data exata de encerramento do trial. */
  trialEndsDate: Date;
}

export interface BillingScheduleResult {
  /** Valor monetário a ser cobrado HOJE em centavos (0 se estiver em trial ativo). */
  chargeTodayCents: number;
  /** Data prevista para a primeira cobrança efetiva no cartão. */
  firstBillingDate: Date;
  /** Se a primeira cobrança foi diferida para o término do trial. */
  isDelayedByTrial: boolean;
  /** Quantidade de dias até o primeiro débito. */
  daysUntilFirstCharge: number;
}

/**
 * Duração padrão do período de teste gratuito por conta (30 dias).
 */
export const STANDARD_TRIAL_DAYS = 30;


/**
 * Preços canônicos em centavos.
 */
export const PLAN_PRICES_CENTS: Record<SubscriptionPlan, number> = {
  monthly: PLAN_CONFIGS.monthly.priceCents, // R$ 19,99
  annual: PLAN_CONFIGS.annual.priceCents, // R$ 143,88
};

/**
 * Calcula o período residual de teste a partir da data de criação ou data de término já gravada.
 */
export function calculateTrialResidual(params: {
  createdAt: string | Date;
  trialEndsAt?: string | Date | null;
  now?: Date;
}): TrialResidualResult {
  const now = params.now ?? new Date();

  let trialEndsDate: Date;
  if (params.trialEndsAt) {
    trialEndsDate = new Date(params.trialEndsAt);
  } else {
    const created = new Date(params.createdAt);
    trialEndsDate = new Date(created.getTime() + STANDARD_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  }

  const diffMs = trialEndsDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, diffDays);

  return {
    daysRemaining,
    isExpired: daysRemaining <= 0,
    trialEndsDate,
  };
}

/**
 * Resolve o cronograma de cobrança no checkout com base no plano escolhido,
 * no tier atual do usuário e nos dias residuais de trial disponíveis.
 */
export function resolveCheckoutBillingSchedule(params: {
  plan: SubscriptionPlan;
  currentTier?: SubscriptionTier | null;
  trialDaysRemaining?: number | null;
  hasAlreadyPaid?: boolean;
  now?: Date;
}): BillingScheduleResult {
  const now = params.now ?? new Date();
  const fullPriceCents = PLAN_PRICES_CENTS[params.plan];

  // Se o usuário já é assinante ativo pagante ou se o tier é read_only/expirado,
  // ou se ele já consumiu os 30 dias de trial, a cobrança é IMEDIATA.
  const isPaidSubscriber =
    params.currentTier === "pro_monthly" ||
    params.currentTier === "pro_annual" ||
    params.currentTier === "lifetime" ||
    Boolean(params.hasAlreadyPaid);

  const availableTrialDays = isPaidSubscriber
    ? 0
    : Math.max(0, params.trialDaysRemaining ?? STANDARD_TRIAL_DAYS);

  if (availableTrialDays > 0) {
    // Cobrança adiada para o final do trial restante
    const firstBillingDate = new Date(
      now.getTime() + availableTrialDays * 24 * 60 * 60 * 1000,
    );
    return {
      chargeTodayCents: 0,
      firstBillingDate,
      isDelayedByTrial: true,
      daysUntilFirstCharge: availableTrialDays,
    };
  }

  // Cobrança imediata no ato
  return {
    chargeTodayCents: fullPriceCents,
    firstBillingDate: now,
    isDelayedByTrial: false,
    daysUntilFirstCharge: 0,
  };
}

export interface GuaranteeResidualResult {
  /** Se o usuário está dentro da janela legal incondicional de 7 dias (CDC). */
  isWithinGuarantee: boolean;
  /** Quantidade de dias restantes da garantia de 7 dias (0 se expirado). */
  daysRemaining: number;
}

export const GUARANTEE_DAYS = 7;

/**
 * Calcula a janela de garantia incondicional de 7 dias (CDC Art. 49).
 */
export function calculateGuaranteeResidual(params: {
  startsAt?: string | Date | null;
  isPro?: boolean;
  now?: Date;
}): GuaranteeResidualResult {
  if (!params.isPro || !params.startsAt) {
    return { isWithinGuarantee: false, daysRemaining: 0 };
  }

  const startDate = new Date(params.startsAt);
  if (isNaN(startDate.getTime())) {
    return { isWithinGuarantee: false, daysRemaining: 0 };
  }

  const now = params.now ?? new Date();
  const startTime = startDate.getTime();
  const nowTime = now.getTime();

  if (nowTime < startTime) {
    return { isWithinGuarantee: true, daysRemaining: GUARANTEE_DAYS };
  }

  const elapsedMs = nowTime - startTime;
  const totalGuaranteeMs = GUARANTEE_DAYS * 24 * 60 * 60 * 1000;

  if (elapsedMs > totalGuaranteeMs) {
    return { isWithinGuarantee: false, daysRemaining: 0 };
  }

  const remainingMs = totalGuaranteeMs - elapsedMs;
  const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

  return {
    isWithinGuarantee: true,
    daysRemaining,
  };
}

