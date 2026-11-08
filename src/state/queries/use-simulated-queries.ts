import { useMemo } from "react";
import {
  generateMockFinances,
  generateMockInvestments,
  generateMockFamily,
  generateMockFamilyConsolidation,
  generateMockPublicShares,
} from "@/domain/demo-simulation";
import type { OnboardingCounts } from "@/domain/onboarding";
import type { CategoryType, Debt, FamilyPortfolioSummary, IncomeGoal, Loan, PublicShareKind } from "@/types";
import type { Trip } from "@/types/trips";
import type { TripAggregatedDetails } from "./use-trips";
import { calculateMemberBalances, calculateSimplifiedSettlements } from "@/domain/trips/trip-math";

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

/** Unidade familiar simulada com 2 membros e perfil completo. */
export function useSimulatedFamily() {
  const data = useMemo(() => {
    return generateMockFamily();
  }, []);

  return makeSimulatedQueryResult(data);
}

/** Consolidação de gastos da família simulada por mês. */
export function useSimulatedFamilyConsolidation(month?: string) {
  const data = useMemo(() => {
    return generateMockFamilyConsolidation(month);
  }, [month]);

  return makeSimulatedQueryResult(data);
}

/** Compartilhamentos públicos simulados (rachas com Pix e vaquinhas/metas). */
export function useSimulatedPublicShares(kind?: PublicShareKind) {
  const data = useMemo(() => {
    const shares = generateMockPublicShares();
    return kind ? shares.filter((s) => s.kind === kind) : shares;
  }, [kind]);

  return makeSimulatedQueryResult(data);
}

/** Resumo patrimonial familiar simulado. */
export function useSimulatedFamilyPortfolioSummary() {
  const data = useMemo<FamilyPortfolioSummary>(
    () => ({
      family_id: "fam-demo-silva",
      total_invested_cents: 408863,
      total_cash_cents: 257057,
      dividends_12m_cents: 0,
      assets_count: 4,
      assets: [],
    }),
    [],
  );

  return makeSimulatedQueryResult(data);
}

/** Lista de dívidas simuladas (contas a pagar, a receber e parcelas de contratos). */
export function useSimulatedDebts() {
  const data = useMemo<Debt[]>(() => {
    const mock = generateMockFinances();
    return mock.debts;
  }, []);
  return makeSimulatedQueryResult(data);
}

/** Contratos de crédito e financiamentos simulados (Price e SAC). */
export function useSimulatedLoans() {
  const data = useMemo<Loan[]>(() => {
    const mock = generateMockFinances();
    return mock.loans;
  }, []);
  return makeSimulatedQueryResult(data);
}

/** Metas de renda simuladas. */
export function useSimulatedIncomeGoals() {
  const data = useMemo<IncomeGoal[]>(() => {
    const mock = generateMockFinances();
    return mock.incomeGoals;
  }, []);
  return makeSimulatedQueryResult(data);
}

/** Lista de viagens simuladas (Modo Viagem). */
export function useSimulatedTrips() {
  const data = useMemo<Trip[]>(() => {
    const mock = generateMockFinances();
    return mock.trips;
  }, []);
  return makeSimulatedQueryResult(data);
}

/** Detalhes agregados da viagem simulada. */
export function useSimulatedTripDetails(tripId: string | null | undefined) {
  const data = useMemo<TripAggregatedDetails | null>(() => {
    if (!tripId) return null;
    const mock = generateMockFinances();
    const trip = mock.trips.find((t) => t.id === tripId) ?? mock.trips[0];
    if (!trip) return null;

    const members = mock.tripMembers.filter((m) => m.trip_id === trip.id);
    const expenses = mock.tripExpenses.filter((e) => e.trip_id === trip.id);
    const settlements = mock.tripSettlements.filter((s) => s.trip_id === trip.id);

    const balances = calculateMemberBalances(
      members.map((m) => ({
        id: m.id,
        name: m.name,
        pix_key: m.pix_key,
        pix_key_type: m.pix_key_type,
      })),
      expenses.map((e) => ({
        paid_by_member_id: e.paid_by_member_id,
        amount_cents: e.amount_cents,
        split_type: e.split_type,
        splits: (e.splits ?? []).map((s) => ({
          member_id: s.member_id,
          share_cents: s.share_cents,
        })),
      }))
    );

    const suggestedSettlements = calculateSimplifiedSettlements(
      balances,
      members.map((m) => ({
        id: m.id,
        name: m.name,
        pix_key: m.pix_key,
        pix_key_type: m.pix_key_type,
      }))
    );

    const totalExpensesCents = expenses.reduce((acc, e) => acc + e.amount_cents, 0);

    return {
      trip,
      members,
      expenses,
      settlements,
      balances,
      suggestedSettlements,
      totalExpensesCents,
    };
  }, [tripId]);

  return makeSimulatedQueryResult(data);
}

