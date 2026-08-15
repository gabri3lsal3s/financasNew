import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionListPage } from "./transaction-list-page";

let params: URLSearchParams;
let requestedMonths: string[] = [];

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [params, vi.fn()],
}));

vi.mock("@/state", () => ({
  useCategories: () => ({ data: [], isLoading: false, error: null }),
  useExpenses: (month: string) => {
    requestedMonths.push(month);
    return {
      data: [
        {
          id: "e1",
          value: 250,
          date: "2026-01-15",
          description: "Mercado antigo",
          installments_total: 1,
          installment_number: 1,
          category_id: "c1",
          payment_method: "pix",
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useIncomes: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useCreditCards: () => ({ data: [], isLoading: false, error: null }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("TransactionListPage — deep-link da busca global (§3.9)", () => {
  it("inicializa o mês por ?month= e destaca o registro de ?q=", () => {
    params = new URLSearchParams("month=2026-01&q=e1");
    requestedMonths = [];
    render(<TransactionListPage />);

    // A query do mês foi usada (não o mês corrente).
    expect(requestedMonths).toContain("2026-01");
    expect(screen.getByText("Mercado antigo")).toBeInTheDocument();
    // Destaque aplicado na linha do registro (anel portfolio).
    expect(screen.getByText("Mercado antigo").closest(".ring-portfolio")).not.toBeNull();
  });

  it("sem parâmetro usa o mês corrente (sem destaque)", () => {
    params = new URLSearchParams("");
    requestedMonths = [];
    render(<TransactionListPage />);

    expect(requestedMonths[0]).toMatch(/^\d{4}-\d{2}$/);
    expect(screen.getByText("Mercado antigo").closest(".ring-portfolio")).toBeNull();
  });
});
