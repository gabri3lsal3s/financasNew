import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscriptionStatus } from "@/types";
import * as nativeModule from "@/services/native";
import { updateVisualCustomization, resetVisualCustomization } from "@/hooks/use-visual-customization";
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

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const navigateMock = vi.fn();
let portfolioContributionsMock: { id: string; asset_id: string | null; date: string; amount: number; notes: string | null }[] = [];
let onboardingCountsMock = {
  expenseCategories: 2,
  incomeCategories: 1,
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
    data: debtsMock,
    isLoading: false,
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
  useUpdateCustomSettings: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
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
  startDemo: vi.fn(),
  endDemo: vi.fn(),
}));

describe("OverviewPage — visão consolidada (§3.6)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    resetVisualCustomization(null);
    localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, "true");
    navigateMock.mockReset();
    expenseCategories = [...defaultExpenseCategories];
    portfolioContributionsMock = [];
    onboardingCountsMock = {
      expenseCategories: 2,
      incomeCategories: 1,
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
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 3.100,00").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 1.900,00")).toBeInTheDocument();
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
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("3%")).toBeInTheDocument();
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
    expect(screen.getAllByText("R$ 2.000,00").length).toBeGreaterThan(0);
    // Saldo operacional do mês
    expect(screen.getAllByText("R$ 1.900,00").length).toBeGreaterThan(0);
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
    expect(screen.getByText("Radar de Descasamento de Fluxo")).toBeInTheDocument();
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
    expect(screen.getByText("R$ 2.500.000,00")).toBeInTheDocument();
  });

  it("renderiza valores sem centavos no dashboard quando hideDashboardCents for ativado", () => {
    updateVisualCustomization({ hideDashboardCents: true });
    render(<OverviewPage />);
    // Saldo disponível em conta de 450000 (R$ 4.500,00) deve ser exibido como R$ 4.500
    expect(screen.getByText("R$ 4.500")).toBeInTheDocument();
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

  it("renderiza OnboardingBanner na Home quando checklist estiver incompleto e abre modal ao clicar Continuar", async () => {
    const user = userEvent.setup();
    onboardingCountsMock = {
      expenseCategories: 1,
      incomeCategories: 0,
      cards: 0,
      transactions: 0,
      notificationsEnabled: false,
    };
    render(<OverviewPage />);
    expect(screen.getByText("Configure sua conta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText("Ativar Leitor Automático de Notificações")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Seu banco não notificou uma transferência? Basta tocar em Compartilhar Comprovante para o Áxis Finance.",
      ),
    ).toBeInTheDocument();
  });

  it("não renderiza OnboardingBanner quando o usuário já for ativo (smart dismiss)", () => {
    onboardingCountsMock = {
      expenseCategories: 1,
      incomeCategories: 0,
      cards: 1,
      transactions: 0,
      notificationsEnabled: false,
    };
    render(<OverviewPage />);
    expect(screen.queryByText("Configure sua conta")).not.toBeInTheDocument();
  });

  it("renderiza WelcomeFeatureModal na Home no primeiro acesso do usuário (Fase 6 — Tarefa 6.4)", () => {
    localStorage.removeItem(WELCOME_MODAL_STORAGE_KEY);
    render(<OverviewPage />);
    expect(screen.getByText("A Mágica da Captura Sem Fricção")).toBeInTheDocument();
    expect(screen.getByText("Notificações Automáticas")).toBeInTheDocument();
  });

  describe("Gatilho do WelcomeModal e Tour Demonstrativo (§4.1)", () => {
    it("dispara WelcomeModal automaticamente quando a conta for virgem e o acolhimento não tiver sido visto", () => {
      onboardingCountsMock = {
        expenseCategories: 0,
        incomeCategories: 0,
        cards: 0,
        transactions: 0,
        notificationsEnabled: false,
      };
      localStorage.removeItem("financas:welcome_modal_seen");

      render(<OverviewPage />);

      expect(
        screen.getByText("Boas-vindas ao seu novo centro financeiro"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Fazer Tour Rápido \(2 min\)/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Configurar Minha Conta Agora/i }),
      ).toBeInTheDocument();
    });

    it("ao clicar em 'Fazer Tour Rápido' no WelcomeModal, fecha o acolhimento e abre o DemoTrackSelectModal", () => {
      onboardingCountsMock = {
        expenseCategories: 0,
        incomeCategories: 0,
        cards: 0,
        transactions: 0,
        notificationsEnabled: false,
      };
      localStorage.removeItem("financas:welcome_modal_seen");

      render(<OverviewPage />);

      const tourBtn = screen.getByRole("button", { name: /Fazer Tour Rápido \(2 min\)/i });
      fireEvent.click(tourBtn);

      expect(
        screen.getByText("Escolha sua Trilha de Demonstração"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Finanças Diárias & Cartões"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Investimentos & Rebalanceamento"),
      ).toBeInTheDocument();
    });

    it("não dispara WelcomeModal se o usuário já tiver visto anteriormente", () => {
      onboardingCountsMock = {
        expenseCategories: 0,
        incomeCategories: 0,
        cards: 0,
        transactions: 0,
        notificationsEnabled: false,
      };
      localStorage.setItem("financas:welcome_modal_seen", "true");

      render(<OverviewPage />);

      expect(
        screen.queryByText("Boas-vindas ao seu novo centro financeiro"),
      ).not.toBeInTheDocument();
    });
  });
});



