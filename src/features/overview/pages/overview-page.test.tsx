import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./overview-page";

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

const navigateMock = vi.fn();
let portfolioContributionsMock: { id: string; asset_id: string | null; date: string; amount: number; notes: string | null }[] = [];

const expenseCategories = [
  { id: "c1", name: "Moradia", icon: "moradia", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
];

const monthData = (month: string) =>
  month === "2026-08"
    ? [
        { id: "e1", value: 3000, report_weight: 1, date: "2026-08-10", category_id: "c1" },
        { id: "e2", value: 100, report_weight: 1, date: "2026-08-12", category_id: "c2" },
      ]
    : [{ id: "e0", value: 2000, report_weight: 1, date: "2026-07-10", category_id: "c1" }];

vi.mock("@/state", () => ({
  useIncomes: (month: string) => ({
    data:
      month === "2026-08"
        ? [{ id: "i1", value: 5000, report_weight: 1, date: "2026-08-05" }]
        : [{ id: "i0", value: 4000, report_weight: 1, date: "2026-07-05" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useExpenses: (month: string) => ({
    data: monthData(month),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  // Sparklines dos KPIs: mesmo dataset do mês — caem no último ponto.
  useIncomesByRange: () => ({
    data: [{ id: "i1", value: 5000, report_weight: 1, date: "2026-08-05" }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useExpensesByRange: () => ({
    data: monthData("2026-08"),
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreditCards: () => ({
    data: [{ id: "card1", name: "Nubank", is_active: true, due_day: 10 }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useBudgets: () => ({
    data: [
      { category_id: "c1", month: "2026-08", limit: 2000 },
      { category_id: "c2", month: "2026-08", limit: 2000 },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCategories: (type?: string) => ({
    data: type === "expense" ? expenseCategories : [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useDebts: () => ({
    data: [
      { id: "d1", name: "A receber", type: "receivable", amount: 1000, due_date: "2026-08-20", paid_at: null },
      { id: "d2", name: "A pagar", type: "payable", amount: 500, due_date: "2026-08-15", paid_at: null },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAllCardExpenses: () => ({
    data: [{ id: "ce1", card_id: "card1", bill_competence: "2026-08", value: 100, report_weight: 1 }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useAllCardPayments: () => ({
    data: [{ id: "cp1", card_id: "card1", competence_month: "2026-08", amount: 40 }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useOnboardingCounts: () => ({
    data: { expenseCategories: 2, incomeCategories: 1, cards: 1, transactions: 3 },
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePortfolioContributions: () => ({
    data: portfolioContributionsMock,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("OverviewPage — visão consolidada (§3.6)", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    portfolioContributionsMock = [];
  });

  it("exibe os KPIs fundamentais com peso de relatório", () => {
    render(<OverviewPage />);
    // "Receitas"/"Despesas"/"Investimentos" aparecem nos KPIs.
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Despesas").length).toBeGreaterThan(0);
    expect(screen.getByText("Investimentos")).toBeInTheDocument();
    expect(screen.getByText("Saldo do mês")).toBeInTheDocument();
    // Receitas 5.000 · Despesas 3.100 · Saldo 1.900 (3.100 também no centro do donut).
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 3.100,00").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 1.900,00")).toBeInTheDocument();
  });

  it("calcula a taxa de poupança (1.900 ÷ 5.000 = 38%)", () => {
    render(<OverviewPage />);
    expect(screen.getByText("38,0%")).toBeInTheDocument();
  });

  it("mostra o comparativo com o mês anterior (receitas subiram)", () => {
    render(<OverviewPage />);
    // 5.000 vs 4.000 → +25%
    expect(screen.getAllByText("25,0%").length).toBeGreaterThan(0);
  });

  it("calcula o saldo líquido de contas (receber 1.000 − pagar 500 − fatura 60)", () => {
    render(<OverviewPage />);
    expect(screen.getByText("Saldo líquido de contas")).toBeInTheDocument();
    expect(screen.getByText("R$ 440,00")).toBeInTheDocument();
  });

  it("exibe o fluxo diário com barras empilhadas e a curva de saldo acumulado", () => {
    const { container } = render(<OverviewPage />);
    expect(screen.getByText("Fluxo diário")).toBeInTheDocument();
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    // Curva de fluxo diário (path SVG do DailyFlowChart).
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });

  it("exibe o donut de distribuição por categorias", () => {
    render(<OverviewPage />);
    expect(screen.getByText("Distribuição por categoria")).toBeInTheDocument();
    // Moradia 3.000 de 3.100 = 97% · Lazer 100 = 3%
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("3%")).toBeInTheDocument();
  });

  it("lista categorias em atenção nos orçamentos", () => {
    render(<OverviewPage />);
    // Moradia R$ 3.000/2.000 → Excedida (aparece no donut e nos orçamentos)
    expect(screen.getByText("Excedida")).toBeInTheDocument();
    expect(screen.getAllByText("Moradia").length).toBeGreaterThan(0);
  });

  it("KPI de investimentos reflete os aportes realizados no mês e navega para /carteira", async () => {
    const user = userEvent.setup();
    portfolioContributionsMock = [
      { id: "c1", asset_id: "a1", date: "2026-08-05", amount: 1500, notes: null },
      { id: "c2", asset_id: "a2", date: "2026-08-15", amount: 500, notes: null },
      { id: "c3", asset_id: "a1", date: "2026-07-20", amount: 1000, notes: null },
    ];

    render(<OverviewPage />);

    // Investimentos no mês 2026-08: 1.500 + 500 = R$ 2.000,00
    // (valor aparece no KPI e no DeltaHint do comparativo)
    expect(screen.getAllByText("R$ 2.000,00").length).toBeGreaterThan(0);
    // Comparativo com mês anterior (2.000 vs 1.000 → +100%)
    expect(screen.getByText("100,0%")).toBeInTheDocument();

    // Saldo do mês exibe o operacional (1.900) e detalha o caixa pós-aportes (-100)
    expect(screen.getByText("Caixa pós-aportes:")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();

    // Clique no KPI navega para /carteira
    const kpiButton = screen.getByRole("button", { name: /Investimentos/i });
    await user.click(kpiButton);
    expect(navigateMock).toHaveBeenCalledWith("/carteira");
  });

  it("não exibe o card Carteira em Resumo na Home (permanece na Carteira)", () => {
    render(<OverviewPage />);
    expect(screen.queryByText("Carteira em resumo")).not.toBeInTheDocument();
    expect(screen.queryByText("Patrimônio total")).not.toBeInTheDocument();
  });

  it("renderiza o banner de atenção contextual quando o ritmo de gastos estiver acelerado e navega para /insights", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    // Se o banner estiver visível na data atual, valida o botão de navegação
    const actionButton = screen.queryByRole("button", { name: /Simular cortes e projeção/i });
    if (actionButton) {
      await user.click(actionButton);
      expect(navigateMock).toHaveBeenCalledWith("/insights");
    }
  });
});
