import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./overview-page";

const reallocateMock = vi.fn();

const expenseCategories = [
  { id: "c1", name: "Moradia", icon: "moradia", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
];

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
    data:
      month === "2026-08"
        ? [
            { id: "e1", value: 3000, report_weight: 1, date: "2026-08-10", category_id: "c1" },
            { id: "e2", value: 100, report_weight: 1, date: "2026-08-12", category_id: "c2" },
          ]
        : [{ id: "e0", value: 2000, report_weight: 1, date: "2026-07-10", category_id: "c1" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
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
  useReallocateBudget: () => ({ mutateAsync: reallocateMock, isPending: false }),
  useOnboardingCounts: () => ({
    data: { expenseCategories: 2, incomeCategories: 1, cards: 1, transactions: 3 },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

describe("OverviewPage — visão consolidada (§3.6)", () => {
  it("exibe os KPIs fundamentais com peso de relatório", () => {
    render(<OverviewPage />);
    // "Receitas"/"Despesas" aparecem no KPI e na legenda do fluxo diário.
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Despesas").length).toBeGreaterThan(0);
    expect(screen.getByText("Saldo do mês")).toBeInTheDocument();
    // Receitas 5.000 · Despesas 3.100 · Saldo 1.900
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.100,00")).toBeInTheDocument();
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

  it("exibe o fluxo diário com barras empilhadas", () => {
    render(<OverviewPage />);
    expect(screen.getByText("Fluxo diário")).toBeInTheDocument();
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
  });

  it("lista categorias em atenção e sugere realocação", async () => {
    reallocateMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<OverviewPage />);

    // Moradia R$ 3.000/2.000 → Excedida; excesso R$ 1.000 → realoca para Lazer
    expect(screen.getByText("Excedida")).toBeInTheDocument();
    // Texto quebrado entre spans — valida a presença da sugestão por partes
    expect(screen.getByText(/Transfira/)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 1.000,00").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    await user.click(screen.getByRole("button", { name: "Aplicar realocação" }));

    expect(reallocateMock).toHaveBeenCalledTimes(1);
    const params = reallocateMock.mock.calls[0]?.[0];
    expect(params.fromCategoryId).toBe("c1");
    expect(params.toCategoryId).toBe("c2");
    expect(params.amount).toBe(1000);
  });
});
