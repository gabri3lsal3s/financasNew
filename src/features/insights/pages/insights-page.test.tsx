import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsightsPage } from "./insights-page";

const setFeedbackMock = vi.fn();

const expenseCategories = [
  { id: "c1", name: "Alimentação", icon: "alimentacao", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
];
const incomeCategories = [{ id: "c3", name: "Salário", icon: "salario", color: null, type: "income" }];

/** Fixture mutável (vi.hoisted — disponível no factory do mock) para os cenários F27. */
const fixture = vi.hoisted(() => ({
  incomeCents: 500_000,
  // Default: 2 despesas de Lazer por mês (11.890¢) em dias úteis.
  monthlyExpenses: (month: string) => [
    { id: `${month}-1`, description: "Streaming", category_id: "c2", value: 1990, report_weight: 1, date: `${month}-05`, installment_group_id: null },
    { id: `${month}-2`, description: "Academia", category_id: "c2", value: 9900, report_weight: 1, date: `${month}-10`, installment_group_id: null },
  ],
}));

vi.mock("@/state", () => ({
  useExpenses: (month: string) => ({
    data: fixture.monthlyExpenses(month),
    isLoading: false,
    error: null,
  }),
  useIncomes: () => ({
    data: [{ id: "i1", value: fixture.incomeCents / 100, report_weight: 1, category_id: "c3", date: "2026-08-05" }],
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
  it("renderiza a aba unificada 'Diagnósticos' como primeira", () => {
    render(<InsightsPage />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAccessibleName("Diagnósticos");
    // Alertas convertidos em avisos + KPIs de diagnóstico na mesma aba.
    expect(screen.getByText("Saúde da poupança")).toBeInTheDocument();
    expect(screen.getByText("Tendência de gastos")).toBeInTheDocument();
  });

  it("lista assinaturas/recorrências e permite ignorar", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Recorrências" }));
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

  it("permite confirmar assinatura via botão animado", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Recorrências" }));

    const confirmButtons = screen.getAllByRole("button", { name: /Confirmar/ });
    expect(confirmButtons.length).toBeGreaterThan(0);
    await user.click(confirmButtons[0]!);
    expect(setFeedbackMock).toHaveBeenCalledWith({
      occurrenceKey: expect.any(String),
      decision: "confirm",
    });
  });

  it("renderiza projeção e corte com pendências", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Projeção" }));
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

  it("diagnósticos: gastos de fim de semana comparáveis exibem a razão e sem alerta absurdo (F27)", async () => {
    const user = userEvent.setup();
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Diagnósticos" }));
    // Fixture: despesas só em dias úteis → razão 0.0× (comparável, sem alerta).
    expect(screen.getByText("0.0×")).toBeInTheDocument();
    expect(screen.queryByText(/gastos de fim de semana.*maiores/i)).not.toBeInTheDocument();
  });

  it("desafios: linha '30% em não essenciais' some quando duplica o desafio individual (F27 — dedup)", async () => {
    const user = userEvent.setup();
    // Lazer como única categoria de alto gasto não essencial (60.000 ≥ 10% da renda).
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Viagem", category_id: "c2", value: 60_000, report_weight: 1, date: `${month}-05`, installment_group_id: null },
    ];
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Projeção" }));
    // O desafio individual aparece (corta 30% da Lazer).
    expect(screen.getByText(/Lazer — cortar 30%/)).toBeInTheDocument();
    // A linha agregada fica oculta (mesma base de 1 categoria — repetição).
    expect(screen.queryByText("30% em não essenciais")).not.toBeInTheDocument();
  });

  it("desafios: linha '30% em não essenciais' aparece com 2+ categorias elegíveis (F27)", async () => {
    const user = userEvent.setup();
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Viagem", category_id: "c2", value: 60_000, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-2`, description: "Delivery", category_id: "c1", value: 55_000, report_weight: 1, date: `${month}-10`, installment_group_id: null },
    ];
    render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Projeção" }));
    expect(screen.getByText("30% em não essenciais")).toBeInTheDocument();
  });

  it("exibe avisos convertidos na seção de Avisos & Recomendações", () => {
    // Renda R$ 5.000, despesas R$ 118,90 -> poupança > 90%
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Streaming", category_id: "c2", value: 19.9, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-2`, description: "Academia", category_id: "c2", value: 99, report_weight: 1, date: `${month}-10`, installment_group_id: null },
    ];
    render(<InsightsPage />);
    expect(screen.getByRole("region", { name: "Avisos e recomendações" })).toBeInTheDocument();
    expect(screen.getByText(/Poupança saudável:/)).toBeInTheDocument();
  });

  it("exibe aviso de saldo negativo quando as despesas superam receitas", () => {
    // Renda R$ 50, despesas R$ 11.890
    fixture.incomeCents = 5_000;
    render(<InsightsPage />);
    expect(screen.getByText(/Saldo negativo:/)).toBeInTheDocument();
  });

  afterEach(() => {
    fixture.incomeCents = 500_000;
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Streaming", category_id: "c2", value: 1990, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-2`, description: "Academia", category_id: "c2", value: 9900, report_weight: 1, date: `${month}-10`, installment_group_id: null },
    ];
  });
});
