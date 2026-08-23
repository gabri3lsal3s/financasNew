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
import { InsightsPage } from "@/features/insights/pages/insights-page";
import { InvestmentsPage } from "@/features/investments/pages/investments-page";
import { TransactionListPage } from "@/features/transactions/pages/transaction-list-page";
import { LaunchWizard } from "@/features/transactions/wizard/launch-wizard";

const portfolioTransactionsMock = vi.fn(() => [] as unknown[]);
const portfolioAssetsMock = vi.fn(() => [] as unknown[]);
const portfolioDividendsMock = vi.fn(() => [] as unknown[]);

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
  useAllCategories: () => ({
    data: categories,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCategoryUsage: () => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
  // Sparklines dos KPIs (F8) — OverviewPage.
  useExpensesByRange: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useIncomesByRange: () => ({ data: [], isLoading: false, isError: false, error: null }),
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
  useOnboardingCounts: () => ({
    data: { expenseCategories: 2, incomeCategories: 1, cards: 1, transactions: 3 },
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePortfolioPosition: () => ({
    rows: (portfolioAssetsMock() as Array<{ id: string; ticker: string; asset_class?: string; currency: "BRL" | "USD" }>).map((a) => ({
      assetId: a.id,
      ticker: a.ticker,
      assetClass: a.asset_class ?? "Ações",
      currency: a.currency ?? "BRL",
      quantity: 10,
      averageCost: 40,
      totalCost: 400,
      totalCostBRL: 400,
      averageCostBRL: 40,
      dividends: 0,
      priceBRL: 42.5,
      source: "api" as const,
      valueBRL: 425,
      unrealizedPct: 6.25,
      unrealizedPnl: 25,
      pct: 100,
      isCash: false,
    })),
    totalBRL: (portfolioAssetsMock() as unknown[]).length > 0 ? 425 : 0,
    totalCostBRL: (portfolioAssetsMock() as unknown[]).length > 0 ? 400 : 0,
    cashBRL: 0,
    monthlySeries: [
      { month: "2026-03", valueBRL: 425, costBRL: 400 },
      { month: "2026-04", valueBRL: 425, costBRL: 400 },
      { month: "2026-05", valueBRL: 425, costBRL: 400 },
      { month: "2026-06", valueBRL: 425, costBRL: 400 },
      { month: "2026-07", valueBRL: 425, costBRL: 400 },
      { month: "2026-08", valueBRL: 425, costBRL: 400 },
    ],
    monthlyContributionCents: 0,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePortfolioContributions: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreatePortfolioContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAllPortfolioTransactions: () => ({
    data: portfolioTransactionsMock(),
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
  useDeleteCard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCardPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePayDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncomeInstallments: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRecurrence: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecurrences: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExpense: () => ({ data: { id: "e1", base_amount: 1000 }, isLoading: false, isError: false, error: null }),
  useLoans: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreateLoanContract: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEarlyAmortizeLoan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteLoan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePredictionHistory: () => ({ entries: [], isLoading: false, error: null, refetch: vi.fn() }),
  usePortfolioAssets: () => ({ data: portfolioAssetsMock(), isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  usePortfolioDividends: () => ({ data: portfolioDividendsMock(), isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  usePortfolioSnapshots: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useDeletePortfolioDividend: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioDividend: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssetPrices: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSyncQuotes: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransactionsBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAllocationTargets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSaveAllocationTargets: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecordOrder: () => ({ mutateAsync: vi.fn().mockResolvedValue({ success: true }), isPending: false }),
  useAssetPosition: () => ({ data: [], isLoading: false, ledger: { dividends: 0 } }),
  useGroupTargets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSectorCaps: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useFeedback: () => ({ data: {}, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSetFeedback: () => ({ mutate: vi.fn(), isPending: false }),
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

  it("InvestmentsPage sem violações", async () => {
    const { container } = render(<InvestmentsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("InvestmentsPage — aba Proventos com extrato sem violações (F18)", async () => {
    portfolioDividendsMock.mockReturnValue([
      { id: "t1", user_id: "u1", asset_id: "a1", date: "2026-08-10", amount: 100, notes: "DIVIDENDO" },
      { id: "t2", user_id: "u1", asset_id: "a2", date: "2026-08-20", amount: 50.25, notes: "RENDIMENTO" },
    ]);
    portfolioAssetsMock.mockReturnValue([
      { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" },
      { id: "a2", user_id: "u1", ticker: "MXRF11", asset_class: "FIIs", currency: "BRL" },
    ]);
    const user = userEvent.setup();
    const { container } = render(<InvestmentsPage />);
    await user.click(screen.getByRole("tab", { name: "Proventos" }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("InsightsPage — aba Projeção (F24) sem violações", async () => {
    const user = userEvent.setup();
    const { container } = render(<InsightsPage />);
    await user.click(screen.getByRole("tab", { name: "Projeção" }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("telas interativas mantêm nomes acessíveis após interação (Cartões)", async () => {
    const user = userEvent.setup();
    const { container } = render(<CardsPage />);
    await user.click(screen.getByRole("button", { name: /adicionar novo cartão/i }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

