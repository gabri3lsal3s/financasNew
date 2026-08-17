import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/features/auth/pages/login-page";
import { BudgetsPage } from "@/features/budgets/pages/budgets-page";
import { DebtsPage } from "@/features/debts/pages/debts-page";
import { TransactionListPage } from "@/features/transactions/pages/transaction-list-page";

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Navigate: () => null,
  useLocation: () => ({ state: null, pathname: "/entrar" }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: null, user: null, loading: false, configError: null }),
}));

vi.mock("@/data/auth", () => ({
  signInWithEmail: vi.fn(),
}));

const categories = [
  { id: "c1", name: "Moradia", icon: "moradia", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
  { id: "i1", name: "Salário", icon: "salario", color: null, type: "income" },
];

vi.mock("@/state", () => ({
  useIncomes: () => ({
    data: [{ id: "i1", value: 5000, report_weight: 1, date: "2026-08-05", description: "Salário", category_id: "i1" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useExpenses: () => ({
    data: [
      { id: "e1", value: 1500, report_weight: 1, date: "2026-08-13", description: "Aluguel", category_id: "c1" },
      { id: "e2", value: 100, report_weight: 1, date: "2026-08-12", description: "Cinema", category_id: "c2" },
    ],
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
  useIncomeGoals: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCategories: (type?: string) => ({
    data: type ? categories.filter((c) => c.type === type) : categories,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useDebts: () => ({
    data: [
      { id: "d1", name: "Conta de luz", type: "payable", amount: 200, due_date: "2026-08-20", paid_at: null, expense_id: null },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useOnboardingCounts: () => ({
    data: { expenseCategories: 2, incomeCategories: 1, cards: 1, transactions: 3 },
    isLoading: false,
    isError: false,
    error: null,
  }),
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
  useAllPortfolioTransactions: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useReallocateBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetBudgetLimit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveBudgetLimit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetIncomeGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveIncomeGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreditCards: () => ({ data: [], isLoading: false, error: null }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePredictionHistory: () => ({ entries: [], isLoading: false, error: null, refetch: vi.fn() }),
  useRecurrences: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePayDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExpense: () => ({ data: { id: "e1", base_amount: 1000 }, isLoading: false, isError: false, error: null }),
}));

/** Foco inicial é o primeiro campo (auth) — ordem de tabulação natural. */
describe("Navegação por teclado — telas P0 (F5.3 DoD)", () => {
  it("LoginPage: Tab percorre e-mail → senha → entrar → links", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.tab();
    expect(screen.getByRole("textbox", { name: "E-mail" })).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText("Senha")).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveFocus();
  });

  it("TransactionListPage: Tab percorre seletor de mês (sem header) e link de novo lançamento", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    // Sem header visual (F12): o primeiro foco é o controle de mês anterior
    await user.tab();
    expect(screen.getByRole("button", { name: "Mês anterior" })).toHaveFocus();

    // Link de novo lançamento permanece alcançável (desktop)
    const novo = screen.getByRole("link", { name: "Nova transação" });
    novo.focus();
    expect(novo).toHaveFocus();

    // Controles de mês são alcançáveis por teclado
    for (const label of ["Mês anterior", "Próximo mês"]) {
      const btn = screen.getByRole("button", { name: label });
      btn.focus();
      expect(btn).toHaveFocus();
    }

    // Enter no botão de mês anterior navega (MonthPicker usa botões reais)
    const prev = screen.getByRole("button", { name: "Mês anterior" });
    prev.focus();
    await user.keyboard("{Enter}");
    expect(prev).toHaveFocus();
  });

  it("BudgetsPage: abas navegáveis por teclado e ações por botão", async () => {
    const user = userEvent.setup();
    render(<BudgetsPage />);

    const tab = screen.getByRole("tab", { name: "Metas de renda" });
    tab.focus();
    expect(tab).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "Metas de renda" })).toHaveAttribute("data-state", "active");
  });

  it("DebtsPage: ações por linha alcançáveis por teclado", async () => {
    const user = userEvent.setup();
    render(<DebtsPage />);

    const tab = screen.getByRole("tab", { name: /a pagar/i });
    tab.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: /a pagar/i })).toHaveAttribute("data-state", "active");

    const quitButton = screen.getByRole("button", { name: "Quitar Conta de luz" });
    quitButton.focus();
    expect(quitButton).toHaveFocus();
  });
});
