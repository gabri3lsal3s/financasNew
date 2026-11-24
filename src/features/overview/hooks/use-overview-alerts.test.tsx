import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as nativeModule from "@/services/native";
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

  it("dispensa passiveBankListener e pushDue de forma independente", () => {
    // Somente bank listener faltando (due/daily desligados)
    mockCustomSettings = {
      deviceNotifications: {
        dueNotificationsEnabled: false,
        dailyReminderEnabled: false,
      },
    };

    const navigateMock = vi.fn();
    const { result } = renderHook(() => useOverviewPermissionsBanner(navigateMock));
    expect(result.current.shouldShowPermissionsBanner).toBe(true);
    expect(result.current.permissionBannerType).toBe("bank_listener");

    act(() => {
      result.current.handlePermissionsBannerAction();
    });
    expect(navigateMock).toHaveBeenCalledWith("/configuracoes?tab=notifications");
    expect(mockPermissionsStatus.requestNotificationListener).not.toHaveBeenCalled();

    act(() => {
      result.current.handlePermissionsBannerDismiss();
    });

    expect(nativeModule.setDismissedPermissionAlert).toHaveBeenCalledWith(
      "passiveBankListener",
      true,
    );
    expect(nativeModule.setDismissedPermissionAlert).not.toHaveBeenCalledWith(
      "pushDue",
      true,
    );
    expect(mockMutate).toHaveBeenCalledWith({
      deviceNotifications: expect.objectContaining({
        dismissedPermissionAlerts: { passiveBankListener: true },
      }),
    });

    // Agora usuário ativa dailyReminderEnabled no celular: o alerta push_due deve aparecer normalmente!
    mockCustomSettings = {
      deviceNotifications: {
        dueNotificationsEnabled: false,
        dailyReminderEnabled: true,
        dismissedPermissionAlerts: { passiveBankListener: true },
      },
    };
    const { result: nextResult } = renderHook(() => useOverviewPermissionsBanner(vi.fn()));
    expect(nextResult.current.shouldShowPermissionsBanner).toBe(true);
    expect(nextResult.current.permissionBannerType).toBe("push_due");
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
