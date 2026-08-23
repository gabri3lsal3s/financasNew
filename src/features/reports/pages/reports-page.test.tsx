import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./reports-page";

function renderReports(initialEntry = "/relatorios") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ReportsPage />
    </MemoryRouter>,
  );
}

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
  useExpensesByRange: (start: string) => ({
    data: start === "2026-01-01" ? expenses : [],
    isLoading: false,
    error: null,
  }),
  useIncomesByRange: (start: string) => ({
    data: start === "2026-01-01" ? incomes : [],
    isLoading: false,
    error: null,
  }),
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
  usePortfolioContributions: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreditCards: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useDeleteExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAllCardPayments: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useActiveCreditCards: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

describe("ReportsPage (relatórios §3.6)", () => {
  it("agrega por categoria com totais e merge de dívidas pagas", () => {
    renderReports();
    // Categorias nas agregações.
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Lazer")).toBeInTheDocument();
    // Resumo: rendas 5.000 + recebível pago 1.000 = 6.000
    expect(screen.getByText("R$ 6.000,00")).toBeInTheDocument();
  });

  it("mostra comparativo com o mês anterior", () => {
    renderReports();
    expect(screen.getByText("Rendas")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
  });

  it("permite alternar para a aba 'Ano' e exibir dados anuais", async () => {
    const user = userEvent.setup();
    renderReports();

    const yearTab = screen.getByRole("tab", { name: "Ano" });
    await user.click(yearTab);

    // Deve exibir o seletor de ano
    expect(screen.getByRole("group", { name: "Selecionar ano" })).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();

    // Dados anuais agregados
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("R$ 6.000,00")).toBeInTheDocument();

    // Navega para o ano anterior
    await user.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("permite alternar entre as abas de agregação (Categorias, Formas, Dias)", async () => {
    const user = userEvent.setup();
    renderReports();

    // Aba Categoria ativa por padrão
    expect(screen.getByText("Alimentação")).toBeInTheDocument();

    // Clica na aba Formas
    const formaTab = screen.getByRole("tab", { name: "Formas" });
    await user.click(formaTab);
    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();

    // Clica na aba Dias
    const weekdayTab = screen.getByRole("tab", { name: "Dias" });
    await user.click(weekdayTab);
    expect(screen.getByText("Segunda")).toBeInTheDocument();
    expect(screen.getByText("Sábado")).toBeInTheDocument();
  });

  it("abre o modal de detalhamento ao clicar em uma categoria", async () => {
    const user = userEvent.setup();
    renderReports();

    const alimentacaoRow = screen.getByText("Alimentação");
    await user.click(alimentacaoRow);

    expect(screen.getByText("Despesas — Alimentação")).toBeInTheDocument();
    expect(screen.getByText("1 despesa")).toBeInTheDocument();
  });

  it("abre o modal de detalhamento ao clicar em uma forma de pagamento", async () => {
    const user = userEvent.setup();
    renderReports();

    const formaTab = screen.getByRole("tab", { name: "Formas" });
    await user.click(formaTab);

    const pixRow = screen.getByText("Pix");
    await user.click(pixRow);

    expect(screen.getByText("Despesas — Pix")).toBeInTheDocument();
    expect(screen.getByText("1 despesa")).toBeInTheDocument();
  });

  it("abre o modal de detalhamento ao clicar em um dia da semana", async () => {
    const user = userEvent.setup();
    renderReports();

    const weekdayTab = screen.getByRole("tab", { name: "Dias" });
    await user.click(weekdayTab);

    const segundaRow = screen.getByText("Segunda");
    await user.click(segundaRow);

    expect(screen.getByText("Despesas — Segunda")).toBeInTheDocument();
    expect(screen.getByText("1 despesa")).toBeInTheDocument();
  });
});
