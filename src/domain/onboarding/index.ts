/**
 * Onboarding de primeiro uso (§5.7) — funções puras.
 * Deriva o checklist de configuração inicial a partir de contagens de dados
 * reais do usuário (saldo calibrado, lançamentos, cartões, ativos e investimentos)
 * respeitando os módulos liberados para a conta (hasFeature). Sem UI, sem Supabase.
 */

import type { OnboardingGoalId, SystemFeatureKey } from "@/types";

export interface OnboardingCounts {
  /** Categorias de despesa criadas pelo usuário (não reservadas). */
  expenseCategories: number;
  /** Categorias de renda criadas pelo usuário (não reservadas). */
  incomeCategories: number;
  /** Checkpoints de saldo em conta cadastrados (calibração inicial de caixa). */
  cashCheckpoints?: number;
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
  | "cash-checkpoint"
  | "first-transaction"
  | "card"
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
    id: "cash-checkpoint",
    featureKey: "transactions",
    isCore: true,
    isDone: (c) => (c.cashCheckpoints ?? 0) > 0,
  },
  {
    id: "first-transaction",
    featureKey: "transactions",
    isCore: true,
    isDone: (c) => c.transactions > 0,
  },
  {
    id: "card",
    featureKey: "cards",
    isCore: false,
    isDone: (c) => c.cards > 0,
  },
  {
    id: "portfolio-asset",
    featureKey: "investments",
    isCore: false,
    isDone: (c) => (c.portfolioAssets ?? 0) > 0,
  },
  {
    id: "portfolio-transaction",
    featureKey: "investments",
    isCore: false,
    isDone: (c) => (c.portfolioTransactions ?? 0) > 0,
  },
  {
    id: "bank-notifications",
    featureKey: "bank_notification_listener",
    isCore: false,
    isDone: (c) => Boolean(c.notificationsEnabled),
  },
] as const;

const STEP_MAP = new Map<OnboardingStepId, StepDefinition>(
  ALL_ONBOARDING_STEPS.map((step) => [step.id, step]),
);

function isStepAllowed(step: StepDefinition, hasFeature?: FeaturePredicate): boolean {
  return !hasFeature || hasFeature(step.featureKey);
}

/** Checklist completo derivado das contagens — filtrado pelas features disponíveis. */
export function onboardingSteps(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
): OnboardingStep[] {
  return ALL_ONBOARDING_STEPS
    .filter((step) => isStepAllowed(step, hasFeature))
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
 * Passos centrais (ações essenciais) do onboarding liberados para o usuário.
 * - Perfil exclusivo de investimentos: retorna cadastro de ativo e 1ª operação.
 * - Demais contas: retorna Saldo inicial e 1º lançamento (cartão é opcional por padrão; incluído no topo apenas se foco = "cards", ou Ativo no topo se foco = "investments").
 */
export function coreOnboardingSteps(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
  initialGoal?: OnboardingGoalId | null,
): OnboardingStep[] {
  const allowFinances = !hasFeature || hasFeature("transactions") || hasFeature("cards");
  const allowInvestments = !hasFeature || hasFeature("investments");

  if (!allowFinances && allowInvestments) {
    const investmentIds: OnboardingStepId[] = ["portfolio-asset", "portfolio-transaction"];
    return investmentIds
      .map((id) => STEP_MAP.get(id))
      .filter((step): step is StepDefinition => Boolean(step && isStepAllowed(step, hasFeature)))
      .map((step) => ({ id: step.id, done: step.isDone(counts) }));
  }

  if (!allowFinances) return [];

  let orderedIds: OnboardingStepId[];
  if (initialGoal === "investments" && allowInvestments) {
    orderedIds = ["portfolio-asset", "cash-checkpoint", "first-transaction"];
  } else if (initialGoal === "cards") {
    orderedIds = ["card", "cash-checkpoint", "first-transaction"];
  } else {
    orderedIds = ["cash-checkpoint", "first-transaction"];
  }

  const steps = orderedIds
    .map((id) => STEP_MAP.get(id))
    .filter((step): step is StepDefinition => Boolean(step && isStepAllowed(step, hasFeature)))
    .map((step) => ({ id: step.id, done: step.isDone(counts) }));

  if (!initialGoal || initialGoal === "investments" || initialGoal === "cards") return steps;

  const priorityStepId: OnboardingStepId | null =
    initialGoal === "ocr" || initialGoal === "debts"
      ? "first-transaction"
      : null;

  if (!priorityStepId) return steps;

  const targetIdx = steps.findIndex((s) => s.id === priorityStepId);
  if (targetIdx <= 0) return steps;

  const targetStep = steps[targetIdx]!;
  const rest = steps.filter((s) => s.id !== priorityStepId);
  return [targetStep, ...rest];
}

/** Progresso considerando apenas os passos principais habilitados para a conta. */
export function coreOnboardingProgress(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
  initialGoal?: OnboardingGoalId | null,
): OnboardingProgress {
  const steps = coreOnboardingSteps(counts, hasFeature, initialGoal);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/**
 * Usuário ativo: já concluiu todos os passos essenciais do onboarding ou atingiu uso recorrente (>= 5 lançamentos).
 */
export function isUserActive(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
  initialGoal?: OnboardingGoalId | null,
): boolean {
  const allowFinances = !hasFeature || hasFeature("transactions") || hasFeature("cards");
  const allowInvestments = !hasFeature || hasFeature("investments");

  if (!allowFinances && allowInvestments) {
    return (counts.portfolioAssets ?? 0) >= 1 && (counts.portfolioTransactions ?? 0) >= 1;
  }

  if (allowFinances) {
    const core = coreOnboardingSteps(counts, hasFeature, initialGoal);
    const allCoreDone = core.length > 0 && core.every((s) => s.done);
    return counts.transactions >= 5 || allCoreDone;
  }

  return false;
}

/**
 * Controla a exibição do guia de primeiros passos na Home (Fase 2 — Carrossel).
 * Permanece ativo após a 1ª ação até o usuário concluir os passos essenciais,
 * atingir 5+ lançamentos ou dispensar manualmente.
 */
export function shouldShowOnboardingBanner(
  counts: OnboardingCounts,
  hasFeature?: FeaturePredicate,
  initialGoal?: OnboardingGoalId | null,
): boolean {
  if (isUserActive(counts, hasFeature, initialGoal)) return false;
  const steps = coreOnboardingSteps(counts, hasFeature, initialGoal);
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
 * Primeiro uso: conta recém-criada sem saldo calibrado, cartões, lançamentos nem investimentos.
 * Categorias pré-populadas pelo sistema no cadastro não descaracterizam o primeiro uso.
 */
export function isFirstUse(counts: OnboardingCounts): boolean {
  return (
    (counts.cashCheckpoints ?? 0) === 0 &&
    counts.cards === 0 &&
    counts.transactions === 0 &&
    (counts.portfolioAssets ?? 0) === 0 &&
    (counts.portfolioTransactions ?? 0) === 0 &&
    !counts.notificationsEnabled
  );
}
