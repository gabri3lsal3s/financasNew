import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsButton } from "./notifications-button";

const mockUseReminders = vi.fn();
const mockUseOnboardingCounts = vi.fn();
const mockUseSmartAdvisorInsights = vi.fn();
const mockUseMyBroadcastNotifications = vi.fn();
let mockAdvisorInsightsInBell = false;
const mockHasFeature: (key: string) => boolean = (key: string) => key !== "investments";

vi.mock("@/features/overview/hooks", () => ({
  useSmartAdvisorInsights: () => mockUseSmartAdvisorInsights(),
}));

vi.mock("@/state", () => ({
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
        notificationCategories: { advisorInsights: mockAdvisorInsightsInBell },
      },
    },
    isLoading: false,
  }),
  useSetReminderState: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useReminderStates: () => ({ data: [], isLoading: false }),
  useMySupportTickets: () => ({ data: [], isLoading: false }),
  useMyBroadcastNotifications: () => mockUseMyBroadcastNotifications(),
  useMyPublicShares: () => ({ data: [], isLoading: false }),
  useUserSubscription: () => ({ isPro: true, isReadOnly: false, canWrite: true }),
  useMarkBroadcastAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useDismissBroadcastNotification: () => ({ mutate: vi.fn(), isPending: false }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false, toggleFamilyMode: vi.fn() }),
  useTripMode: () => ({ isTripModeEnabled: false, toggleTripMode: vi.fn(), isLoading: false }),
  useViewScope: () => ({ viewScope: "all" as const, effectiveViewScope: "all" as const, setViewScope: vi.fn(), isBusinessModeEnabled: false }),
  useBusinessMode: () => ({ isBusinessModeEnabled: false, businessProfile: null, toggleBusinessMode: vi.fn(), updateBusinessProfile: vi.fn(), isLoading: false, isPending: false }),
  useUserAccess: () => ({
    hasFeature: (key: string) => mockHasFeature(key),
    isAdmin: false,
    role: "user",
    status: "active",
  }),
}));

describe("NotificationsButton", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAdvisorInsightsInBell = false;
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
  it("renderiza o sininho com badge de contagem quando há pendências", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 3,
      overdueCount: 1,
      dueTodayCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações: 3 pendências" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("não renderiza nada (retorna null) quando não há pendências (totalCount === 0)", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });

    const { container } = render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });

  it("abre o popover ao clicar no sininho quando há notificações", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 2,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Notificações/i }));
    expect(await screen.findByText("Lembretes & Avisos", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("não renderiza o sininho apenas por passos de onboarding pendentes em conta nova", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });
    mockUseOnboardingCounts.mockReturnValue({
      data: { expenseCategories: 0, incomeCategories: 0, cards: 0, transactions: 0 },
    });

    const { container } = render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });

  it("aplica classes de tema corretas (bg-critical para urgente, bg-warning-strong para hoje, bg-primary padrão)", () => {
    // 1. Urgente (atrasadas)
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 2,
      overdueCount: 1,
      dueTodayCount: 0,
      isLoading: false,
    });
    const { rerender } = render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );
    expect(screen.getByText("2")).toHaveClass("bg-critical");

    // 2. Vencendo hoje
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 2,
      overdueCount: 0,
      dueTodayCount: 1,
      isLoading: false,
    });
    rerender(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );
    expect(screen.getByText("2")).toHaveClass("bg-warning-strong");

    // 3. Normal / informativa
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 2,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });
    rerender(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );
    expect(screen.getByText("2")).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("renderiza o sininho com badge crítico (bg-critical) quando há insight de prioridade 1 (crítico) no Smart Advisor com preferência ativa", () => {
    mockAdvisorInsightsInBell = true;
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: null,
      insights: [
        {
          id: "crit-1",
          themeKey: "dup:netflix",
          priority: 1,
          category: "critical",
          title: "Cobrança duplicada",
          description: "Detectamos cobrança duplicada",
          iconName: "alert-triangle",
        },
      ],
      currentIndex: 0,
      totalCount: 1,
      dismiss: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações: 1 pendência" })).toBeInTheDocument();
    expect(screen.getByText("1")).toHaveClass("bg-critical");
  });

  it("renderiza o sininho com badge de aviso (bg-warning-strong) quando há insight de prioridade 2 (vencimento do dia / renda) com preferência ativa", () => {
    mockAdvisorInsightsInBell = true;
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: null,
      insights: [
        {
          id: "due-today-1",
          themeKey: "due_today:aluguel",
          priority: 2,
          category: "critical",
          title: "Aluguel vence hoje",
          description: "Pagamento previsto para hoje",
          iconName: "alert-triangle",
        },
      ],
      currentIndex: 0,
      totalCount: 1,
      dismiss: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações: 1 pendência" })).toBeInTheDocument();
    expect(screen.getByText("1")).toHaveClass("bg-warning-strong");
  });

  it("inclui comunicados broadcast não lidos na contagem e aplica badge crítico quando urgente", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });
    mockUseMyBroadcastNotifications.mockReturnValue({
      data: [
        {
          id: "b-1",
          title: "Manutenção Programada",
          message: "Sistema em atualização às 23h.",
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
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações: 1 pendência" })).toBeInTheDocument();
    expect(screen.getByText("1")).toHaveClass("bg-critical");
  });
});
