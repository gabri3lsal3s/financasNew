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

let mockHasFeature: (key: string) => boolean = () => true;


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
      { id: "d1", description: "Paga", type: "receivable", remaining_amount: 1000, total_amount: 1000, due_date: "2026-08-10" },
      { id: "d2", description: "Pendente", type: "payable", remaining_amount: 200, total_amount: 200, due_date: "2026-08-20" },
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
  useUserPreferences: () => ({
    data: { report_weights_enabled: true },
    isLoading: false,
    error: null,
  }),

  usePortfolioContributions: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  usePortfolioPosition: () => ({
    data: {
      totalBRL: 80000,
      totalCostBRL: 70000,
      cashBRL: 15000,
      rows: [
        {
          assetId: "a1",
          ticker: "PETR4",
          name: "Petrobras PN",
          assetClass: "acoes",
          currency: "BRL",
          quantity: 100,
          averagePrice: 30,
          currentPrice: 38.5,
          valueBRL: 3850,
          unrealizedPnl: 850,
          unrealizedPnlPct: 28.33,
          totalDividends: 450,
          yieldOnCost: 15.0,
          isCash: false,
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
  usePortfolioAssets: () => ({
    data: [
      {
        id: "a1",
        ticker: "PETR4",
        name: "Petrobras PN",
        asset_class: "acoes",
        currency: "BRL",
        quantity: 100,
        average_price: 30,
        is_cash: false,
      },
    ],
    isLoading: false,
    error: null,
  }),
  usePortfolioDividends: () => ({
    data: [
      {
        id: "div1",
        asset_id: "a1",
        date: "2026-08-15",
        amount: 450,
        notes: "Proventos",
      },
    ],
    isLoading: false,
    error: null,
  }),
  useGroupTargets: () => ({
    data: [{ id: "g1", name: "acoes", target: 50 }],
    isLoading: false,
    error: null,
  }),
  useAllocationTargets: () => ({
    data: [{ asset_id: "a1", target_percentage: 50 }],
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
  useUserAccess: () => ({
    role: "user",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: (key: string) => mockHasFeature(key),
    isLoading: false,
  }),
}));



describe("ReportsPage (Central Unificada §F42)", () => {
  it("renderiza o Hub com o banner de exportação Excel e as 4 abas principais", () => {
    renderReports();
    expect(screen.getByText("Caderno de Relatórios em Excel (.xlsx)")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Finanças & DRE/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Investimentos & Carteira/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Balanço & Liberdade/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fiscal & IRPF/i })).toBeInTheDocument();
  });

  it("exibe os dados financeiros da aba Finanças & DRE por padrão", () => {
    renderReports();
    expect(screen.getByText("Receitas Totais")).toBeInTheDocument();
    expect(screen.getByText("Despesas Totais")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Lazer")).toBeInTheDocument();
  });

  it("permite alternar para a aba Investimentos & Carteira", async () => {
    const user = userEvent.setup();
    renderReports();

    const investTab = screen.getByRole("tab", { name: /Investimentos & Carteira/i });
    await user.click(investTab);

    expect(screen.getByText("Dossiê Executivo de Alocação & Patrimônio (A4/PDF)")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio Consolidado")).toBeInTheDocument();
    expect(screen.getByText("Defasagem de Metas por Classe")).toBeInTheDocument();
  });

  it("permite alternar para a aba Balanço & Liberdade", async () => {
    const user = userEvent.setup();
    renderReports();

    const balancoTab = screen.getByRole("tab", { name: /Balanço & Liberdade/i });
    await user.click(balancoTab);

    expect(screen.getByText("Balanço 360° & DRE Pessoal")).toBeInTheDocument();
    expect(screen.getByText("Dossiê de Liberdade Financeira")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio Líquido Real")).toBeInTheDocument();
  });

  it("permite alternar para a aba Fiscal & IRPF", async () => {
    const user = userEvent.setup();
    renderReports();

    const fiscalTab = screen.getByRole("tab", { name: /Fiscal & IRPF/i });
    await user.click(fiscalTab);

    expect(screen.getByText("Facilitador de Declaração de IRPF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir Fichas de IRPF/i })).toBeInTheDocument();
  });

  it("permite alternar as agregações de despesas (Categorias, Formas de Pgto, Dias da Semana)", async () => {
    const user = userEvent.setup();
    renderReports();

    // Clica em Formas de Pgto
    const formaButton = screen.getByRole("button", { name: "Formas de Pgto" });
    await user.click(formaButton);
    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();

    // Clica em Dias da Semana
    const weekdayButton = screen.getByRole("button", { name: "Dias da Semana" });
    await user.click(weekdayButton);
    expect(screen.getByText("Segunda")).toBeInTheDocument();
    expect(screen.getByText("Sábado")).toBeInTheDocument();
  });

  it("exibe o card executivo de Finanças & DRE e abre o modal ao clicar", async () => {
    const user = userEvent.setup();
    renderReports();

    expect(screen.getByText("Dossiê Executivo de Finanças Pessoais & DRE (A4/PDF)")).toBeInTheDocument();
    const openBtn = screen.getByRole("button", { name: /Visualizar & Imprimir Dossiê A4/i });
    await user.click(openBtn);

    expect(screen.getByText("Relatório Executivo de Finanças Pessoais & DRE")).toBeInTheDocument();
    expect(screen.getByText("DRE Pessoal — Demonstração do Período")).toBeInTheDocument();
  });

  it("mantém a barra de controle de período visível ao navegar entre abas", async () => {
    const user = userEvent.setup();
    renderReports();

    expect(screen.getByRole("button", { name: "Mensal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anual" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Personalizado" })).toBeInTheDocument();

    // Muda para Investimentos
    await user.click(screen.getByRole("tab", { name: /Investimentos & Carteira/i }));
    expect(screen.getByRole("button", { name: "Mensal" })).toBeInTheDocument();

    // Muda para Balanço
    await user.click(screen.getByRole("tab", { name: /Balanço & Liberdade/i }));
    expect(screen.getByRole("button", { name: "Mensal" })).toBeInTheDocument();
  });

  it("exibe apenas abas de investimentos e fiscal quando o core financeiro estiver desativado", () => {
    mockHasFeature = (key) => key === "investments" || key === "reports";
    renderReports();

    expect(screen.queryByRole("tab", { name: /Finanças & DRE/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Balanço & Liberdade/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Investimentos & Carteira/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fiscal & IRPF/i })).toBeInTheDocument();

    mockHasFeature = () => true;
  });
});



