import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./reports-page";

const expenses = [
  { id: "e1", date: "2026-08-03", category_id: "c1", value: 1000, report_weight: 1, payment_method: "pix" },
  { id: "e2", date: "2026-08-04", category_id: "c2", value: 500, report_weight: 1, payment_method: "credit_card" },
  { id: "e3", date: "2026-08-08", category_id: "c2", value: 500, report_weight: 1, payment_method: "credit_card" },
];
const incomes = [{ id: "i1", date: "2026-08-05", category_id: "c3", value: 5000, report_weight: 1 }];

vi.mock("@/state", () => ({
  useExpenses: (month: string) => ({
    data: month === "2026-08" ? expenses : [],
    isLoading: false,
    error: null,
  }),
  useIncomes: (month: string) => ({
    data: month === "2026-08" ? incomes : [],
    isLoading: false,
    error: null,
  }),
  useExpensesByRange: () => ({ data: [], isLoading: false, error: null }),
  useIncomesByRange: () => ({ data: [], isLoading: false, error: null }),
  useDebts: () => ({
    data: [
      { id: "d1", name: "Paga", type: "receivable", amount: 1000, due_date: "2026-08-10", paid_at: "2026-08-11" },
      { id: "d2", name: "Pendente", type: "payable", amount: 200, due_date: "2026-08-20", paid_at: null },
    ],
    isLoading: false,
    error: null,
  }),
  useCategories: () => ({
    data: [
      { id: "c1", name: "Alimentação", icon: "alimentacao", color: null, type: "expense" },
      { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
      { id: "c3", name: "Salário", icon: "salario", color: null, type: "income" },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe("ReportsPage (relatórios §3.6)", () => {
  it("agrega por categoria com totais e merge de dívidas pagas", () => {
    render(<ReportsPage />);
    // Categorias nas agregações.
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Lazer")).toBeInTheDocument();
    // Resumo: rendas 5.000 + recebível pago 1.000 = 6.000; despesas 2.000.
    expect(screen.getByText("R$ 6.000,00")).toBeInTheDocument();
    // Merge: dívida paga somada → aparece a nota.
    expect(screen.getByText(/dívida\(s\) paga\(s\)/)).toBeInTheDocument();
  });

  it("mostra comparativo com o mês anterior", () => {
    render(<ReportsPage />);
    // Despesas 2.000 vs anterior 0 → delta nulo (sem base). Rendas 6.000 vs 0 → nulo.
    expect(screen.getByText("Rendas")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
  });
});
