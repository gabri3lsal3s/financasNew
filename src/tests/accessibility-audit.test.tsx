import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterPage } from "@/features/auth/pages/register-page";
import { BudgetsPage } from "@/features/budgets/pages/budgets-page";
import { CardsPage } from "@/features/cards/pages/cards-page";
import { DebtsPage } from "@/features/debts/pages/debts-page";
import { OverviewPage } from "@/features/overview/pages/overview-page";
import { TransactionListPage } from "@/features/transactions/pages/transaction-list-page";
import { LaunchWizard } from "@/features/transactions/wizard/launch-wizard";

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useNavigate: () => vi.fn(),
  Navigate: () => null,
  useLocation: () => ({ state: null, pathname: "/entrar" }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: null, user: null, loading: false, configError: null }),
}));

vi.mock("@/data/auth", () => ({
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

const categories = [
  { id: "c1", name: "Moradia", icon: "moradia", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "i1", name: "Salário", icon: "salario", color: null, type: "income", is_reserved: false, is_active: true },
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
  useIncomeGoals: () => ({
    data: [{ category_id: "i1", month: "2026-08", expected: 5000 }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCategories: (type?: string) => ({
    data: type ? categories.filter((c) => c.type === type) : categories,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useDebts: () => ({
    data: [
      { id: "d1", name: "Conta de luz", type: "payable", amount: 200, due_date: "2026-08-20", paid_at: null, expense_id: null },
      { id: "d2", name: "A receber", type: "receivable", amount: 500, due_date: "2026-08-10", paid_at: null, expense_id: null },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAllCardExpenses: () => ({
    data: [{ id: "ce1", card_id: "card1", bill_competence: "2026-08", value: 100, report_weight: 1, description: "Mercado", date: "2026-08-05" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAllCardPayments: () => ({
    data: [{ id: "cp1", card_id: "card1", competence_month: "2026-08", amount: 40, date: "2026-08-10", note: null }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreditCards: () => ({
    data: [{ id: "card1", name: "Nubank", color: "#8B5CF6", closing_day: 10, due_day: 15, is_active: true }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useActiveCreditCards: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useCardExpenses: () => ({
    data: [{ id: "ce1", description: "Mercado", date: "2026-08-05", value: 100, report_weight: 1, bill_competence: "2026-08" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCardPayments: () => ({
    data: [{ id: "cp1", competence_month: "2026-08", amount: 40, date: "2026-08-10", note: null }],
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
  useCreateCardPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRefund: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateCard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePayDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExpense: () => ({ data: { id: "e1", base_amount: 1000 }, isLoading: false, isError: false, error: null }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

/**
 * Auditoria a11y (F5.3) — axe-core nas telas P0 (DESIGN_SYSTEM §9):
 * cada tela deve renderizar sem violações críticas de acessibilidade
 * (landmarks, labels, nomes de botões, contraste estrutural, teclado).
 */
describe("Auditoria de acessibilidade (axe) — telas P0", () => {
  it("LoginPage sem violações", async () => {
    const { container } = render(<LoginPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("RegisterPage sem violações", async () => {
    const { container } = render(<RegisterPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ForgotPasswordPage sem violações", async () => {
    const { container } = render(<ForgotPasswordPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("OverviewPage sem violações", async () => {
    const { container } = render(<OverviewPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("TransactionListPage sem violações", async () => {
    const { container } = render(<TransactionListPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("CardsPage sem violações", async () => {
    const { container } = render(<CardsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("DebtsPage sem violações", async () => {
    const { container } = render(<DebtsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("BudgetsPage sem violações", async () => {
    const { container } = render(<BudgetsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("LaunchWizard sem violações", async () => {
    const { container } = render(<LaunchWizard />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("telas interativas mantêm nomes acessíveis após interação (Cartões)", async () => {
    const user = userEvent.setup();
    const { container } = render(<CardsPage />);
    await user.click(screen.getByRole("button", { name: "Novo cartão" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
