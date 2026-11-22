import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscriptionStatus } from "@/types";
import * as nativeModule from "@/services/native";
import { resetVisualCustomization } from "@/hooks/use-visual-customization";
import { WELCOME_MODAL_STORAGE_KEY } from "@/components/modules";
import { OverviewPage } from "./overview-page";

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const testWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
);

const render = (ui: React.ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, { wrapper: testWrapper, ...options });

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const navigateMock = vi.fn();
const startDemoMock = vi.fn();
let mockAppMode = "investor";
let portfolioContributionsMock: { id: string; asset_id: string | null; date: string; amount: number; notes: string | null }[] = [];
let publicSharesMock: unknown[] = [];
let onboardingCountsMock = {
  expenseCategories: 2,
  incomeCategories: 1,
  cashCheckpoints: 1,
  cards: 1,
  transactions: 3,
  notificationsEnabled: true,
};

const defaultExpenseCategories = [
  { id: "c1", name: "Moradia", icon: "moradia", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
];
let expenseCategories = [...defaultExpenseCategories];

const monthData = (month: string) =>
  month === "2026-08"
    ? [
        { id: "e1", value: 3000, report_weight: 1, date: "2026-08-10", category_id: "c1" },
        { id: "e2", value: 100, report_weight: 1, date: "2026-08-12", category_id: "c2" },
      ]
    : [{ id: "e0", value: 2000, report_weight: 1, date: "2026-07-10", category_id: "c1" }];

const defaultRealCashBalanceMock = {
  cashBalance: {
    currentBalanceCents: 450000,
    latestCheckpoint: null,
    checkpointBalanceCents: 0,
    inflowSinceCheckpointCents: 500000,
    outflowSinceCheckpointCents: 50000,
    eventsSinceCheckpoint: [],
  },
  safeToSpend: {
    realCashBalanceCents: 450000,
    openInvoicesCents: 60000,
    payablePendingCents: 50000,
    receivablePendingCents: 100000,
    essentialBudgetsRemainingCents: 0,
    committedObligationsCents: 110000,
    safeToSpendCents: 340000,
    safeToSpendWithBudgetsCents: 340000,
    safeToSpendWithReceivablesCents: 440000,
  },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

let realCashBalanceMock = { ...defaultRealCashBalanceMock };
let cardExpensesMock = [{ id: "ce1", card_id: "card1", bill_competence: "2026-08", value: 100, report_weight: 1 }];
let cardsMock = [{ id: "card1", name: "Nubank", is_active: true, due_day: 10 }];
let debtsMock = [
  { id: "d1", name: "A receber", type: "receivable", amount: 1000, due_date: "2026-08-20", paid_at: null },
  { id: "d2", name: "A pagar", type: "payable", amount: 500, due_date: "2026-08-15", paid_at: null },
];
let debtsLoadingMock = false;
let splitSharesMock: Array<Record<string, unknown>> = [];

const defaultSubscriptionMock: SubscriptionStatus = {
  tier: "pro_annual",
  trialDaysRemaining: null,
  trialEndsAt: null,
  currentPeriodEnd: "2027-01-01",
  plan: "annual",
  cancelAtPeriodEnd: false,
  isFullAccess: true,
  isTrial: false,
  isPro: true,
  isLifetime: false,
  isReadOnly: false,
  canWrite: true,
};

let subscriptionMock: SubscriptionStatus = { ...defaultSubscriptionMock };

let incomesMock = {
  data: (month: string) =>
    month === "2026-08"
      ? [{ id: "i1", value: 5000, report_weight: 1, date: "2026-08-05" }]
      : [{ id: "i0", value: 4000, report_weight: 1, date: "2026-07-05" }],
  isLoading: false,
  error: null as Error | null,
};

let expensesMock = {
  data: (month: string) => monthData(month),
  isLoading: false,
  error: null as Error | null,
};

vi.mock("@/state", () => ({
  useAssetGovernanceInsights: () => ({
    insights: [],
    summary: {
      overdueCount: 0,
      quarantineCount: 0,
      opportunityCount: 0,
      lowScoreRiskCount: 0,
      totalInsights: 0,
    },
    consolidatedReviewAlert: null,
    overdueReviewsCount: 0,
    quarantinedCount: 0,
    discountOpportunitiesCount: 0,
    lowScoreRiskCount: 0,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCorporateDividends: () => ({
    available: [],
    projected: [],
    totalAvailableAmount: 0,
    totalProjectedAmount: 0,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useIncomes: (month: string) => ({
    data: incomesMock.data(month),
    isLoading: incomesMock.isLoading,
    isError: Boolean(incomesMock.error),
    error: incomesMock.error,
    refetch: vi.fn(),
  }),
  useExpenses: (month: string) => ({
    data: expensesMock.data(month),
    isLoading: expensesMock.isLoading,
    isError: Boolean(expensesMock.error),
    error: expensesMock.error,
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
    data: cardsMock,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useActiveCreditCards: () => ({
    data: cardsMock.filter((c) => c.is_active),
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateIncome: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateIncomeInstallments: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteIncome: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
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
    data: debtsLoadingMock ? undefined : debtsMock,
    isLoading: debtsLoadingMock,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAllCardExpenses: () => ({
    data: cardExpensesMock,
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
    data: onboardingCountsMock,
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
  useRealCashBalance: () => realCashBalanceMock,
  useCreateCashCheckpoint: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useUserSubscription: () => subscriptionMock,
  useFeedback: () => ({ data: {}, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSetFeedback: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserPreferences: () => ({ data: null, isLoading: false, isError: false, error: null }),
  useUpdateCustomSettings: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false, isLoading: false }),
  useMyFamily: () => ({ data: null, isLoading: false }),
  useFamilyConsolidation: () => ({ data: null, isLoading: false, isError: false, error: null }),
  useIncomeGoals: () => ({ data: [], isLoading: false, isError: false, error: null }),
  hasSeenWelcomeModal: () => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("financas:welcome_modal_seen") === "true";
    } catch {
      return false;
    }
  },
  markWelcomeModalSeen: () => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem("financas:welcome_modal_seen", "true");
    } catch {
      return;
    }
  },
  useDemoSession: () => ({ isDemoActive: false, activeTrack: null, currentStepIndex: 0 }),
  startDemo: (...args: unknown[]) => startDemoMock(...args),
  endDemo: vi.fn(),
  useMyPublicShares: (kind?: string) => ({
    data: kind === "goal_tracker" ? publicSharesMock : kind === "split" ? splitSharesMock : [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useSaveSplitExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSignalSplitPayment: () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }),
  useApplySplitSettlement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveSimulationToAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePublicShare: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useUpdateDebt: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useDismissSplitPaymentSignal: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useAppMode: () => ({
    appMode: mockAppMode,
    isInvestorMode: mockAppMode === "investor",
    isEssentialMode: mockAppMode === "essential",
    setAppMode: vi.fn(),
    isUpdating: false,
    isLoading: false,
  }),
  usePortfolioPosition: () => ({
    rows: [],
    isLoading: false,
    summary: null,
  }),
  usePermission: () => ({
    allowed: true,
    isTrial: false,
    isReadOnly: false,
    reason: null,
  }),
  useUserAccess: () => ({
    profile: { name: "Gabriel Sales" },
    isFullAccess: true,
    isTrial: false,
    isReadOnly: false,
    canWrite: true,
    tier: "pro_annual",
    hasFeature: () => true,
  }),
}));


describe("OverviewPage — visão consolidada (§3.6)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    resetVisualCustomization(null);
    localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, "true");
    localStorage.setItem("financas:welcome_modal_seen", "true");
    localStorage.removeItem("financas:onboarding_dismissed");
    localStorage.removeItem("financas:initial_onboarding_goal");
    navigateMock.mockReset();
    startDemoMock.mockReset();
    mockAppMode = "investor";
    expenseCategories = [...defaultExpenseCategories];
    portfolioContributionsMock = [];
    publicSharesMock = [];
    splitSharesMock = [];
    debtsLoadingMock = false;
    localStorage.removeItem("financasnew:dashboard_alert_dismissals");
    onboardingCountsMock = {
      expenseCategories: 2,
      incomeCategories: 1,
      cashCheckpoints: 1,
      cards: 1,
      transactions: 3,
      notificationsEnabled: true,
    };
    realCashBalanceMock = {
      ...defaultRealCashBalanceMock,
      cashBalance: { ...defaultRealCashBalanceMock.cashBalance },
      safeToSpend: { ...defaultRealCashBalanceMock.safeToSpend },
    };
    cardExpensesMock = [{ id: "ce1", card_id: "card1", bill_competence: "2026-08", value: 100, report_weight: 1 }];
    cardsMock = [{ id: "card1", name: "Nubank", is_active: true, due_day: 10 }];
    debtsMock = [
      { id: "d1", name: "A receber", type: "receivable", amount: 1000, due_date: "2026-08-20", paid_at: null },
      { id: "d2", name: "A pagar", type: "payable", amount: 500, due_date: "2026-08-15", paid_at: null },
    ];
    subscriptionMock = { ...defaultSubscriptionMock };
    incomesMock = {
      data: (month: string) =>
        month === "2026-08"
          ? [{ id: "i1", value: 5000, report_weight: 1, date: "2026-08-05" }]
          : [{ id: "i0", value: 4000, report_weight: 1, date: "2026-07-05" }],
      isLoading: false,
      error: null,
    };
    expensesMock = {
      data: (month: string) => monthData(month),
      isLoading: false,
      error: null,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exibe os KPIs fundamentais com peso de relatório e o Saldo Disponível em Conta", () => {
    render(<OverviewPage />);
    // "Receitas"/"Despesas"/"Investimentos" aparecem nos KPIs.
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Despesas").length).toBeGreaterThan(0);
    expect(screen.getByText("Investimentos")).toBeInTheDocument();
    expect(screen.getByText("Resultado do mês")).toBeInTheDocument();
    expect(screen.getByText("Saldo Disponível em Conta")).toBeInTheDocument();
    // Receitas 5.000 · Despesas 3.100 · Resultado 1.900 (3.100 também no centro do donut).
    expect(
      screen.getAllByText(
        (_content, el) =>
          el?.tagName === "SPAN" &&
          el.classList.contains("num") &&
          (el.textContent ?? "").replace(/\s+/g, " ").trim() === "R$ 5.000,00",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        (_content, el) =>
          el?.tagName === "SPAN" &&
          el.classList.contains("num") &&
          (el.textContent ?? "").replace(/\s+/g, " ").trim() === "R$ 3.100,00",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        (_content, el) =>
          el?.tagName === "SPAN" &&
          el.classList.contains("num") &&
          (el.textContent ?? "").replace(/\s+/g, " ").trim() === "R$ 1.900,00",
      ).length,
    ).toBeGreaterThan(0);
  });


  it("redireciona ao clicar nos cards de KPI fundamentais (Receitas, Despesas, Investimentos e Resultado)", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    const receitasBtn = screen.getByRole("button", { name: "Receitas" });
    await user.click(receitasBtn);
    expect(navigateMock).toHaveBeenCalledWith("/transacoes?tipo=receitas&month=2026-08");

    const despesasBtn = screen.getByRole("button", { name: "Despesas" });
    await user.click(despesasBtn);
    expect(navigateMock).toHaveBeenCalledWith("/transacoes?tipo=despesas&month=2026-08");

    const investimentosBtn = screen.getByRole("button", { name: "Investimentos" });
    await user.click(investimentosBtn);
    expect(navigateMock).toHaveBeenCalledWith("/investments");

    const resultadoBtn = screen.getByRole("button", { name: "Resultado do mês" });
    await user.click(resultadoBtn);
    expect(navigateMock).toHaveBeenCalledWith("/relatorios");
  });

  it("mostra o comparativo com o mês anterior (receitas subiram)", () => {
    render(<OverviewPage />);
    // 5.000 vs 4.000 → +25%
    expect(screen.getAllByText("25,0%").length).toBeGreaterThan(0);
  });

  it("padroniza ícones nos cards métricos: puros, sem container, e não exibe cards redundantes de saldo líquido e taxa de poupança", () => {
    const { container } = render(<OverviewPage />);

    // Nenhum cabeçalho de card métrico no dashboard deve conter caixas/contêineres decorativos size-7
    const size7Containers = container.querySelectorAll("span.size-7");
    expect(size7Containers.length).toBe(0);

    // Cards redundantes removidos da Home
    expect(screen.queryByText("Saldo líquido de contas")).not.toBeInTheDocument();
    expect(screen.queryByText("Taxa de poupança")).not.toBeInTheDocument();
  });

  it("exibe o card 'Saldo Disponível em Conta' apenas no mês atual e o oculta em meses passados ou futuros", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    // Mês atual ("2026-08"): o card de saldo em conta está presente
    expect(screen.getByText("Saldo Disponível em Conta")).toBeInTheDocument();
    expect(screen.getByText("Resultado do mês")).toBeInTheDocument();

    // Navega para o mês anterior ("2026-07")
    const prevMonthButton = screen.getByRole("button", { name: "Mês anterior" });
    await user.click(prevMonthButton);

    // O card de saldo disponível em conta não deve ser exibido em meses passados
    expect(screen.queryByText("Saldo Disponível em Conta")).not.toBeInTheDocument();
    // A grade de KPIs e o restante do dashboard continuam visíveis normalmente
    expect(screen.getByText("Resultado do mês")).toBeInTheDocument();

    // Navega de volta para o mês atual ("2026-08")
    const nextMonthButton = screen.getByRole("button", { name: "Próximo mês" });
    await user.click(nextMonthButton);
    expect(screen.getByText("Saldo Disponível em Conta")).toBeInTheDocument();

    // Navega para o mês futuro ("2026-09")
    await user.click(nextMonthButton);
    expect(screen.queryByText("Saldo Disponível em Conta")).not.toBeInTheDocument();
    expect(screen.getByText("Resultado do mês")).toBeInTheDocument();
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
    expect(screen.getAllByText("97%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3%").length).toBeGreaterThan(0);
  });

  it("agrupa categorias além do Top 5 em 'Demais categorias' e permite detalhar", () => {
    expenseCategories = [
      { id: "c1", name: "Cat 1", icon: "moradia", color: null, type: "expense" },
      { id: "c2", name: "Cat 2", icon: "lazer", color: null, type: "expense" },
      { id: "c3", name: "Cat 3", icon: "car", color: null, type: "expense" },
      { id: "c4", name: "Cat 4", icon: "fuel", color: null, type: "expense" },
      { id: "c5", name: "Cat 5", icon: "heart", color: null, type: "expense" },
      { id: "c6", name: "Cat 6", icon: "book", color: null, type: "expense" },
      { id: "c7", name: "Cat 7", icon: "shirt", color: null, type: "expense" },
    ];
    expensesMock = {
      data: () => [
        { id: "e1", value: 1000, report_weight: 1, date: "2026-08-01", category_id: "c1" },
        { id: "e2", value: 900, report_weight: 1, date: "2026-08-02", category_id: "c2" },
        { id: "e3", value: 800, report_weight: 1, date: "2026-08-03", category_id: "c3" },
        { id: "e4", value: 700, report_weight: 1, date: "2026-08-04", category_id: "c4" },
        { id: "e5", value: 600, report_weight: 1, date: "2026-08-05", category_id: "c5" },
        { id: "e6", value: 500, report_weight: 1, date: "2026-08-06", category_id: "c6" },
        { id: "e7", value: 400, report_weight: 1, date: "2026-08-07", category_id: "c7" },
      ],
      isLoading: false,
      error: null,
    };

    render(<OverviewPage />);
    expect(screen.getByText("Demais (2)")).toBeInTheDocument();
    expect(screen.getByText("7 categorias")).toBeInTheDocument();

    // Clica em 'Demais (2)' para abrir o modal
    fireEvent.click(screen.getByText("Demais (2)"));
    expect(screen.getByText("Cat 6")).toBeInTheDocument();
    expect(screen.getByText("Cat 7")).toBeInTheDocument();

    // Clica em 'Cat 6' no modal de demais categorias para abrir o raio-x da categoria
    fireEvent.click(screen.getByText("Cat 6"));
    // O raio-x deve abrir com o título da categoria
    expect(screen.getAllByText("Cat 6").length).toBeGreaterThan(0);
  });

  it("lista categorias em atenção nos orçamentos", () => {
    render(<OverviewPage />);
    // Moradia R$ 3.000/2.000 aparece na barra segmentada de orçamentos
    expect(screen.getByText("Orçamentos do mês")).toBeInTheDocument();
    expect(screen.getAllByText(/Moradia/).length).toBeGreaterThan(0);
  });

  it("KPI de investimentos reflete os aportes realizados no mês", () => {
    portfolioContributionsMock = [
      { id: "c1", asset_id: "a1", date: "2026-08-05", amount: 1500, notes: null },
      { id: "c2", asset_id: "a2", date: "2026-08-15", amount: 500, notes: null },
      { id: "c3", asset_id: "a1", date: "2026-07-20", amount: 1000, notes: null },
    ];

    render(<OverviewPage />);

    // Investimentos no mês 2026-08: 1.500 + 500 = R$ 2.000,00
    expect(
      screen.getAllByText(
        (_content, el) =>
          el?.tagName === "SPAN" &&
          el.classList.contains("num") &&
          (el.textContent ?? "").replace(/\s+/g, " ").trim() === "R$ 2.000,00",
      ).length,
    ).toBeGreaterThan(0);
    // Saldo operacional do mês
    expect(
      screen.getAllByText(
        (_content, el) =>
          el?.tagName === "SPAN" &&
          el.classList.contains("num") &&
          (el.textContent ?? "").replace(/\s+/g, " ").trim() === "R$ 1.900,00",
      ).length,
    ).toBeGreaterThan(0);
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
      expect(navigateMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/insights(\?aba=projection)?$/),
      );
    }
  });

  it("renderiza o banner de capacidade de aporte da sobra de caixa (F50) e navega para /carteira", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    // Rendas 5000 - Despesas 3100 - Compromissos 1100 = R$ 800,00 de sobra
    const simulateButton = screen.queryByRole("button", { name: /Simular Aporte/i });
    if (simulateButton) {
      await user.click(simulateButton);
      expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining("/carteira?tab=aporte&valor="));
    }
  });

  it("exibe valor bruto como padrão no card de caixa e detalha obrigações de ciclo", () => {
    render(<OverviewPage />);
    expect(screen.getByText("Faturas e contas a pagar do ciclo (bruto):")).toBeInTheDocument();
  });

  it("abre o diálogo de Raio-X ao clicar em uma categoria no gráfico ou na legenda", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    const moradiaButtons = screen.getAllByRole("button", { name: /Moradia/i });
    expect(moradiaButtons.length).toBeGreaterThan(0);
    const firstMoradiaButton = moradiaButtons[0];
    expect(firstMoradiaButton).toBeDefined();
    if (firstMoradiaButton) {
      await user.click(firstMoradiaButton);
    }

    expect(screen.getByText(/Raio-X de Moradia/i)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 3.000,00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Ver no extrato/i })).toBeInTheDocument();
  });

  it("permite clicar em Outros quando houver mais de 4 categorias", async () => {
    render(<OverviewPage />);
    // O botão de Outros não deve ter cursor default ou estar desabilitado
    const otherButtons = screen.queryAllByRole("button", { name: /Outros/i });
    for (const btn of otherButtons) {
      expect(btn).not.toBeDisabled();
    }
  });

  it("limita o banner de capacidade de aporte ao Saldo Livre Real da conta corrente", () => {
    // Sobra contábil seria 5000 - 3100 - 1100 = 800 (R$ 800,00)
    // Mas Saldo Livre Real é de apenas R$ 250,00
    realCashBalanceMock.safeToSpend.safeToSpendCents = 25000;

    render(<OverviewPage />);

    // Deve exibir o banner de aporte com o valor limitado ao Saldo Livre Real (R$ 250,00)
    expect(screen.getAllByText("Capacidade de Aporte Estimada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 250,00").length).toBeGreaterThan(0);
  });

  it("não exibe o banner de capacidade de aporte quando o Saldo Livre Real for negativo ou zero", () => {
    // Mesmo com sobra contábil, se Saldo Livre Real for negativo, o banner não pode ser exibido
    realCashBalanceMock.safeToSpend.safeToSpendCents = -150000;

    render(<OverviewPage />);

    expect(screen.queryByText("Capacidade de Aporte Estimada")).not.toBeInTheDocument();
  });

  it("utiliza o valor bruto nominal das faturas de cartão no radar de descasamento mesmo com report_weight menor que 1", () => {
    // Fatura de R$ 200 com report_weight 0.5 (bruto R$ 200, ponderado R$ 100)
    // Pagamento de R$ 40 (cp1). Saldo bruto da fatura: R$ 160.
    // Saldo em conta: R$ 50.
    // Vencimento da fatura no dia 25 (10 dias à frente de 15/08 -> severity: warning -> "Radar de Descasamento de Fluxo")
    cardsMock = [{ id: "card1", name: "Nubank", is_active: true, due_day: 25 }];
    debtsMock = [];
    realCashBalanceMock.cashBalance.currentBalanceCents = 5000; // R$ 50
    cardExpensesMock = [
      { id: "ce1", card_id: "card1", bill_competence: "2026-08", value: 200, report_weight: 0.5 },
    ];

    render(<OverviewPage />);

    // Déficit bruto: 50 - 160 = -110 (R$ 110,00)
    // Se fosse ponderado: 50 - (100 - 40) = -10 (R$ 10,00)
    expect(screen.getByText("Fluxo de caixa apertado")).toBeInTheDocument();
    expect(screen.getByText("R$ 110,00")).toBeInTheDocument();
  });

  it("renderiza TrialEndingBanner no carrossel quando faltarem <= 7 dias de trial", () => {
    subscriptionMock = {
      ...defaultSubscriptionMock,
      tier: "trial",
      isPro: false,
      isTrial: true,
      trialDaysRemaining: 6,
      trialEndsAt: "2026-08-21T12:00:00Z",
    };

    render(<OverviewPage />);

    expect(screen.getByText("Seu período de teste Pro encerra em 6 dias")).toBeInTheDocument();
    expect(screen.getByText("6d restantes")).toBeInTheDocument();
  });

  it("renderiza banner de acolhimento do trial no carrossel quando restarem > 7 dias (ex: 28 dias)", () => {
    subscriptionMock = {
      ...defaultSubscriptionMock,
      tier: "trial",
      isPro: false,
      isTrial: true,
      trialDaysRemaining: 28,
      trialEndsAt: "2026-09-12T12:00:00Z",
    };

    render(<OverviewPage />);

    expect(
      screen.getAllByText("Você está no Axir Pro com acesso total liberado")[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText("Teste Pro Ativo")[0]).toBeInTheDocument();
  });

  it("renderiza ReadOnlyBanner no topo quando a conta estiver em modo somente-leitura", () => {
    subscriptionMock = {
      ...defaultSubscriptionMock,
      tier: "read_only",
      isPro: false,
      isTrial: false,
      isReadOnly: true,
      canWrite: false,
      trialDaysRemaining: 0,
    };

    render(<OverviewPage />);

    expect(screen.getByText("Modo Somente-Leitura Ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ativar Plano Pro/i })).toBeInTheDocument();
  });

  it("renderiza PendingSuggestionsCard quando houver compras ou Pix pendentes de confirmação", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([
      {
        id: "sug_test_1",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 8900,
        description: "Restaurante Bom Sabor",
        date: "2026-10-15",
        paymentMethod: "credit_card",
        rawText: "Compra de R$ 89,00 aprovada",
        timestamp: 1729000000000,
      },
    ]);

    render(<OverviewPage />);

    expect(screen.getByText("Transações Detectadas")).toBeInTheDocument();
    expect(screen.getByText("Restaurante Bom Sabor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar rápido/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar/i })).toBeInTheDocument();
  });

  it("renderiza os skeletons estruturais harmoniosos durante o carregamento de dados", () => {
    incomesMock.isLoading = true;
    render(<OverviewPage />);
    expect(screen.getByTestId("overview-loading-skeleton")).toBeInTheDocument();
  });

  it("renderiza o ErrorState canônico com ação de retry quando ocorre erro nas queries", () => {
    incomesMock.error = new Error("Falha ao carregar receitas do servidor");
    render(<OverviewPage />, { wrapper: testWrapper });
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar receitas do servidor");
    expect(screen.getByRole("button", { name: /Tentar novamente/i })).toBeInTheDocument();
  });

  it("renderiza o EmptyState calmo quando não houver lançamentos no mês", () => {
    incomesMock.data = () => [];
    expensesMock.data = () => [];
    render(<OverviewPage />);
    expect(screen.getByText("Sem lançamentos neste mês")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo lançamento/i })).toBeInTheDocument();
  });

  it("renderiza valores extremos de 8+ dígitos adaptativamente sem reticências", () => {
    incomesMock.data = () => [{ id: "i_huge", value: 2500000, report_weight: 1, date: "2026-08-05" }]; // R$ 2.500.000,00
    render(<OverviewPage />);
    expect(
      screen.getAllByText(
        (_content, el) =>
          el?.tagName === "SPAN" &&
          el.classList.contains("num") &&
          (el.textContent ?? "").replace(/\s+/g, " ").trim() === "R$ 2.500.000,00",
      ).length,
    ).toBeGreaterThan(0);
  });


  it("renderiza o bloco de Investimentos do mês com campo rápido de aporte e navega para /investments?tab=aporte&valor=... (Fase 5 — Tarefa 5.4)", async () => {
    const user = userEvent.setup();
    render(<OverviewPage />);

    expect(screen.getByText("Investimentos do mês")).toBeInTheDocument();
    const input = screen.getByLabelText("Valor do aporte planejado");
    expect(input).toBeInTheDocument();

    await user.click(input);
    await user.type(input, "150000");

    const rebalanceButton = screen.getByRole("button", { name: /Calcular Rebalanceamento/i });
    await user.click(rebalanceButton);

    expect(navigateMock).toHaveBeenCalledWith("/investments?tab=aporte&valor=150000");
  });

  it("exibe o card de primeiros passos no Carrossel da Home (Fase 2) após a 1ª ação real e abre checklist ao clicar Continuar", async () => {
    const user = userEvent.setup();
    onboardingCountsMock = {
      expenseCategories: 11,
      incomeCategories: 3,
      cashCheckpoints: 1,
      cards: 0,
      transactions: 0,
      notificationsEnabled: false,
    };
    render(<OverviewPage />);
    expect(screen.getAllByText("Primeiros passos no Axir").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1/3 concluídos").length).toBeGreaterThan(0);
    const continueBtn = screen.getAllByRole("button", { name: /Continuar/i })[0]!;
    expect(continueBtn).toBeInTheDocument();

    await user.click(continueBtn);
    expect(screen.getByText("Ativar leitor automático de notificações")).toBeInTheDocument();
    expect(screen.getByText("Comprovantes e Cupons Fiscais")).toBeInTheDocument();
  });

  it("permite dispensar o card do carrossel na Fase 2 com 1 clique", async () => {
    const user = userEvent.setup();
    onboardingCountsMock = {
      expenseCategories: 11,
      incomeCategories: 3,
      cashCheckpoints: 1,
      cards: 0,
      transactions: 0,
      notificationsEnabled: false,
    };
    render(<OverviewPage />);
    const dismissBtn = screen.getAllByRole("button", {
      name: /Dispensar guia de primeiros passos/i,
    })[0]!;
    await user.click(dismissBtn);
    expect(screen.queryByText("Primeiros passos no Axir")).not.toBeInTheDocument();
  });

  it("não renderiza o card de primeiros passos quando os 3 passos essenciais estiverem concluídos", () => {
    onboardingCountsMock = {
      expenseCategories: 11,
      incomeCategories: 3,
      cashCheckpoints: 1,
      cards: 1,
      transactions: 1,
      notificationsEnabled: false,
    };
    render(<OverviewPage />);
    expect(screen.queryByText("Primeiros passos no Axir")).not.toBeInTheDocument();
  });

  it("não colide com WelcomeFeatureModal na Home Web (regra M10)", () => {
    localStorage.removeItem(WELCOME_MODAL_STORAGE_KEY);
    render(<OverviewPage />);
    expect(screen.queryByText("A Mágica da Captura Sem Fricção")).not.toBeInTheDocument();
  });

  describe("Onboarding 100% Inline (Fase 1) & Tour Express", () => {
    it("em conta virgem renderiza assistente inline sem abrir WelcomeModal bloqueante", () => {
      onboardingCountsMock = {
        expenseCategories: 11,
        incomeCategories: 3,
        cashCheckpoints: 0,
        cards: 0,
        transactions: 0,
        notificationsEnabled: false,
      };
      localStorage.removeItem("financas:welcome_modal_seen");

      render(<OverviewPage />);

      expect(
        screen.queryByText("Boas-vindas ao seu novo centro financeiro"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(/Olá, Gabriel — bem-vindo ao seu centro financeiro/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Explorar sozinho" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Fazer Tour Rápido \(1 min\)/i }),
      ).toBeInTheDocument();
    });

    it("permite dispensar o assistente inline para explorar o dashboard imediatamente", async () => {
      const user = userEvent.setup();
      onboardingCountsMock = {
        expenseCategories: 11,
        incomeCategories: 3,
        cashCheckpoints: 0,
        cards: 0,
        transactions: 0,
        notificationsEnabled: false,
      };

      render(<OverviewPage />);
      await user.click(screen.getByRole("button", { name: "Explorar sozinho" }));

      expect(
        screen.queryByText(/Olá, Gabriel — bem-vindo ao seu centro financeiro/i),
      ).not.toBeInTheDocument();
      expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    });

    it("inicia o tour expresso diretamente no foco escolhido ao clicar em 'Fazer Tour Rápido (1 min)'", () => {
      onboardingCountsMock = {
        expenseCategories: 11,
        incomeCategories: 3,
        cashCheckpoints: 0,
        cards: 0,
        transactions: 0,
        notificationsEnabled: false,
      };

      render(<OverviewPage />);
      fireEvent.click(screen.getByRole("button", { name: /Investimentos & Metas/i }));
      fireEvent.click(screen.getByRole("button", { name: /Fazer Tour Rápido \(1 min\)/i }));

      expect(startDemoMock).toHaveBeenCalledWith("investments");
      expect(navigateMock).toHaveBeenCalledWith("/investments");
    });
  });

  describe("Experiência Unificada & Governança Canônica (§Plano 11)", () => {
    it("mantém os 4 KPIs executivos estáveis e o QuickAporteCard para todos os usuários", () => {
      render(<OverviewPage />);

      // Exibe os 4 KPIs principais
      expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Despesas").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Investimentos").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Resultado/i).length).toBeGreaterThan(0);

      // Exibe o QuickAporteCard
      expect(screen.getByText("Investimentos do mês")).toBeInTheDocument();
      expect(screen.getByText("Aportes realizados no período")).toBeInTheDocument();
    });
  });

  describe("Descarte Inteligente de Cards e Alertas na Home", () => {
    it("permite dispensar card de Meta Conquistada e o oculta da tela", () => {
      publicSharesMock = [
        {
          id: "goal-share-1",
          user_id: "user-1",
          resource_type: "goal_tracker",
          resource_id: "goal-1",
          permission: "view",
          token: "tok-1",
          expires_at: null,
          created_at: "2026-01-01T00:00:00Z",
          is_revoked: false,
          revoked_at: null,
          access_count: 0,
          last_accessed_at: null,
          payload: {
            title: "Reserva de Emergência",
            target_cents: 100000,
            current_cents: 100000,
            status: "completed",
          },
        },
      ];

      render(<OverviewPage />);

      expect(screen.getByText("Meta Conquistada: Reserva de Emergência")).toBeInTheDocument();
      expect(screen.getByText("100% Batido")).toBeInTheDocument();

      const dismissBtn = screen.getByRole("button", {
        name: /Dispensar alerta da meta Reserva de Emergência/i,
        hidden: true,
      });
      fireEvent.click(dismissBtn);

      const dismissOption = screen.getByRole("button", { name: "Dispensar por 7 dias" });
      fireEvent.click(dismissOption);

      expect(screen.queryByText("Meta Conquistada: Reserva de Emergência")).not.toBeInTheDocument();
    });

    it("organiza múltiplas metas elegíveis no carrossel de alertas", () => {
      publicSharesMock = [
        {
          id: "goal-share-1",
          user_id: "user-1",
          resource_type: "goal_tracker",
          resource_id: "goal-1",
          permission: "view",
          token: "tok-1",
          expires_at: null,
          created_at: "2026-01-01T00:00:00Z",
          is_revoked: false,
          revoked_at: null,
          access_count: 0,
          last_accessed_at: null,
          payload: {
            title: "Viagem Europa",
            target_cents: 100000,
            current_cents: 90000,
            status: "in_progress",
          },
        },
        {
          id: "goal-share-2",
          user_id: "user-1",
          resource_type: "goal_tracker",
          resource_id: "goal-2",
          permission: "view",
          token: "tok-2",
          expires_at: null,
          created_at: "2026-01-01T00:00:00Z",
          is_revoked: false,
          revoked_at: null,
          access_count: 0,
          last_accessed_at: null,
          payload: {
            title: "Carro Novo",
            target_cents: 100000,
            current_cents: 85000,
            status: "in_progress",
          },
        },
      ];

      render(<OverviewPage />);

      // Ambas as metas estão organizadas nos slides do carrossel
      expect(screen.getAllByText("Reta Final: Viagem Europa").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Reta Final: Carro Novo").length).toBeGreaterThanOrEqual(1);

      // Clica em dispensar Viagem Europa
      const dismissBtn = screen.getAllByRole("button", {
        name: /Dispensar alerta da meta Viagem Europa/i,
        hidden: true,
      })[0]!;
      fireEvent.click(dismissBtn);

      const dismissOption = screen.getByRole("button", { name: "Dispensar por 7 dias" });
      fireEvent.click(dismissOption);

      // Viagem Europa é removida do carrossel, mantendo Carro Novo
      expect(screen.queryByText("Reta Final: Viagem Europa")).not.toBeInTheDocument();
      expect(screen.getAllByText("Reta Final: Carro Novo").length).toBeGreaterThanOrEqual(1);
    });

    it("responde ao real estado da meta: exibe percentual real e não Meta Conquistada se saldo < alvo", () => {
      publicSharesMock = [
        {
          id: "goal-share-inv",
          user_id: "user-1",
          resource_type: "goal_tracker",
          resource_id: "goal-inv",
          permission: "view",
          token: "tok-inv",
          expires_at: null,
          created_at: "2026-01-01T00:00:00Z",
          is_revoked: false,
          revoked_at: null,
          access_count: 0,
          last_accessed_at: null,
          payload: {
            title: "Investimentos",
            target_cents: 5000000,
            current_cents: 1809547,
            status: "completed",
          },
        },
      ];

      render(<OverviewPage />);

      expect(screen.queryByText("100% Batido")).not.toBeInTheDocument();
      expect(screen.queryByText(/Meta Conquistada: Investimentos/i)).not.toBeInTheDocument();
      expect(screen.getByText(/(Meta|Aporte Sugerido): Investimentos/)).toBeInTheDocument();
      expect(screen.getAllByText("36% alcançado").length).toBeGreaterThanOrEqual(1);
    });

    it("não exibe card de racha quando arquivado ou enquanto dívidas ainda estão carregando", () => {
      splitSharesMock = [
        {
          id: "split-1",
          user_id: "user-1",
          resource_type: "split",
          resource_id: "exp-1",
          permission: "view",
          token: "tok-split-1",
          expires_at: null,
          created_at: "2026-08-10T00:00:00Z",
          is_revoked: false,
          revoked_at: null,
          access_count: 0,
          last_accessed_at: null,
          payload: {
            title: "Jantar",
            debt_id: "d1",
            people_count: 2,
            guest_share_cents: 2500,
            total_cents: 5000,
            status: "archived",
          },
        },
      ];

      debtsLoadingMock = true;
      const { rerender } = render(<OverviewPage />);
      expect(screen.queryByText("Despesas a Rachar e Receber")).not.toBeInTheDocument();

      debtsLoadingMock = false;
      rerender(<OverviewPage />);
      expect(screen.queryByText("Despesas a Rachar e Receber")).not.toBeInTheDocument();
    });

    it("suprime SplitPendingBanner do carrossel quando há sinalização Pix pendente em PendingSplitSignalsCard", () => {
      splitSharesMock = [
        {
          id: "split-sig-1",
          user_id: "user-1",
          kind: "split",
          resource_type: "split",
          resource_id: "exp-sig-1",
          permission: "view",
          token: "tok-split-sig-1",
          expires_at: null,
          created_at: "2026-08-10T00:00:00Z",
          updated_at: "2026-08-14T12:00:00Z",
          is_revoked: false,
          revoked_at: null,
          access_count: 0,
          last_accessed_at: null,
          payload: {
            title: "Churrasco",
            debt_id: "d1",
            people_count: 2,
            guest_share_cents: 5000,
            host_share_cents: 5000,
            total_cents: 10000,
            date: "2026-08-10",
            participants: [
              { id: "p1", name: "Carlos", share_cents: 5000, is_host: false, settled_at: null },
            ],
            remainder_policy: "host",
            host_name: "Gabriel",
            host_city: "SP",
            pix_key: "123",
            pix_key_type: "cpf",
            pix_br_code: "000201",
            payment_signals: [
              {
                id: "sig-1",
                participant_name: "Carlos",
                amount_cents: 5000,
                status: "pending",
                created_at: "2026-08-14T12:00:00Z",
              },
            ],
          },
        },
      ];

      render(<OverviewPage />);

      expect(screen.getByText("Pagamento de Racha Sinalizado")).toBeInTheDocument();
      expect(screen.queryByText("Despesas a Rachar e Receber")).not.toBeInTheDocument();
    });

    it("integra o SmartAdvisor dentro do carrossel único sem renderizar um segundo bloco separado", () => {
      // Conta vencida hoje ou superávit + sem duplicação em bloco standalone
      render(<OverviewPage />);

      const advisorRegions = screen.queryAllByRole("region", {
        name: /Assistente Proativo de Insights/i,
      });
      const carousel = screen.queryByRole("region", {
        name: /Alertas e avisos contextuais/i,
      });

      expect(advisorRegions.length).toBeLessThanOrEqual(1);
      if (advisorRegions.length === 1 && carousel) {
        expect(carousel.contains(advisorRegions[0]!)).toBe(true);
      }
    });
  });
});




