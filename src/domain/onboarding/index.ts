/**
 * Onboarding de primeiro uso (§5.7) — funções puras.
 * Deriva o checklist de configuração inicial a partir de contagens de dados
 * do usuário (categorias, cartões, lançamentos). Sem UI, sem Supabase.
 */

export interface OnboardingCounts {
  /** Categorias de despesa criadas pelo usuário (não reservadas). */
  expenseCategories: number;
  /** Categorias de renda criadas pelo usuário (não reservadas). */
  incomeCategories: number;
  /** Cartões de crédito cadastrados. */
  cards: number;
  /** Lançamentos registrados (despesas + rendas). */
  transactions: number;
  /** Leitor automático de notificações bancárias ativado (Android / nativo). */
  notificationsEnabled?: boolean;
}

export type OnboardingStepId =
  | "expense-category"
  | "income-category"
  | "card"
  | "first-transaction"
  | "bank-notifications";

export interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
}

/** Ordem canônica do checklist (a UI mapeia id → rótulo/ícone/rota). */
const ONBOARDING_STEP_IDS: readonly OnboardingStepId[] = [
  "expense-category",
  "income-category",
  "card",
  "first-transaction",
  "bank-notifications",
] as const;

/** Checklist derivado das contagens — cada passo vira `done` quando há dados. */
export function onboardingSteps(counts: OnboardingCounts): OnboardingStep[] {
  return ONBOARDING_STEP_IDS.map((id) => {
    switch (id) {
      case "expense-category":
        return { id, done: counts.expenseCategories > 0 };
      case "income-category":
        return { id, done: counts.incomeCategories > 0 };
      case "card":
        return { id, done: counts.cards > 0 };
      case "first-transaction":
        return { id, done: counts.transactions > 0 };
      case "bank-notifications":
        return { id, done: Boolean(counts.notificationsEnabled) };
    }
  });
}

export interface OnboardingProgress {
  done: number;
  total: number;
}

export function onboardingProgress(counts: OnboardingCounts): OnboardingProgress {
  const steps = onboardingSteps(counts);
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

/**
 * Passos centrais do checklist (excluindo o passo opcional de notificações nativas,
 * que depende de permissão de plataforma Android e não deve bloquear o fluxo principal).
 */
const CORE_STEP_IDS: readonly OnboardingStepId[] = [
  "expense-category",
  "income-category",
  "card",
  "first-transaction",
] as const;

/** Retorna apenas os passos principais (sem bank-notifications). */
export function coreOnboardingSteps(counts: OnboardingCounts): OnboardingStep[] {
  return onboardingSteps(counts).filter((s) => CORE_STEP_IDS.includes(s.id as (typeof CORE_STEP_IDS)[number]));
}

/** Progresso considerando apenas os passos principais (4 no total). */
export function coreOnboardingProgress(counts: OnboardingCounts): OnboardingProgress {
  const steps = coreOnboardingSteps(counts);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/**
 * Usuário ativo: já registrou lançamentos suficientes (>= 3) ou adicionou ao menos 1 cartão.
 * Um usuário ativo não precisa mais do banner de configuração na home ou no fluxo inicial.
 */
export function isUserActive(counts: OnboardingCounts): boolean {
  return counts.transactions >= 3 || counts.cards >= 1;
}

/**
 * Controla a exibição do banner de onboarding na home.
 * Oculta automaticamente quando o usuário está ativo (smart dismiss),
 * ou quando todos os passos principais foram concluídos.
 */
export function shouldShowOnboardingBanner(counts: OnboardingCounts): boolean {
  if (isUserActive(counts)) return false;
  return coreOnboardingSteps(counts).some((s) => !s.done);
}

/** Setup completo quando todos os passos do checklist foram concluídos. */
export function isOnboardingComplete(counts: OnboardingCounts): boolean {
  return onboardingSteps(counts).every((step) => step.done);
}

/** Primeiro uso: nenhum dado registrado ainda (conta recém-criada). */
export function isFirstUse(counts: OnboardingCounts): boolean {
  return (
    counts.expenseCategories === 0 &&
    counts.incomeCategories === 0 &&
    counts.cards === 0 &&
    counts.transactions === 0 &&
    !counts.notificationsEnabled
  );
}
