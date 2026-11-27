import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsPopover } from "./notifications-popover";

const mockUseReminders = vi.fn();
const mockUseOnboardingCounts = vi.fn();
const mockSetReminderStateMutate = vi.fn();
const mockMarkAllMutate = vi.fn();
const mockUseSmartAdvisorInsights = vi.fn();
const mockUseMyBroadcastNotifications = vi.fn();
let mockHasFeature: (key: string) => boolean = (key: string) => key !== "investments";

vi.mock("@/features/overview/hooks", () => ({
  useSmartAdvisorInsights: () => mockUseSmartAdvisorInsights(),
}));

vi.mock("@/state", () => ({
  useRealCashBalance: () => ({ cashBalance: { currentBalanceCents: 0 }, safeToSpend: { safeToSpendCents: 0 }, isLoading: false, error: null, refetch: vi.fn() }),
  useEmergencyFundComposition: () => ({ composition: { totalReserveCents: 0, cashInAccountsCents: 0, portfolioReserveCents: 0, breakdown: [], warnings: [], targetMonths: 6, targetMonthsProgressPercent: 0, targetMonthsCents: 0 }, config: { includeCheckingAccounts: true }, isLoading: false }),
  usePortfolioPosition: () => ({ rows: [], totalBRL: 0, cashBRL: 0, monthlySeries: [], monthlyContributionCents: 0, isLoading: false, error: null, refetch: vi.fn() }),
  useFeedbackEntries: () => ({ data: [], isLoading: false, error: null }),
  useDismissBroadcastNotification: () => ({ mutate: vi.fn(), isPending: false }),
  useAllDebts: () => ({ data: [], isLoading: false, error: null }),
  useAllBudgets: () => ({ data: [], isLoading: false, error: null }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false, toggleFamilyMode: vi.fn() }),
  useTripMode: () => ({ isTripModeEnabled: false, toggleTripMode: vi.fn(), isLoading: false }),
  useViewScope: () => ({ viewScope: "all", effectiveViewScope: "all", setViewScope: vi.fn(), isBusinessModeEnabled: false }),
  useBusinessMode: () => ({ isBusinessModeEnabled: false, businessProfile: null, toggleBusinessMode: vi.fn(), updateBusinessProfile: vi.fn(), isLoading: false, isPending: false }),
  useAllCardExpenses: () => ({ data: [], isLoading: false, error: null }),
  useAllCardPayments: () => ({ data: [], isLoading: false, error: null }),
  useBudgets: () => ({ data: [], isLoading: false, error: null }),
  useCategories: () => ({ data: [], isLoading: false, error: null }),
  useCorporateDividends: () => ({ data: [], isLoading: false, error: null }),
  useCreditCards: () => ({ data: [], isLoading: false, error: null }),
  useExpenses: () => ({ data: [], isLoading: false, error: null }),
  useIncomes: () => ({ data: [], isLoading: false, error: null }),
  useDebts: () => ({ data: [], isLoading: false, error: null }),
  useFeedback: () => ({ data: {}, isLoading: false, error: null }),
  useSetFeedback: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useCreateIncome: () => ({ mutateAsync: vi.fn() }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn() }),
  useCreateExpense: () => ({ mutateAsync: vi.fn() }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn() }),
  useUpdateCustomSettings: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useRecurrences: () => ({ data: [], isLoading: false, error: null }),
  useUserTrips: () => ({ data: [], isLoading: false, error: null }),
  useMyFamily: () => ({ data: null, isLoading: false, error: null }),
  usePortfolioAssets: () => ({ data: [], isLoading: false, error: null }),
  useReminders: () => mockUseReminders(),
  useOnboardingCounts: () => mockUseOnboardingCounts(),
  useUserPreferences: () => ({
    data: {
      custom_settings: {
        notificationCategories: { advisorInsights: true },
      },
    },
    isLoading: false,
  }),
  useSetReminderState: () => ({ mutate: mockSetReminderStateMutate, isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: mockMarkAllMutate, isPending: false }),
  useReminderStates: () => ({ data: [], isLoading: false }),
  useMySupportTickets: () => ({ data: [], isLoading: false }),
  useMyBroadcastNotifications: () => mockUseMyBroadcastNotifications(),
  useMyPublicShares: () => ({ data: [], isLoading: false }),
  useUserSubscription: () => ({ isPro: true, isReadOnly: false, canWrite: true }),
  useMarkBroadcastAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useUserAccess: () => ({
    hasFeature: (key: string) => mockHasFeature(key),
    isAdmin: false,
    role: "user",
    status: "active",
  }),
}));

