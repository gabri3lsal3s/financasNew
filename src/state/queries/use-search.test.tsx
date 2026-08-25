import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalSearchEntries } from "./use-search";
import type { SystemFeatureKey } from "@/types";

const mockListAllExpenses = vi.fn();
const mockListAllIncomes = vi.fn();
const mockListDebts = vi.fn();
const mockListCreditCards = vi.fn();
const mockListAllCategories = vi.fn();
const mockListPortfolioAssets = vi.fn();
const mockListBudgets = vi.fn();
const mockListRecurrences = vi.fn();

vi.mock("@/data/repositories/expenses", () => ({
  listAllExpenses: () => mockListAllExpenses(),
}));
vi.mock("@/data/repositories/incomes", () => ({
  listAllIncomes: () => mockListAllIncomes(),
}));
vi.mock("@/data/repositories/debts", () => ({
  listDebts: () => mockListDebts(),
}));
vi.mock("@/data/repositories/credit-cards", () => ({
  listCreditCards: () => mockListCreditCards(),
}));
vi.mock("@/data/repositories/categories", () => ({
  listAllCategories: () => mockListAllCategories(),
}));
vi.mock("@/data/repositories/portfolio", () => ({
  listPortfolioAssets: () => mockListPortfolioAssets(),
}));
vi.mock("@/data/repositories/budgets", () => ({
  listBudgets: () => mockListBudgets(),
}));
vi.mock("@/data/repositories/recurrences", () => ({
  listRecurrences: () => mockListRecurrences(),
}));

let mockIsAdmin = false;
let mockActiveFeatures: Set<SystemFeatureKey | string> = new Set([
  "overview",
  "transactions",
  "cards",
  "investments",
  "debts",
  "budgets",
  "reports",
  "insights",
  "reminders",
]);

vi.mock("./use-user-access", () => ({
  useUserAccess: () => ({
    isAdmin: mockIsAdmin,
    hasFeature: (key: string) => mockActiveFeatures.has(key),
  }),
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

describe("useGlobalSearchEntries (§F73 — Blindagem de Módulos & Feature Flags)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = false;
    mockActiveFeatures = new Set([
      "overview",
      "transactions",
      "cards",
      "investments",
      "debts",
      "budgets",
      "reports",
      "insights",
      "reminders",
    ]);

    mockListAllExpenses.mockResolvedValue([
      {
        id: "exp-1",
        description: "Supermercado Pão de Açúcar",
        value: 150,
        date: "2026-08-10",
        payment_method: "credit_card",
        category_id: "cat-1",
      },
    ]);
    mockListAllIncomes.mockResolvedValue([]);
    mockListDebts.mockResolvedValue([
      {
        id: "debt-1",
        name: "Empréstimo Caixa",
        amount: 5000,
        type: "payable",
        due_date: "2026-09-01",
        paid_at: null,
      },
    ]);
    mockListCreditCards.mockResolvedValue([]);
    mockListAllCategories.mockResolvedValue([
      { id: "cat-1", name: "Alimentação", type: "expense" },
    ]);
    mockListPortfolioAssets.mockResolvedValue([
      {
        id: "ast-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30,
      },
    ]);
    mockListBudgets.mockResolvedValue([]);
    mockListRecurrences.mockResolvedValue([]);
  });

  it("retorna itens de todos os módulos quando todas as flags estão ativas", async () => {
    const { result } = renderHook(() => useGlobalSearchEntries(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).toContain("exp-1");
    expect(ids).toContain("debt-1");
    expect(ids).toContain("ast-1");
    expect(ids).toContain("page-overview");
    expect(ids).toContain("page-investments");
    expect(ids).not.toContain("page-admin"); // não é admin
  });

  it("permite página admin quando o usuário for administrador", async () => {
    mockIsAdmin = true;

    const { result } = renderHook(() => useGlobalSearchEntries(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).toContain("page-admin");
  });

  it("desativa queries e omite resultados de módulos inativos", async () => {
    // Apenas transações ativas; investimentos e dívidas desativados
    mockActiveFeatures = new Set(["overview", "transactions"]);

    const { result } = renderHook(() => useGlobalSearchEntries(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Queries de investimentos e dívidas não devem nem ter sido chamadas
    expect(mockListPortfolioAssets).not.toHaveBeenCalled();
    expect(mockListDebts).not.toHaveBeenCalled();

    // Query de despesas deve ter sido chamada
    expect(mockListAllExpenses).toHaveBeenCalled();

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).toContain("exp-1");
    expect(ids).toContain("page-overview");
    expect(ids).toContain("page-transactions");
    expect(ids).toContain("action-new-expense");

    // Itens de investimentos e dívidas foram completamente suprimidos
    expect(ids).not.toContain("ast-1");
    expect(ids).not.toContain("page-investments");
    expect(ids).not.toContain("action-new-asset");
    expect(ids).not.toContain("debt-1");
    expect(ids).not.toContain("page-debts");
    expect(ids).not.toContain("action-new-debt");
  });
});
