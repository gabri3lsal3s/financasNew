import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationCenter } from "./use-notification-center";

const useSmartAdvisorInsightsMock = vi.fn();
let advisorInsightsPrefMock: boolean | undefined = true;
let remindersEnabledMock = true;

vi.mock("@/features/overview/hooks", () => ({
  useSmartAdvisorInsights: (...args: unknown[]) => useSmartAdvisorInsightsMock(...args),
}));

vi.mock("@/state", () => ({
  useUserAccess: () => ({ hasFeature: () => true }),
  useUserPreferences: () => ({
    data: {
      custom_settings: {
        notificationCategories:
          advisorInsightsPrefMock === undefined
            ? {}
            : { advisorInsights: advisorInsightsPrefMock },
      },
    },
    isLoading: false,
  }),
  useReminderStates: () => ({ data: [], isLoading: false }),
  useReminders: () => ({
    items: [],
    allItems: [],
    readHistoryItems: [],
    preferences: { enabled: remindersEnabledMock, billDaysBefore: 3, debtDaysBefore: 3 },
    totalCount: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    dueSoonCount: 0,
    receivableCount: 0,
    urgentCount: 0,
    readCount: 0,
    isLoading: false,
    error: null,
  }),
  useOnboardingCounts: () => ({ data: undefined, isLoading: false }),
  useMySupportTickets: () => ({ data: [], isLoading: false }),
  useMyBroadcastNotifications: () => ({ data: [], isLoading: false }),
  useMyPublicShares: () => ({ data: [], isLoading: false }),
  useUserSubscription: () => null,
  useCreditCards: () => ({ data: [], isLoading: false }),
  useAllCardExpenses: () => ({ data: [], isLoading: false }),
  useAllCardPayments: () => ({ data: [], isLoading: false }),
  useBudgets: () => ({ data: [], isLoading: false }),
  useExpenses: () => ({ data: [], isLoading: false }),
  useCategories: () => ({ data: [], isLoading: false }),
  useUserTrips: () => ({ data: [], isLoading: false }),
  useMyFamily: () => ({ data: null, isLoading: false }),
  useCorporateDividends: () => ({
    available: [],
    projected: [],
    recentlySettled: [],
    fxRate: 1,
    isLoading: false,
  }),
}));

describe("useNotificationCenter (Fase 3 — Gate do SmartAdvisor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    advisorInsightsPrefMock = true;
    remindersEnabledMock = true;
    useSmartAdvisorInsightsMock.mockReturnValue({
      insights: [
        {
          id: "adv-1",
          themeKey: "dup:netflix",
          priority: 1,
          category: "critical",
          title: "Cobrança duplicada",
          description: "Teste",
          iconName: "alert-triangle",
        },
      ],
      dismiss: vi.fn(),
    });
  });

  it("passa enabled: false para useSmartAdvisorInsights e não propaga insights quando advisorInsights === false", () => {
    advisorInsightsPrefMock = false;

    const { result } = renderHook(() => useNotificationCenter({ today: "2026-08-15" }));

    expect(useSmartAdvisorInsightsMock).toHaveBeenCalledWith({ enabled: false });
    expect(result.current.categoryPreferences.advisorInsights).toBe(false);
    expect(result.current.advisorAlerts).toEqual([]);
  });

  it("habilita useSmartAdvisorInsights quando advisorInsights === true e lembretes estão ativos", () => {
    advisorInsightsPrefMock = true;

    renderHook(() => useNotificationCenter({ today: "2026-08-15" }));

    expect(useSmartAdvisorInsightsMock).toHaveBeenCalledWith({ enabled: true });
  });
});
