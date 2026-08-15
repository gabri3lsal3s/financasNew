import { render, screen } from "@testing-library/react";
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
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
});
