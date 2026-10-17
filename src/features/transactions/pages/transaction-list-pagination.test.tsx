import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionListPage } from "./transaction-list-page";
import type { Expense } from "@/types";

vi.mock("@/services/export-actions", () => ({
  downloadCsv: vi.fn(),
  shareText: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useNavigate: () => vi.fn(),
}));

// Gera 75 despesas para testar o particionamento em páginas de 50
const mockExpenses: Expense[] = Array.from({ length: 75 }).map((_, i) => ({
  id: `exp-${i + 1}`,
  user_id: "user-1",
  date: "2026-08-15",
  description: `Compra Supermercado ${i + 1}`,
  value: 50 + i,
  base_amount: 50 + i,
  report_weight: 1,
  payment_method: "pix",
  card_id: null,
  category_id: "cat-1",
  installment_number: 1,
  installments_total: 1,
  installment_group_id: null,
  installments_group_id: null,
  bill_competence: null,
  recurrence_id: null,
  created_at: "2026-08-15T12:00:00Z",
  updated_at: "2026-08-15T12:00:00Z",
}));

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  usePermission: () => ({
    isHidden: false,
    canRead: true,
    canWrite: true,
    isReadOnlyMode: false,
    accessLevel: "admin",
  }),
  useCategories: () => ({
    data: [{ id: "cat-1", name: "Alimentação", color: "#10b981", icon: "Utensils", nature: "expense" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useExpenses: () => ({
    data: mockExpenses,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomes: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreditCards: () => ({ data: [], isLoading: false, error: null }),
  useRecurrences: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("TransactionListPage — Paginação Progressiva (Fase 6 — 60 FPS)", () => {
  it("limita a renderização inicial a 50 transações e exibe o botão Carregar mais", () => {
    render(<TransactionListPage />);

    // Em empate de data, a ordenação é por valor decrescente (itens 75 até 26)
    expect(screen.getByText("Compra Supermercado 75")).toBeInTheDocument();
    expect(screen.getByText("Compra Supermercado 26")).toBeInTheDocument();
    // O item 1 (menor valor) ainda não deve estar no DOM na primeira página
    expect(screen.queryByText("Compra Supermercado 1")).not.toBeInTheDocument();

    const loadMoreBtn = screen.getByRole("button", {
      name: /Carregar mais lançamentos/i,
    });
    expect(loadMoreBtn).toBeInTheDocument();
    expect(screen.getByText(/Exibindo 50 de 75 lançamentos/i)).toBeInTheDocument();
  });

  it("ao clicar em Carregar mais, revela os itens restantes do lote", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    const loadMoreBtn = screen.getByRole("button", {
      name: /Carregar mais lançamentos/i,
    });
    await user.click(loadMoreBtn);

    // Agora o item 1 (menor valor) deve estar visível
    expect(screen.getByText("Compra Supermercado 1")).toBeInTheDocument();
    expect(screen.getByText("Compra Supermercado 75")).toBeInTheDocument();

    // Como todos os 75 já foram carregados, o botão desaparece
    expect(
      screen.queryByRole("button", { name: /Carregar mais lançamentos/i }),
    ).not.toBeInTheDocument();
  });
});
