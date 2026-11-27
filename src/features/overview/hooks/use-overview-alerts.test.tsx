import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetCarouselDismissalsStore } from "@/hooks/use-carousel-dismissals";
import { useDashboardAlertDismissals, useOverviewPermissionsBanner } from "./use-overview-alerts";

const mockMutate = vi.fn();
let mockCustomSettings: Record<string, unknown> = {};
let mockPermissionsStatus = {
  postNotificationsGranted: false,
  listenerGranted: false,
  requestPostNotifications: vi.fn(),
  requestNotificationListener: vi.fn(),
  isChecking: false,
  refresh: vi.fn(),
};
let mockBankPrefs = {
  passiveCaptureEnabled: true,
  monitoredBanks: ["Nubank"],
};
const mockDismissedAlerts: Record<string, boolean> = {};

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: () => "user-1",
  getUserStorageKey: (base: string, uid?: string | null) => `${base}:${uid ?? "anon"}`,
  subscribeActiveUserId: () => () => {},
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/state/queries/use-user-preferences", () => ({
  useUserPreferences: () => ({
    data: { custom_settings: mockCustomSettings },
    isLoading: false,
    isPending: false,
    status: "success",
  }),
}));

vi.mock("@/state/mutations/use-preference-mutations", () => ({
  useUpdateCustomSettings: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("@/state", () => ({
  useUserPreferences: () => ({
    data: { custom_settings: mockCustomSettings },
    isLoading: false,
  }),
  useUpdateCustomSettings: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useUserAccess: () => ({
    hasFeature: (key: string) => key === "bank_notification_listener",
  }),
}));

vi.mock("@/services/native", () => ({
  isNativePlatform: () => true,
  isDueNotificationsEnabled: () => false,
  isDailyReminderEnabled: () => false,
  isPermissionAlertDismissed: (key: string) => Boolean(mockDismissedAlerts[key]),
  setDismissedPermissionAlert: vi.fn((key: string, val: boolean) => {
    mockDismissedAlerts[key] = val;
  }),
  useBankAssistantPreferences: () => ({ preferences: mockBankPrefs }),
  usePermissionsStatus: () => mockPermissionsStatus,
}));

describe("useOverviewPermissionsBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetCarouselDismissalsStore();
    delete mockDismissedAlerts.pushDue;
    delete mockDismissedAlerts.passiveBankListener;
    mockCustomSettings = {};
    mockBankPrefs = { passiveCaptureEnabled: true, monitoredBanks: ["Nubank"] };
    mockPermissionsStatus = {
      postNotificationsGranted: false,
      listenerGranted: false,
      requestPostNotifications: vi.fn(),
      requestNotificationListener: vi.fn(),
      isChecking: false,
      refresh: vi.fn(),
    };
  });

  it("considera dailyReminderEnabled na nuvem para detectar falta de permissão de push", () => {
    mockBankPrefs = { passiveCaptureEnabled: false, monitoredBanks: ["Nubank"] };
    mockCustomSettings = {
      deviceNotifications: {
        dueNotificationsEnabled: false,
        dailyReminderEnabled: true,
      },
    };

    const { result } = renderHook(() => useOverviewPermissionsBanner(vi.fn()));
    expect(result.current.shouldShowPermissionsBanner).toBe(true);
    expect(result.current.permissionBannerType).toBe("push_due");
  });

  it("dispensa bank_listener e push_due de forma granular e adiar uma capacidade mantém a outra disponível", () => {
    // Ambas as permissões ausentes simultaneamente (listener + POST)
    mockCustomSettings = {
      deviceNotifications: {
        dueNotificationsEnabled: false,
        dailyReminderEnabled: true,
      },
    };

    const navigateMock = vi.fn();
    const { result } = renderHook(() => useOverviewPermissionsBanner(navigateMock));
    expect(result.current.shouldShowPermissionsBanner).toBe(true);
    expect(result.current.permissionBannerType).toBe("both");

    act(() => {
      result.current.handlePermissionsBannerAction();
    });
    expect(navigateMock).toHaveBeenCalledWith("/configuracoes?tab=notifications");
    expect(mockPermissionsStatus.requestNotificationListener).not.toHaveBeenCalled();

    // Adiar sem especificar capacidade quando ambas faltam adia apenas bank_listener via carouselDismissals
    act(() => {
      result.current.handlePermissionsBannerDismiss("7d");
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        carouselDismissals: expect.objectContaining({
          "device.permissions.bank_listener": expect.objectContaining({ preset: "7d" }),
        }),
      }),
      expect.anything(),
    );
    // push_due permanece disponível após adiar bank_listener
    expect(result.current.shouldShowPermissionsBanner).toBe(true);
    expect(result.current.permissionBannerType).toBe("push_due");
  });

  it("não exibe banner de assistente bancário quando nenhum banco foi selecionado mesmo com captura ativa", () => {
    mockBankPrefs = { passiveCaptureEnabled: true, monitoredBanks: [] };
    mockCustomSettings = {
      deviceNotifications: {
        dueNotificationsEnabled: false,
        dailyReminderEnabled: false,
      },
    };

    const { result } = renderHook(() => useOverviewPermissionsBanner(vi.fn()));
    expect(result.current.shouldShowPermissionsBanner).toBe(false);
  });
});

describe("useDashboardAlertDismissals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomSettings = {};
    window.localStorage.clear();
  });

  it("mescla dispensas da nuvem com dispensas locais e atualiza o storage cache", () => {
    const cloudCards = {
      "cash-gap-alert": {
        dismissedAt: "2026-11-20T10:00:00.000Z",
        dismissedUntil: Date.now() + 7 * 86400000,
      },
    };
    mockCustomSettings = {
      dashboardAlertDismissals: {
        cards: cloudCards,
      },
    };

    const { result } = renderHook(() => useDashboardAlertDismissals());

    expect(result.current.alertDismissals.cards?.["cash-gap-alert"]).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("permite atualizar dispensas persistindo no custom_settings e no storage", () => {
    const { result } = renderHook(() => useDashboardAlertDismissals());

    act(() => {
      result.current.updateAlertDismissals((prev) => ({
        ...prev,
        cards: {
          ...(prev.cards ?? {}),
          "test-card": {
            dismissedAt: "2026-11-23T12:00:00.000Z",
            dismissedUntil: Date.now() + 7 * 86400000,
          },
        },
      }));
    });

    expect(mockMutate).toHaveBeenCalledWith({
      dashboardAlertDismissals: expect.objectContaining({
        cards: expect.objectContaining({
          "test-card": expect.any(Object),
        }),
      }),
    });
    expect(result.current.alertDismissals.cards?.["test-card"]).toBeDefined();
  });
});
