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
}

export type OnboardingStepId = "expense-category" | "income-category" | "card" | "first-transaction";

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
    counts.transactions === 0
  );
}
