/**
 * Onboarding de primeiro uso (§5.7) — funções puras.
 * Deriva o checklist de configuração inicial a partir de contagens de dados
 * do usuário (categorias, cartões, lançamentos, ativos e investimentos)
 * respeitando os módulos liberados para a conta (hasFeature). Sem UI, sem Supabase.
 */

import type { SystemFeatureKey } from "@/types";

export interface OnboardingCounts {
  /** Categorias de despesa criadas pelo usuário (não reservadas). */
  expenseCategories: number;
  /** Categorias de renda criadas pelo usuário (não reservadas). */
  incomeCategories: number;
  /** Cartões de crédito cadastrados. */
  cards: number;
  /** Lançamentos registrados (despesas + rendas). */
  transactions: number;
  /** Ativos cadastrados na carteira de investimentos. */
  portfolioAssets?: number;
  /** Lançamentos / operações registradas na carteira de investimentos. */
  portfolioTransactions?: number;
  /** Leitor automático de notificações bancárias ativado (Android / nativo). */
  notificationsEnabled?: boolean;
}

export type OnboardingStepId =
  | "expense-category"
  | "income-category"
  | "card"
  | "first-transaction"
  | "portfolio-asset"
  | "portfolio-transaction"
  | "bank-notifications";

export interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
}

export type FeaturePredicate = (featureKey: SystemFeatureKey | string) => boolean;

interface StepDefinition {
  id: OnboardingStepId;
  featureKey: SystemFeatureKey;
  isCore: boolean;
  isDone: (counts: OnboardingCounts) => boolean;
}

export const ALL_ONBOARDING_STEPS: readonly StepDefinition[] = [
  {
    id: "expense-category",
    featureKey: "budgets",
    isCore: true,
    isDone: (c) => c.expenseCategories > 0,
  },
  {
    id: "income-category",
    featureKey: "budgets",
    isCore: true,
    isDone: (c) => c.incomeCategories > 0,
  },
  {
    id: "card",
    featureKey: "cards",
    isCore: true,
    isDone: (c) => c.cards > 0,
  },
  {
    id: "first-transaction",
    featureKey: "transactions",
    isCore: true,
    isDone: (c) => c.transactions > 0,
  },
  {
    id: "portfolio-asset",
    featureKey: "investments",
    isCore: true,
    isDone: (c) => (c.portfolioAssets ?? 0) > 0,
  },
  {
    id: "portfolio-transaction",
    featureKey: "investments",
    isCore: true,
    isDone: (c) => (c.portfolioTransactions ?? 0) > 0,
  },
  {
    id: "bank-notifications",
    featureKey: "bank_notification_listener",
    isCore: false,
    isDone: (c) => Boolean(c.notificationsEnabled),
  },
] as const;

/** Checklist derivado das contagens — filtrado pelas features disponíveis se hasFeature for informado. */
export function onboardingSteps(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): OnboardingStep[] {
  return ALL_ONBOARDING_STEPS
    .filter((step) => !hasFeature || hasFeature(step.featureKey))
    .map((step) => ({ id: step.id, done: step.isDone(counts) }));
}

export interface OnboardingProgress {
  done: number;
  total: number;
}

export function onboardingProgress(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): OnboardingProgress {
  const steps = onboardingSteps(counts, hasFeature);
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

/**
 * Passos centrais do checklist liberados para o usuário (excluindo passos não-core
 * como bank-notifications, que depende de permissão de plataforma Android).
 */
export function coreOnboardingSteps(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): OnboardingStep[] {
  return ALL_ONBOARDING_STEPS
    .filter((step) => step.isCore && (!hasFeature || hasFeature(step.featureKey)))
    .map((step) => ({ id: step.id, done: step.isDone(counts) }));
}

/** Progresso considerando apenas os passos principais habilitados para a conta. */
export function coreOnboardingProgress(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): OnboardingProgress {
  const steps = coreOnboardingSteps(counts, hasFeature);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/**
 * Usuário ativo: já atingiu limiar de maturidade de uso nos módulos aos quais tem acesso.
 * - Finanças: >= 3 transações ou >= 1 cartão.
 * - Investimentos: >= 1 ativo ou >= 1 operação de carteira.
 * Um usuário ativo não precisa mais do banner de configuração na home.
 */
export function isUserActive(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): boolean {
  const allowFinances = !hasFeature || hasFeature("transactions") || hasFeature("cards");
  const allowInvestments = !hasFeature || hasFeature("investments");

  const activeFinances = allowFinances && (counts.transactions >= 3 || counts.cards >= 1);
  const activeInvestments =
    allowInvestments &&
    ((counts.portfolioAssets ?? 0) >= 1 || (counts.portfolioTransactions ?? 0) >= 1);

  if (hasFeature) {
    if (!allowFinances && allowInvestments) {
      return activeInvestments;
    }
    if (allowFinances && !allowInvestments) {
      return activeFinances;
    }
  }

  return activeFinances || activeInvestments;
}

/**
 * Controla a exibição do banner de onboarding na home.
 * Oculta automaticamente quando o usuário está ativo (smart dismiss),
 * ou quando todos os passos principais liberados foram concluídos.
 */
export function shouldShowOnboardingBanner(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): boolean {
  if (isUserActive(counts, hasFeature)) return false;
  const steps = coreOnboardingSteps(counts, hasFeature);
  if (steps.length === 0) return false;
  return steps.some((s) => !s.done);
}

/** Setup completo quando todos os passos do checklist liberados foram concluídos. */
export function isOnboardingComplete(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): boolean {
  const steps = onboardingSteps(counts, hasFeature);
  if (steps.length === 0) return true;
  return steps.every((step) => step.done);
}

/**
 * Primeiro uso: conta recém-criada sem movimentações (sem cartões, lançamentos nem investimentos).
 * Categorias pré-populadas pelo sistema no cadastro não descaracterizam o primeiro uso.
 */
export function isFirstUse(counts: OnboardingCounts): boolean {
  return (
    counts.cards === 0 &&
    counts.transactions === 0 &&
    (counts.portfolioAssets ?? 0) === 0 &&
    (counts.portfolioTransactions ?? 0) === 0 &&
    !counts.notificationsEnabled
  );
}

