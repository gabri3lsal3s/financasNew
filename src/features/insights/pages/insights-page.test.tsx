import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InsightsPage } from "./insights-page";

const setFeedbackMock = vi.fn();

const expenseCategories = [
  { id: "c1", name: "Alimentação", icon: "alimentacao", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
];
const incomeCategories = [{ id: "c3", name: "Salário", icon: "salario", color: null, type: "income" }];

function makeExpenseMonth(prefix: string) {
  return [
    { id: `${prefix}-1`, description: "Streaming", category_id: "c2", value: 1990, report_weight: 1, date: `${prefix}-05`, installment_group_id: null },
    { id: `${prefix}-2`, description: "Academia", category_id: "c2", value: 9900, report_weight: 1, date: `${prefix}-10`, installment_group_id: null },
  ];
}

vi.mock("@/state", () => ({
  useExpenses: (month: string) => ({
    data: month === "2026-08" ? makeExpenseMonth("2026-08") : makeExpenseMonth(month),
    isLoading: false,
    error: null,
  }),
  useIncomes: () => ({
    data: [{ id: "i1", value: 5000, report_weight: 1, category_id: "c3", date: "2026-08-05" }],
    isLoading: false,
    error: null,
  }),
  useBudgets: () => ({
    data: [{ category_id: "c1", month: "2026-08", limit: 2000 }],
    isLoading: false,
    error: null,
  }),
  useCategories: () => ({
    data: [...expenseCategories, ...incomeCategories],
    isLoading: false,
    error: null,
  }),
  useDebts: () => ({
    data: [
      { id: "d1", name: "Receber", type: "receivable", amount: 1000, due_date: "2026-08-20", paid_at: null },
    ],
    isLoading: false,
    error: null,
  }),
  useFeedback: () => ({
    data: {},
    isLoading: false,
    error: null,
  }),
  useSetFeedback: () => ({ mutate: setFeedbackMock }),
  usePortfolioPosition: () => ({
    rows: [],
    totalBRL: 0,
    cashBRL: 0,
    monthlySeries: [],
    monthlyContributionCents: 0,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("InsightsPage (motor de insights §3.7)", () => {
  it("renderiza a aba de alertas", () => {
    render(<InsightsPage />);
    expect(screen.getByRole("tab", { name: "Alertas" })).toBeInTheDocument();
  });

  it("lista assinaturas/recorrências e permite ignorar", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Assinaturas & recorrências" }));
    // Streaming com valor estável em 3 meses → assinatura.
    expect(screen.getByText("Streaming")).toBeInTheDocument();

    const ignoreButtons = screen.getAllByRole("button", { name: /Ignorar/ });
    expect(ignoreButtons.length).toBeGreaterThan(0);
    await user.click(ignoreButtons[0]!);
    expect(setFeedbackMock).toHaveBeenCalledWith({
      occurrenceKey: expect.any(String),
      decision: "ignore",
    });
  });

  it("renderiza projeção e corte com pendências", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Projeção & corte" }));
    expect(screen.getByText("Projeção de gastos")).toBeInTheDocument();
    expect(screen.getByText("Pendências do período")).toBeInTheDocument();
  });

  it("renderiza diagnósticos com tendência de gastos (F19 — motor §3.7.6)", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Diagnósticos" }));
    expect(screen.getByText("Saúde da poupança")).toBeInTheDocument();
    expect(screen.getByText("Tendência de gastos")).toBeInTheDocument();
    // Mês atual igual ao anterior (fixture) → variação 0.0% (não significativa).
    expect(screen.getByText("+0.0%")).toBeInTheDocument();
  });
});
