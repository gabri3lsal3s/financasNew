import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endDemo, resetDemoSession, startDemo } from "@/state/demo-mode";
import {
  useAllocationTargets,
  useBudgets,
  useCategories,
  useCreditCards,
  useExpenses,
  useGroupTargets,
  useIncomes,
  useOnboardingCounts,
  usePortfolioAssets,
  usePortfolioSnapshots,
  useCardExpenses,
  useCardPayments,
  useAllCardExpenses,
  useAllCardPayments,
  useSimulatedExpenses,
  useSimulatedIncomes,
  useSimulatedCategories,
  useSimulatedCreditCards,
  useSimulatedCardExpenses,
  useSimulatedCardPayments,
  useSimulatedAllCardExpenses,
  useSimulatedAllCardPayments,
  useSimulatedBudgets,
  useSimulatedPortfolioAssets,
} from "@/state";

// Mock das funções reais de repositório para verificar que NÃO são chamadas quando isDemoActive === true
const mockListExpensesByMonth = vi.fn().mockResolvedValue([]);
const mockListIncomesByMonth = vi.fn().mockResolvedValue([]);
const mockListCategories = vi.fn().mockResolvedValue([]);
const mockListCreditCards = vi.fn().mockResolvedValue([]);
const mockListBudgets = vi.fn().mockResolvedValue([]);
const mockListPortfolioAssets = vi.fn().mockResolvedValue([]);
const mockListExpensesByCard = vi.fn().mockResolvedValue([]);
const mockListAllCardExpenses = vi.fn().mockResolvedValue([]);
const mockListCardPayments = vi.fn().mockResolvedValue([]);
const mockListAllCardPayments = vi.fn().mockResolvedValue([]);

vi.mock("@/data/repositories/expenses", () => ({
  listExpensesByMonth: (...args: unknown[]) => mockListExpensesByMonth(...args),
  listExpensesByRange: vi.fn().mockResolvedValue([]),
  listExpensesByCard: (...args: unknown[]) => mockListExpensesByCard(...args),
  listAllCardExpenses: (...args: unknown[]) => mockListAllCardExpenses(...args),
  getExpense: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/data/repositories/card-payments", () => ({
  listCardPayments: (...args: unknown[]) => mockListCardPayments(...args),
  listAllCardPayments: (...args: unknown[]) => mockListAllCardPayments(...args),
}));

vi.mock("@/data/repositories/incomes", () => ({
  listIncomesByMonth: (...args: unknown[]) => mockListIncomesByMonth(...args),
  listIncomesByRange: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/data/repositories/categories", () => ({
  listCategories: (...args: unknown[]) => mockListCategories(...args),
  listAllCategories: vi.fn().mockResolvedValue([]),
  getCategoryUsage: vi.fn().mockResolvedValue({ totalCount: 0 }),
}));

vi.mock("@/data/repositories/credit-cards", () => ({
  listCreditCards: (...args: unknown[]) => mockListCreditCards(...args),
  listActiveCreditCards: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/data/repositories/budgets", () => ({
  listBudgets: (...args: unknown[]) => mockListBudgets(...args),
}));

