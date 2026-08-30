/**
 * Tipos canônicos do domínio de Assinatura SaaS (PROJETO_SAAS.md).
 *
 * Fonte única de verdade para contratos de plano/status.
 * Nenhum outro módulo define esses literais — importe daqui.
 */

export const SUBSCRIPTION_TIERS = ["trial", "pro_monthly", "pro_annual", "read_only"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const SUBSCRIPTION_PLANS = ["monthly", "annual"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/**
 * Estado derivado da assinatura — calculado a partir do `SubscriptionTier` e das datas.
 * Todos os componentes de UI consomem este contrato via `useUserSubscription()`.
 */
export type SubscriptionStatus = {
  /** Tier atual do usuário. */
  tier: SubscriptionTier;

  /** Dias restantes do trial (0 quando encerrado; null fora do trial). */
  trialDaysRemaining: number | null;

  /** Data de encerramento do trial (ISO string, null fora do trial). */
  trialEndsAt: string | null;

  /** Data de renovação/encerramento do ciclo atual (ISO string, null se não aplicável). */
  currentPeriodEnd: string | null;

  /** Plano de cobrança recorrente (null para trial e read_only). */
  plan: SubscriptionPlan | null;

  /** Verdadeiro se a assinatura está agendada para cancelar no fim do período. */
  cancelAtPeriodEnd: boolean;

  /** Verdadeiro quando o usuário tem acesso total (trial ativo ou pro ativo). */
  isFullAccess: boolean;

  /** Verdadeiro quando está no período de teste Pro. */
  isTrial: boolean;

  /** Verdadeiro quando é assinante ativo do Plano Pro. */
  isPro: boolean;

  /** Verdadeiro quando o trial expirou e o usuário não assinou (modo leitura). */
  isReadOnly: boolean;
};
