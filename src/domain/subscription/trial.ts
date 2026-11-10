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

export type TrialLifecycleStage = "welcome" | "awareness" | "warning" | "imminent" | "expired";

export interface TrialLifecycleMetadata {
  stage: TrialLifecycleStage;
  badgeLabel: string;
  badgeVariant: "default" | "positive" | "warning" | "critical";
  title: string;
  description: string;
  ctaText: string;
}

/**
 * Determina o estágio de ciclo de vida do período de teste Pro com base nos dias restantes.
 *
 * - welcome (21 a 30 dias): primeiros dias, foco em acolhimento e experimentação.
 * - awareness (8 a 20 dias): consolidação do uso e apresentação do benefício anual.
 * - warning (3 a 7 dias): aviso prévio para planejamento.
 * - imminent (1 a 2 dias): reta final antes da conversão para somente-leitura.
 * - expired (<= 0 dias): encerrado, modo somente-leitura ativo.
 */
export function getTrialLifecycleStage(daysRemaining: number): TrialLifecycleStage {
  if (daysRemaining <= 0) return "expired";
  if (daysRemaining <= 2) return "imminent";
  if (daysRemaining <= 7) return "warning";
  if (daysRemaining <= 20) return "awareness";
  return "welcome";
}

/**
 * Retorna os textos e metadados visuais padronizados para cada estágio do trial.
 * Regras: zero emojis, mensagens informativas e respeitosas (AGENTS.md).
 */
export function getTrialLifecycleMetadata(daysRemaining: number): TrialLifecycleMetadata {
  const stage = getTrialLifecycleStage(daysRemaining);

  switch (stage) {
    case "welcome":
      return {
        stage,
        badgeLabel: "Teste Pro Ativo",
        badgeVariant: "default",
        title: "Você está no Axir Pro com acesso total liberado",
        description:
          "Aproveite 30 dias de lançamentos ilimitados, OCR de cupons fiscais e projeções sem compromisso.",
        ctaText: "Conhecer Benefícios Pro",
      };
    case "awareness":
      return {
        stage,
        badgeLabel: `${daysRemaining}d restantes`,
        badgeVariant: "default",
        title: `Seu teste Pro está ativo: restam ${daysRemaining} dias de acesso`,
        description:
          "Mantenha suas automações e garanta 40% de economia no plano anual sem perder dias de teste.",
        ctaText: "Ver Oferta com 40% OFF",
      };
    case "warning":
      return {
        stage,
        badgeLabel: `${daysRemaining}d restantes`,
        badgeVariant: "warning",
        title: `Seu período de teste Pro encerra em ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`,
        description:
          "Seus dados nunca são apagados. Ative o Pro para continuar lançando e usando automações.",
        ctaText: "Assinar e Manter Ativo",
      };
    case "imminent":
      return {
        stage,
        badgeLabel: daysRemaining === 1 ? "Último dia" : "Últimas 48 horas",
        badgeVariant: "critical",
        title:
          daysRemaining === 1
            ? "Seu período de teste Pro encerra hoje"
            : "Últimos dias de teste Pro",
        description:
          "Evite a pausa no leitor de notas e lançamentos ilimitados. Ativação imediata em 1 clique.",
        ctaText: "Garantir Acesso Pro",
      };
    case "expired":
      return {
        stage,
        badgeLabel: "Modo Consulta",
        badgeVariant: "warning",
        title: "Seu teste Pro encerrou — Modo Somente-Leitura ativo",
        description:
          "Seu histórico está 100% seguro. Ative o Pro para voltar a fazer novos lançamentos sem travas.",
        ctaText: "Reativar Plano Pro",
      };
  }
}


