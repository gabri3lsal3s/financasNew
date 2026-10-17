import type { SubscriptionPlan, SubscriptionTier } from "@/types";

export interface PlanDetails {
  plan: SubscriptionPlan;
  tier: SubscriptionTier;
  title: string;
  priceCents: number;
  monthlyEquivalentCents: number;
  interval: "month" | "year";
  intervalMonths: number;
  discountPercentage: number;
  description: string;
  badge: string | null;
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanDetails> = {
  monthly: {
    plan: "monthly",
    tier: "pro_monthly",
    title: "Plano Pro Mensal",
    priceCents: 1990,
    monthlyEquivalentCents: 1990,
    interval: "month",
    intervalMonths: 1,
    discountPercentage: 0,
    description: "Cobrança mensal com cancelamento a qualquer momento em 1 clique.",
    badge: null,
  },
  annual: {
    plan: "annual",
    tier: "pro_annual",
    title: "Plano Pro Anual",
    priceCents: 17880,
    monthlyEquivalentCents: 1490,
    interval: "year",
    intervalMonths: 12,
    discountPercentage: 25,
    description: "Cobrança anual com 25% de desconto em relação ao mensal.",
    badge: "25% OFF",
  },
};

/** Prazo incondicional de direito de arrependimento (Art. 49 do CDC - 7 dias corridos). */
export const CDC_COOLING_OFF_DAYS = 7;

/**
 * Retorna as configurações canônicas de um plano SaaS.
 */
export function getPlanDetails(plan: SubscriptionPlan): PlanDetails {
  return PLAN_CONFIGS[plan];
}

/**
 * Calcula a economia anual em centavos ao optar pelo Plano Pro Anual em vez do Mensal.
 */
export function calculateAnnualSavingsCents(): number {
  const monthlyCostFor12Months = PLAN_CONFIGS.monthly.priceCents * 12;
  const annualCost = PLAN_CONFIGS.annual.priceCents;
  return Math.max(0, monthlyCostFor12Months - annualCost);
}

/**
 * Verifica se a data de cancelamento/solicitação está dentro do prazo legal
 * de direito de arrependimento de 7 dias do CDC (Artigo 49 da Lei 8.078/1990).
 */
export function isWithinCoolingOffPeriod(params: {
  paidAt: string | Date;
  now?: string | Date;
}): boolean {
  const paid = new Date(params.paidAt);
  const current = params.now ? new Date(params.now) : new Date();
  const diffMs = current.getTime() - paid.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= CDC_COOLING_OFF_DAYS;
}

export interface CancellationRefundCalculation {
  /** Se o cancelamento concede reembolso (integral CDC ou pro-rata anual). */
  eligibleForRefund: boolean;
  /** Valor monetário a ser estornado/reembolsado em centavos (inteiro). */
  refundAmountCents: number;
  /** Se o reembolso decorre do Artigo 49 do CDC (100% integral dentro dos primeiros 7 dias). */
  isCdcArrependimento: boolean;
  /** Motivo ou detalhe do cálculo para transparência com o cliente. */
  reason: string;
  /** Meses usufruídos considerados no cálculo (relevante no plano anual). */
  monthsUsed: number;
  /** Meses residuais a reembolsar. */
  monthsRemaining: number;
}

/**
 * Calcula os termos e valor de reembolso de cancelamento de assinatura:
 * 1. Primeiros 7 dias (CDC Artigo 49): Reembolso 100% integral incondicional.
 * 2. Plano Mensal após 7 dias: Sem reembolso residual; vigora até o término do ciclo mensal.
 * 3. Plano Anual após 7 dias: Reembolso pró-rata dos meses completos não usufruídos com base no valor faturado.
 */
export function calculateCancellationRefund(params: {
  plan: SubscriptionPlan;
  paidAt: string | Date;
  paidAmountCents?: number;
  currentDate?: string | Date;
}): CancellationRefundCalculation {
  const paid = new Date(params.paidAt);
  const now = params.currentDate ? new Date(params.currentDate) : new Date();
  const defaultPaid = params.paidAmountCents ?? PLAN_CONFIGS[params.plan].priceCents;

  // 1. Arrependimento CDC (0 a 7 dias)
  if (isWithinCoolingOffPeriod({ paidAt: paid, now })) {
    return {
      eligibleForRefund: true,
      refundAmountCents: defaultPaid,
      isCdcArrependimento: true,
      reason: "Direito de arrependimento legal de 7 dias (Artigo 49 do CDC). Reembolso integral de 100%.",
      monthsUsed: 0,
      monthsRemaining: params.plan === "annual" ? 12 : 1,
    };
  }

  // 2. Plano Mensal após 7 dias: acesso garantido até o fim do ciclo corrente, sem estorno residual
  if (params.plan === "monthly") {
    return {
      eligibleForRefund: false,
      refundAmountCents: 0,
      isCdcArrependimento: false,
      reason: "Cancelamento após o 7º dia. Acesso mantido até o encerramento do ciclo mensal atual.",
      monthsUsed: 1,
      monthsRemaining: 0,
    };
  }

  // 3. Plano Anual após 7 dias: cálculo pró-rata de meses não utilizados
  const diffMs = Math.max(0, now.getTime() - paid.getTime());
  const daysUsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // Considera 30 dias por competência média de mês
  const monthsUsed = Math.min(12, Math.ceil(daysUsed / 30));
  const monthsRemaining = Math.max(0, 12 - monthsUsed);

  if (monthsRemaining <= 0) {
    return {
      eligibleForRefund: false,
      refundAmountCents: 0,
      isCdcArrependimento: false,
      reason: "Ciclo anual totalmente usufruído.",
      monthsUsed: 12,
      monthsRemaining: 0,
    };
  }

  // Valor por mês no pacote anual faturado
  const pricePerMonthCents = Math.floor(defaultPaid / 12);
  const refundAmountCents = pricePerMonthCents * monthsRemaining;

  return {
    eligibleForRefund: refundAmountCents > 0,
    refundAmountCents,
    isCdcArrependimento: false,
    reason: `Reembolso pró-rata de ${monthsRemaining} mês(es) não usufruído(s) do plano anual.`,
    monthsUsed,
    monthsRemaining,
  };
}
