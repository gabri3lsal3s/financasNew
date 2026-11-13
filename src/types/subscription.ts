/**
 * Tipos canônicos do domínio de Assinatura SaaS (PROJETO_SAAS.md).
 *
 * Fonte única de verdade para contratos de plano/status.
 * Nenhum outro módulo define esses literais — importe daqui.
 */

export const SUBSCRIPTION_TIERS = ["trial", "pro_monthly", "pro_annual", "lifetime", "read_only"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const SUBSCRIPTION_PLANS = ["monthly", "annual"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export type ModuleAccessLevel = "none" | "read" | "write" | "admin";

/**
 * Estado derivado da assinatura — calculado a partir do `SubscriptionTier` e das datas.
 * Todos os componentes de UI consomem este contrato via `useUserSubscription()`.
 */
export type SubscriptionStatus = {
  /** Tier atual do usuário. */
  tier: SubscriptionTier;

  /** Status bruto da assinatura no banco (active, trialing, canceled, past_due, etc.). */
  status?: string | null;

  /** Fase de faturamento derivada de forma determinística (BillingPhase). */
  billingPhase?: string;

  /** Data de início/ativação da assinatura ou período atual (ISO string, null se não aplicável). */
  startsAt?: string | null;

  /** Data em que a primeira cobrança real (efetiva) foi realizada (marco do direito de arrependimento CDC). */
  billingStartAt?: string | null;

  /** Dias restantes do trial (0 quando encerrado; null fora do trial). */
  trialDaysRemaining: number | null;

  /** Data de encerramento do trial (ISO string, null fora do trial). */
  trialEndsAt: string | null;

  /** Data em que o trial de 30 dias foi consumido definitivamente. */
  trialConsumedAt?: string | null;

  /** Data de renovação/encerramento do ciclo atual (ISO string, null se não aplicável). */
  currentPeriodEnd: string | null;

  /** Plano de cobrança recorrente (null para trial, lifetime e read_only). */
  plan: SubscriptionPlan | null;

  /** Verdadeiro se a assinatura está agendada para cancelar no fim do período. */
  cancelAtPeriodEnd: boolean;

  /** Verdadeiro quando o usuário tem acesso total (trial ativo, pro ativo ou vitalício). */
  isFullAccess: boolean;

  /** Verdadeiro quando está no período de teste Pro. */
  isTrial: boolean;

  /** Verdadeiro quando é assinante ativo do Plano Pro. */
  isPro: boolean;

  /** Verdadeiro quando possui Plano Vitalício (Lifetime VIP). */
  isLifetime: boolean;

  /** Verdadeiro quando o trial expirou e o usuário não assinou (modo leitura). */
  isReadOnly: boolean;

  /** Verdadeiro se o período de 30 dias de trial já foi expirado. */
  isTrialExpired?: boolean;

  /** Verdadeiro se o usuário já utilizou o benefício único de 30 dias de trial por conta. */
  hasUsedTrial?: boolean;

  /** Verdadeiro quando o usuário possui permissão ativa para criar/editar registros. */
  canWrite: boolean;

  /** Verdadeiro se o usuário possui cartão de crédito cadastrado para cobrança automática. */
  hasCardRegistered?: boolean;

  /** Verdadeiro se a cobrança/renovação automática está ativa no cartão. */
  hasAutoRenew?: boolean;

  /** Últimos 4 dígitos do cartão cadastrado (quando disponível). */
  cardLast4?: string | null;

  /** Bandeira do cartão cadastrado (quando disponível). */
  cardBrand?: string | null;

  /** Plano futuro agendado para troca na próxima renovação. */
  pendingPlanId?: string | null;

  /** Data em que a troca de plano agendada entrará em vigor. */
  pendingPlanEffectiveAt?: string | null;

  /** Plano agendado para primeira cobrança após o trial. */
  scheduledPlanId?: string | null;

  /** Data da primeira cobrança futura agendada após o trial. */
  scheduledFirstChargeAt?: string | null;

  /** Status de sincronização de vencimento no Asaas. */
  asaasSyncStatus?: string | null;

  /** Mapeamento de permissões individuais por módulo. */
  moduleAccess?: Record<string, ModuleAccessLevel>;
};
