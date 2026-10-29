import { useMemo } from "react";
import { generateMockFinances, generateMockInvestments } from "@/domain/demo-simulation";
import type { OnboardingCounts } from "@/domain/onboarding";
import type { CategoryType } from "@/types";

/**
 * Cria uma estrutura de retorno compatível com UseQueryResult do TanStack Query,
 * sinalizando estado de sucesso imediato sem requisição de rede.
 */
export function makeSimulatedQueryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isSuccess: true,
    isError: false,
    error: null,
    status: "success" as const,
    fetchStatus: "idle" as const,
    isPlaceholderData: false,
    refetch: async () => ({
      data,
      isSuccess: true as const,
      isError: false as const,
      error: null,
      status: "success" as const,
    }),
  };
}

/** Despesas simuladas por mês. */
export function useSimulatedExpenses(month: string) {
  const data = useMemo(() => {
    const mock = generateMockFinances(month);
    return mock.expenses.filter((e) => e.date.startsWith(month));
  }, [month]);

  return makeSimulatedQueryResult(data);
}

/** Despesas simuladas por intervalo [start, end). */
export function useSimulatedExpensesByRange(start: string, end: string) {
  const data = useMemo(() => {
    const month = start.slice(0, 7);
    const mock = generateMockFinances(month);
    return mock.expenses.filter((e) => e.date >= start && e.date < end);
  }, [start, end]);

  return makeSimulatedQueryResult(data);
}

/** Receitas simuladas por mês. */
export function useSimulatedIncomes(month: string) {
  const data = useMemo(() => {
    const mock = generateMockFinances(month);
    return mock.incomes.filter((i) => i.date.startsWith(month));
  }, [month]);

  return makeSimulatedQueryResult(data);
}

/** Receitas simuladas por intervalo [start, end). */
export function useSimulatedIncomesByRange(start: string, end: string) {
  const data = useMemo(() => {
    const month = start.slice(0, 7);
    const mock = generateMockFinances(month);
    return mock.incomes.filter((i) => i.date >= start && i.date < end);
  }, [start, end]);

  return makeSimulatedQueryResult(data);
}

/** Categorias simuladas (opcionalmente filtradas por tipo). */
export function useSimulatedCategories(type?: CategoryType) {
  const data = useMemo(() => {
    const mock = generateMockFinances();
    return type ? mock.categories.filter((c) => c.type === type) : mock.categories;
  }, [type]);

  return makeSimulatedQueryResult(data);
}

/** Cartões de crédito simulados. */
export function useSimulatedCreditCards(options?: { activeOnly?: boolean }) {
  const data = useMemo(() => {
    const mock = generateMockFinances();
    return options?.activeOnly ? mock.cards.filter((c) => c.is_active) : mock.cards;
  }, [options?.activeOnly]);

  return makeSimulatedQueryResult(data);
}

/** Despesas simuladas de um cartão específico (todas as competências). */
export function useSimulatedCardExpenses(cardId: string | null) {
  const data = useMemo(() => {
    if (!cardId) return [];
    const mock = generateMockFinances();
    return mock.expenses.filter((e) => e.card_id === cardId);
  }, [cardId]);

  return makeSimulatedQueryResult(data);
}

/** Pagamentos e faturas simuladas de um cartão (todas as competências). */
export function useSimulatedCardPayments(cardId: string | null) {
  const data = useMemo(() => {
    if (!cardId) return [];
    const mock = generateMockFinances();
    return mock.cardPayments.filter((p) => p.card_id === cardId);
  }, [cardId]);

  return makeSimulatedQueryResult(data);
}

/** Todas as despesas de cartão simuladas (visão consolidada de cartões). */
export function useSimulatedAllCardExpenses() {
  const data = useMemo(() => {
    const mock = generateMockFinances();
    return mock.expenses.filter((e) => e.card_id !== null);
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Todos os pagamentos e faturas consolidadas de cartão simulados. */
export function useSimulatedAllCardPayments() {
  const data = useMemo(() => {
    const mock = generateMockFinances();
    return mock.cardPayments;
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Orçamentos simulados. */
export function useSimulatedBudgets(month?: string) {
  const data = useMemo(() => {
    const mock = generateMockFinances(month);
    return mock.budgets;
  }, [month]);

  return makeSimulatedQueryResult(data);
}

/** Ativos de carteira simulados. */
export function useSimulatedPortfolioAssets() {
  const data = useMemo(() => {
    const mock = generateMockInvestments();
    return mock.assets;
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Transações históricas da carteira simulada. */
export function useSimulatedAllPortfolioTransactions() {
  const data = useMemo(() => {
    const mock = generateMockInvestments();
    return mock.transactions;
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Snapshots mensais simulados da carteira. */
export function useSimulatedPortfolioSnapshots() {
  const data = useMemo(() => {
    const mock = generateMockInvestments();
    return mock.snapshots;
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Aportes recentes simulados da carteira. */
export function useSimulatedPortfolioContributions() {
  const data = useMemo(() => {
    const mock = generateMockInvestments();
    return mock.contributions;
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Proventos simulados da carteira. */
export function useSimulatedPortfolioDividends() {
  const data = useMemo(() => {
    const mock = generateMockInvestments();
    return mock.dividends;
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Metas por ativo simuladas. */
export function useSimulatedAllocationTargets() {
  const data = useMemo(() => {
    const mock = generateMockInvestments();
    return mock.allocationTargets;
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Metas por classe/setor simuladas. */
export function useSimulatedGroupTargets(groupType: "class" | "sector") {
  const data = useMemo(() => {
    const mock = generateMockInvestments();
    return mock.groupTargets.filter((g) => g.group_type === groupType);
  }, [groupType]);

  return makeSimulatedQueryResult(data);
}

/** Contagens simuladas de onboarding. */
export function useSimulatedOnboardingCounts() {
  const data: OnboardingCounts = useMemo(
    () => ({
      expenseCategories: 6,
      incomeCategories: 3,
      cards: 1,
      transactions: 12,
      notificationsEnabled: false,
    }),
    [],
  );

  return makeSimulatedQueryResult<OnboardingCounts>(data);
}
