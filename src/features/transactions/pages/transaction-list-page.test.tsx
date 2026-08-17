import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionListPage } from "./transaction-list-page";

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useExpenses: () => ({
    data: [
      {
        id: "e1",
        value: 1500,
        date: "2026-08-13",
        description: "Aluguel",
        installments_total: 1,
        installment_number: 1,
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomes: () => ({
    data: [{ id: "i1", value: 3500, date: "2026-08-05", description: "Salário" }],
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

describe("TransactionListPage — listagem por mês", () => {
  it("exibe receitas e despesas do mês com valores formatados", () => {
    render(<TransactionListPage />);

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("+R$ 3.500,00")).toBeInTheDocument();
    expect(screen.getByText("−R$ 1.500,00")).toBeInTheDocument();
  });

  it("calcula os KPIs de receitas, despesas e saldo", () => {
    render(<TransactionListPage />);
    // "Receitas"/"Despesas" aparecem no KPI e no título da seção.
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Despesas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saldo do mês").length).toBeGreaterThan(0);
    // Receitas 3.500,00 · Despesas 1.500,00 · Saldo 2.000,00
    expect(screen.getByText("R$ 3.500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.000,00")).toBeInTheDocument();
  });

  it("abre o modal de detalhamento de despesa ao clicar na linha de despesa", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    await user.click(screen.getByText("Aluguel"));
    expect(screen.getByRole("heading", { name: "Detalhes da despesa" })).toBeInTheDocument();
  });

  it("abre o modal de detalhamento de receita ao clicar na linha de receita", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    await user.click(screen.getByText("Salário"));
    expect(screen.getByRole("heading", { name: "Detalhes da receita" })).toBeInTheDocument();
  });
});