vi.mock("@/data/repositories/portfolio", () => ({
  listPortfolioAssets: (...args: unknown[]) => mockListPortfolioAssets(...args),
  listAllPortfolioTransactions: vi.fn().mockResolvedValue([]),
  listPortfolioTransactions: vi.fn().mockResolvedValue([]),
  listPortfolioSnapshots: vi.fn().mockResolvedValue([]),
  listPortfolioContributions: vi.fn().mockResolvedValue([]),
  listPortfolioDividends: vi.fn().mockResolvedValue([]),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("use-simulated-queries — Interceptação Segura de Queries no TanStack Query (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDemoSession();
  });

  afterEach(() => {
    resetDemoSession();
  });

  describe("Hooks simulados diretos", () => {
    it("useSimulatedExpenses retorna dados mockados puros imediatamente", () => {
      const { result } = renderHook(() => useSimulatedExpenses("2026-10"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.length).toBeGreaterThan(0);
      for (const exp of result.current.data ?? []) {
        expect(exp.date.startsWith("2026-10")).toBe(true);
      }
    });

    it("useSimulatedIncomes retorna receitas do mês com status de sucesso", () => {
      const { result } = renderHook(() => useSimulatedIncomes("2026-10"), {
        wrapper: createWrapper(),
      });

      expect(result.current.status).toBe("success");
      expect(result.current.data?.length).toBeGreaterThan(0);
    });

    it("useSimulatedCategories suporta filtro por tipo", () => {
      const { result: allCats } = renderHook(() => useSimulatedCategories(), {
        wrapper: createWrapper(),
      });
      const { result: expCats } = renderHook(() => useSimulatedCategories("expense"), {
        wrapper: createWrapper(),
      });

      expect(allCats.current.data?.length).toBeGreaterThan(expCats.current.data?.length ?? 0);
      expect(expCats.current.data?.every((c) => c.type === "expense")).toBe(true);
    });

    it("useSimulatedCreditCards e useSimulatedBudgets retornam datasets consistentes", () => {
      const { result: cards } = renderHook(() => useSimulatedCreditCards(), {
        wrapper: createWrapper(),
      });
      const { result: budgets } = renderHook(() => useSimulatedBudgets("2026-10"), {
        wrapper: createWrapper(),
      });

      expect(cards.current.data).toHaveLength(1);
      expect(budgets.current.data?.length).toBeGreaterThan(0);
    });

    it("useSimulatedCardExpenses e useSimulatedCardPayments filtram corretamente por cardId", () => {
      // Quando cardId for null, deve retornar array vazio
      const { result: emptyExpenses } = renderHook(() => useSimulatedCardExpenses(null), {
        wrapper: createWrapper(),
      });
      const { result: emptyPayments } = renderHook(() => useSimulatedCardPayments(null), {
        wrapper: createWrapper(),
      });

      expect(emptyExpenses.current.data).toEqual([]);
      expect(emptyPayments.current.data).toEqual([]);

      // Quando passar o id do cartão demo ("card-demo-black")
      const { result: cardExpenses } = renderHook(
        () => useSimulatedCardExpenses("card-demo-black"),
        { wrapper: createWrapper() },
      );
      const { result: cardPayments } = renderHook(
        () => useSimulatedCardPayments("card-demo-black"),
        { wrapper: createWrapper() },
      );

      expect(cardExpenses.current.data?.length).toBeGreaterThan(0);
      expect(cardExpenses.current.data?.every((e) => e.card_id === "card-demo-black")).toBe(true);

      expect(cardPayments.current.data?.length).toBeGreaterThan(0);
      expect(cardPayments.current.data?.every((p) => p.card_id === "card-demo-black")).toBe(true);
    });

    it("useSimulatedAllCardExpenses e useSimulatedAllCardPayments retornam visões consolidadas", () => {
      const { result: allCardExp } = renderHook(() => useSimulatedAllCardExpenses(), {
        wrapper: createWrapper(),
      });
      const { result: allCardPay } = renderHook(() => useSimulatedAllCardPayments(), {
        wrapper: createWrapper(),
      });

      expect(allCardExp.current.data?.length).toBeGreaterThan(0);
      expect(allCardExp.current.data?.every((e) => e.card_id !== null)).toBe(true);

      expect(allCardPay.current.data?.length).toBeGreaterThan(0);
      expect(allCardPay.current.data?.every((p) => p.amount > 0)).toBe(true);
    });

    it("useSimulatedPortfolioAssets retorna ativos diversificados", () => {
      const { result } = renderHook(() => useSimulatedPortfolioAssets(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data?.length).toBeGreaterThanOrEqual(6);
      expect(result.current.data?.some((a) => a.asset_class === "Renda Fixa")).toBe(true);
    });
  });

  describe("Interceptação transparente em hooks canônicos do sistema", () => {
    it("useExpenses retorna repositório real quando isDemoActive === false", async () => {
      mockListExpensesByMonth.mockResolvedValueOnce([
        { id: "real-exp-1", value: 99.9, description: "Gasto Real" },
      ]);

      const { result } = renderHook(() => useExpenses("2026-10"), {
        wrapper: createWrapper(),
      });

      // Em modo normal, chama o repositório
      expect(mockListExpensesByMonth).toHaveBeenCalledWith("2026-10");
      expect(result.current.isError).toBe(false);
    });

    it("useExpenses intercepta e retorna dados sintéticos sem chamar repositório quando isDemoActive === true", () => {
      act(() => {
        startDemo("finances");
      });

      const { result } = renderHook(() => useExpenses("2026-10"), {
        wrapper: createWrapper(),
      });

      // Não deve consultar o repositório do banco
      expect(mockListExpensesByMonth).not.toHaveBeenCalled();
      expect(result.current.data?.length).toBeGreaterThan(0);
      expect(result.current.data?.[0]?.user_id).toBe("demo-simulation-user");
    });

    it("useIncomes intercepta e retorna dados sintéticos quando isDemoActive === true", () => {
      act(() => {
        startDemo("finances");
      });

      const { result } = renderHook(() => useIncomes("2026-10"), {
        wrapper: createWrapper(),
      });

      expect(mockListIncomesByMonth).not.toHaveBeenCalled();
      expect(result.current.data?.length).toBeGreaterThan(0);
      expect(result.current.data?.[0]?.user_id).toBe("demo-simulation-user");
    });

    it("useCategories e useCreditCards interceptam e retornam mocks sem chamar banco", () => {
      act(() => {
        startDemo("finances");
      });

      const { result: cats } = renderHook(() => useCategories(), {
        wrapper: createWrapper(),
      });
      const { result: cards } = renderHook(() => useCreditCards(), {
        wrapper: createWrapper(),
      });

      expect(mockListCategories).not.toHaveBeenCalled();
      expect(mockListCreditCards).not.toHaveBeenCalled();
      expect(cats.current.data?.length).toBeGreaterThan(0);
      expect(cards.current.data?.length).toBe(1);
    });

    it("useBudgets intercepta e retorna orçamentos sintéticos quando isDemoActive === true", () => {
      act(() => {
        startDemo("finances");
      });

      const { result } = renderHook(() => useBudgets(), {
        wrapper: createWrapper(),
      });

      expect(mockListBudgets).not.toHaveBeenCalled();
      expect(result.current.data?.length).toBeGreaterThan(0);
    });

    it("usePortfolioAssets, usePortfolioSnapshots, useAllocationTargets e useGroupTargets interceptam no modo demo", () => {
      act(() => {
        startDemo("investments");
      });

      const { result: assets } = renderHook(() => usePortfolioAssets(), {
        wrapper: createWrapper(),
      });
      const { result: snapshots } = renderHook(() => usePortfolioSnapshots(), {
        wrapper: createWrapper(),
      });
      const { result: allocTargets } = renderHook(() => useAllocationTargets(), {
        wrapper: createWrapper(),
      });
      const { result: groupTargets } = renderHook(() => useGroupTargets("class"), {
        wrapper: createWrapper(),
      });

      expect(mockListPortfolioAssets).not.toHaveBeenCalled();
      expect(assets.current.data?.length).toBeGreaterThanOrEqual(6);
      expect(snapshots.current.data).toHaveLength(3);
      expect(allocTargets.current.data?.length).toBeGreaterThan(0);
      expect(groupTargets.current.data?.length).toBeGreaterThan(0);
    });

    it("useOnboardingCounts retorna contagens simuladas quando isDemoActive === true", () => {
      act(() => {
        startDemo("finances");
      });

      const { result } = renderHook(() => useOnboardingCounts(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual({
        expenseCategories: 6,
        incomeCategories: 3,
        cards: 1,
        transactions: 12,
        notificationsEnabled: false,
      });
    });

    it("useCardExpenses, useCardPayments, useAllCardExpenses e useAllCardPayments retornam repositório real quando isDemoActive === false", async () => {
      mockListExpensesByCard.mockResolvedValueOnce([
        { id: "real-exp-card", value: 50, card_id: "card-real-1" },
      ]);
      mockListCardPayments.mockResolvedValueOnce([
        { id: "real-pay-1", amount: 50, card_id: "card-real-1" },
      ]);
      mockListAllCardExpenses.mockResolvedValueOnce([]);
      mockListAllCardPayments.mockResolvedValueOnce([]);

      renderHook(() => useCardExpenses("card-real-1"), {
        wrapper: createWrapper(),
      });
      renderHook(() => useCardPayments("card-real-1"), {
        wrapper: createWrapper(),
      });
      renderHook(() => useAllCardExpenses(), {
        wrapper: createWrapper(),
      });
      renderHook(() => useAllCardPayments(), {
        wrapper: createWrapper(),
      });

      expect(mockListExpensesByCard).toHaveBeenCalledWith("card-real-1");
      expect(mockListCardPayments).toHaveBeenCalledWith("card-real-1");
      expect(mockListAllCardExpenses).toHaveBeenCalled();
      expect(mockListAllCardPayments).toHaveBeenCalled();
    });

    it("useCardExpenses, useCardPayments, useAllCardExpenses e useAllCardPayments interceptam e retornam mocks sem chamar banco quando isDemoActive === true", () => {
      act(() => {
        startDemo("finances");
      });

      const { result: cardExp } = renderHook(
        () => useCardExpenses("card-demo-black"),
        { wrapper: createWrapper() },
      );
      const { result: cardPay } = renderHook(
        () => useCardPayments("card-demo-black"),
        { wrapper: createWrapper() },
      );
      const { result: allExp } = renderHook(() => useAllCardExpenses(), {
        wrapper: createWrapper(),
      });
      const { result: allPay } = renderHook(() => useAllCardPayments(), {
        wrapper: createWrapper(),
      });

      expect(mockListExpensesByCard).not.toHaveBeenCalled();
      expect(mockListCardPayments).not.toHaveBeenCalled();
      expect(mockListAllCardExpenses).not.toHaveBeenCalled();
      expect(mockListAllCardPayments).not.toHaveBeenCalled();

      // Validação de retorno síncrono imediato (sem pending / loading)
      expect(cardExp.current.isLoading).toBe(false);
      expect(cardExp.current.isSuccess).toBe(true);
      expect(cardPay.current.isLoading).toBe(false);
      expect(cardPay.current.isSuccess).toBe(true);
      expect(allExp.current.isLoading).toBe(false);
      expect(allExp.current.isSuccess).toBe(true);
      expect(allPay.current.isLoading).toBe(false);
      expect(allPay.current.isSuccess).toBe(true);

      expect(cardExp.current.data?.length).toBeGreaterThan(0);
      expect(cardExp.current.data?.[0]?.card_id).toBe("card-demo-black");

      expect(cardPay.current.data?.length).toBeGreaterThan(0);
      expect(cardPay.current.data?.[0]?.card_id).toBe("card-demo-black");

      expect(allExp.current.data?.length).toBeGreaterThan(0);
      expect(allPay.current.data?.length).toBeGreaterThan(0);
    });

    it("transição em tempo de execução: desativar demo restaura reatividade para as queries reais", () => {
      act(() => {
        startDemo("finances");
      });

      const { result, rerender } = renderHook(() => useExpenses("2026-10"), {
        wrapper: createWrapper(),
      });

      expect(result.current.data?.[0]?.user_id).toBe("demo-simulation-user");
      expect(mockListExpensesByMonth).not.toHaveBeenCalled();

      // Encerra demo
      act(() => {
        endDemo();
      });

      rerender();

      // Após desativar demo, a query real é disparada
      expect(mockListExpensesByMonth).toHaveBeenCalledWith("2026-10");
    });
  });
});