describe("NotificationsPopover", () => {
  beforeEach(() => {
    localStorage.clear();
    mockHasFeature = (key: string) => key !== "investments";
    mockUseOnboardingCounts.mockReturnValue({
      data: {
        expenseCategories: 5,
        incomeCategories: 5,
        cards: 1,
        transactions: 1,
        cashCheckpoints: 1,
        notificationsEnabled: true,
      },
    });
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: null,
      insights: [],
      currentIndex: 0,
      totalCount: 0,
      dismiss: vi.fn(),
    });
    mockUseMyBroadcastNotifications.mockReturnValue({ data: [], isLoading: false });
  });
  it("renderiza lista com lembretes e permite marcar lido", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [
        {
          key: "debt:d1",
          title: "Empréstimo Banco",
          subtitle: "A pagar",
          dueDate: "2026-08-10",
          amountCents: 15000,
          status: "overdue",
          kind: "debt",
          link: { path: "/dividas", params: { q: "d1" } },
        },
      ],
      totalCount: 1,
      urgentCount: 1,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Lembretes & Avisos")).toBeInTheDocument();
    expect(screen.getByText("Empréstimo Banco")).toBeInTheDocument();
    expect(screen.getByText("Vencido")).toBeInTheDocument();

    const markReadBtn = screen.getByRole("button", { name: /Marcar Empréstimo Banco como lido/i });
    await user.click(markReadBtn);
    expect(mockSetReminderStateMutate).toHaveBeenCalledWith({
      occurrenceKey: "debt:d1",
      state: { kind: "read" },
    });
  });

  it("renderiza empty state quando não há itens", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Tudo em dia")).toBeInTheDocument();
  });

  it("renderiza item de configuração inicial quando há passos incompletos e permite dispensar", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });
    mockUseOnboardingCounts.mockReturnValue({
      data: {
        expenseCategories: 1,
        incomeCategories: 0,
        cards: 0,
        transactions: 0,
        cashCheckpoints: 1,
      },
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Configuração inicial")).toBeInTheDocument();
    expect(screen.getByText("1/2 passos")).toBeInTheDocument();

    const dismissBtn = screen.getByRole("button", { name: /Ignorar configuração inicial/i });
    await user.click(dismissBtn);

    expect(screen.queryByText("1/2 passos")).not.toBeInTheDocument();
  });

  it("renderiza passos e navega para rota de investimentos para usuário exclusivo de investimentos", async () => {
    const user = userEvent.setup();
    mockHasFeature = (key: string) => key === "investments";
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });
    mockUseOnboardingCounts.mockReturnValue({
      data: {
        expenseCategories: 0,
        incomeCategories: 0,
        cards: 0,
        transactions: 0,
        portfolioAssets: 0,
        portfolioTransactions: 0,
      },
    });

    let currentPath = "";
    function RouteTracker() {
      const location = useLocation();
      currentPath = location.pathname + location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteTracker />
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Configuração inicial")).toBeInTheDocument();
    expect(screen.getByText("0/2 passos")).toBeInTheDocument();

    await user.click(screen.getByText("Configuração inicial"));
    expect(currentPath).toBe("/investments?novo=ativo");
  });

  it("renderiza alertas críticos (prioridade 1) e de vencimento do dia (prioridade 2) do Smart Advisor", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: null,
      insights: [
        {
          id: "advisor-crit-1",
          themeKey: "dup:netflix",
          priority: 1,
          category: "critical",
          title: "Cobrança duplicada Netflix",
          description: "Detectamos duas cobranças de R$ 55,90",
          iconName: "alert-triangle",
          metadata: {
            valueCents: 5590,
            cardName: "Nubank",
          },
        },
        {
          id: "advisor-due-today-1",
          themeKey: "due_today:energia",
          priority: 2,
          category: "critical",
          title: "Conta de Energia",
          description: "Vencimento hoje",
          iconName: "alert-triangle",
          metadata: {
            valueCents: 21500,
          },
        },
        {
          id: "advisor-income-today-1",
          themeKey: "income:salario",
          priority: 2,
          category: "income",
          title: "Salário Previsto",
          description: "Entrada esperada para hoje",
          iconName: "arrow-down-left",
          metadata: {
            valueCents: 850000,
          },
        },
      ],
      currentIndex: 0,
      totalCount: 3,
      dismiss: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));

    // Verifica renderização dos itens e badges
    expect(screen.getByText("Cobrança duplicada Netflix")).toBeInTheDocument();
    expect(screen.getByText("Crítico")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();

    expect(screen.getByText("Conta de Energia")).toBeInTheDocument();
    expect(screen.getByText("Vence hoje")).toBeInTheDocument();

    expect(screen.getByText("Salário Previsto")).toBeInTheDocument();
    expect(screen.getByText("Entrada Prevista")).toBeInTheDocument();
  });

  it("permite dispensar alerta do Smart Advisor diretamente no popover com cooldown de 30 dias", async () => {
    const user = userEvent.setup();
    const mockDismiss = vi.fn();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: null,
      insights: [
        {
          id: "advisor-crit-1",
          themeKey: "dup:netflix",
          priority: 1,
          category: "critical",
          title: "Cobrança duplicada Netflix",
          description: "Detectamos duas cobranças de R$ 55,90",
          iconName: "alert-triangle",
        },
      ],
      currentIndex: 0,
      totalCount: 1,
      dismiss: mockDismiss,
    });

    render(
      <MemoryRouter>
        <NotificationsPopover onDismissAdvisor={mockDismiss}>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));

    const dismissBtn = screen.getByRole("button", { name: /Dispensar Cobrança duplicada Netflix/i });
    await user.click(dismissBtn);

    expect(mockDismiss).toHaveBeenCalledWith("dup:netflix", 30);
  });

  it("redireciona para o fluxo pré-preenchido ao clicar no card de alerta do assistente", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: null,
      insights: [
        {
          id: "advisor-due-today-1",
          themeKey: "due_today:energia",
          priority: 2,
          category: "critical",
          title: "Conta de Energia",
          description: "Vencimento hoje",
          iconName: "alert-triangle",
          primaryAction: {
            label: "Registrar despesa",
            kind: "register_expense",
            payload: {
              name: "Conta de Energia",
              valueCents: 21500,
              categoryId: "cat-luz",
              date: "2026-10-23",
            },
          },
          metadata: {
            valueCents: 21500,
            categoryId: "cat-luz",
            expectedDate: "2026-10-23",
          },
        },
      ],
      currentIndex: 0,
      totalCount: 1,
      dismiss: vi.fn(),
    });

    let currentSearch = "";
    function RouteTracker() {
      const location = useLocation();
      currentSearch = location.search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteTracker />
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    await user.click(screen.getByText("Conta de Energia"));

    expect(currentSearch).toContain("novo=despesa");
    expect(currentSearch).toContain("modo=rapido");
    expect(currentSearch).toContain("valor=21500");
    expect(currentSearch).toContain("categoria=cat-luz");
  });

  it("exibe badge e tom visual respeitando broadcast.type (ex: critical -> Urgente)", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });
    mockUseMyBroadcastNotifications.mockReturnValue({
      data: [
        {
          id: "b-crit",
          title: "Aviso Importante",
          message: "Verifique sua assinatura.",
          type: "critical",
          created_at: "2026-11-22T00:00:00Z",
          is_read: false,
          is_dismissed: false,
        },
      ],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Aviso Importante")).toBeInTheDocument();
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("exibe indicador '+N outros lembretes na Central' quando há mais de 6 lembretes pendentes", async () => {
    const user = userEvent.setup();
    const eightItems = Array.from({ length: 8 }, (_, idx) => ({
      key: `debt:d-${idx + 1}`,
      title: `Conta ${idx + 1}`,
      subtitle: "A pagar",
      dueDate: "2026-08-10",
      amountCents: 10000,
      status: "due_soon" as const,
      kind: "debt" as const,
      link: { path: "/dividas", params: { q: `d-${idx + 1}` } },
    }));

    mockUseReminders.mockReturnValue({
      items: eightItems,
      totalCount: 8,
      urgentCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText(/\+2 outros lembretes na Central/i)).toBeInTheDocument();
  });
});
