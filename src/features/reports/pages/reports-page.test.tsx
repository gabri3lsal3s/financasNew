import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./reports-page";

const expenses = [
  { id: "e1", date: "2026-08-03", category_id: "c1", value: 1000, report_weight: 1, payment_method: "pix" },
  { id: "e2", date: "2026-08-04", category_id: "c2", value: 500, report_weight: 0.5, payment_method: "credit_card" },
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
    // Resumo: rendas 5.000 + recebível pago 1.000 = 6.000
    expect(screen.getByText("R$ 6.000,00")).toBeInTheDocument();
    // Merge: dívida paga somada → aparece a nota.
    expect(screen.getByText(/dívida\(s\) paga\(s\)/)).toBeInTheDocument();
  });

  it("mostra comparativo com o mês anterior", () => {
    render(<ReportsPage />);
    expect(screen.getByText("Rendas")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
  });

  it("permite alternar entre as abas de agregação (Categoria, Forma, Dia da semana)", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Aba Categoria ativa por padrão
    expect(screen.getByText("Alimentação")).toBeInTheDocument();

    // Clica na aba Por forma
    const formaTab = screen.getByRole("tab", { name: /Por forma/i });
    await user.click(formaTab);
    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();

    // Clica na aba Por dia da semana
    const weekdayTab = screen.getByRole("tab", { name: /Por dia da semana/i });
    await user.click(weekdayTab);
    expect(screen.getByText("Segunda")).toBeInTheDocument();
    expect(screen.getByText("Sábado")).toBeInTheDocument();
  });
});
