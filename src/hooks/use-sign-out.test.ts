import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignOut } from "./use-sign-out";
import {
  deactivatePushSubscriptionByEndpoint,
  deactivatePushSubscriptionByFcmToken,
} from "@/data/repositories/push-subscriptions";
import { resetAppState } from "@/services/auth-cleanup";
import { clearNativeBankMonitoring } from "@/services/native/bank-listener";
import { clearDeviceSessionSync } from "@/services/native/device-info";
import { cancelDailyReminder, clearAllDueNotifications } from "@/services/native/local-notifications";
import { unregisterNativeFcmPush, unsubscribeBrowserWebPush } from "@/services/push";

vi.mock("@/services/auth-cleanup", () => ({
  resetAppState: vi.fn(),
}));

vi.mock("@/services/native/device-info", () => ({
  clearDeviceSessionSync: vi.fn(),
}));

vi.mock("@/services/native/bank-listener", () => ({
  clearNativeBankMonitoring: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/native/local-notifications", () => ({
  clearAllDueNotifications: vi.fn().mockResolvedValue(undefined),
  cancelDailyReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/push", () => ({
  unsubscribeBrowserWebPush: vi.fn().mockResolvedValue({
    unsubscribed: true,
    endpoint: "https://push.example/endpoint-1",
  }),
  unregisterNativeFcmPush: vi.fn().mockResolvedValue({
    unregistered: true,
    token: "fcm-token-1",
  }),
}));

vi.mock("@/data/repositories/push-subscriptions", () => ({
  deactivatePushSubscriptionByEndpoint: vi.fn().mockResolvedValue(undefined),
  deactivatePushSubscriptionByFcmToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: vi.fn(() => "user-123"),
}));

const mockSignOut = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}));

describe("useSignOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("limpa push Web, agendamentos locais e resetAppState no logout padrão (scope local)", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(clearDeviceSessionSync).toHaveBeenCalledTimes(1);
    expect(unsubscribeBrowserWebPush).toHaveBeenCalledTimes(1);
    expect(deactivatePushSubscriptionByEndpoint).toHaveBeenCalledWith(
      "https://push.example/endpoint-1",
    );
    expect(unregisterNativeFcmPush).toHaveBeenCalledWith("user-123");
    expect(deactivatePushSubscriptionByFcmToken).toHaveBeenCalledWith("fcm-token-1");
    expect(clearNativeBankMonitoring).toHaveBeenCalledTimes(1);
    expect(clearAllDueNotifications).toHaveBeenCalledWith("user-123");
    expect(cancelDailyReminder).toHaveBeenCalledTimes(1);
    expect(resetAppState).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("encerra outras sessões (scope others) sem destruir lembretes, push ou sessão local", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut({ scope: "others" });
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
    expect(clearDeviceSessionSync).not.toHaveBeenCalled();
    expect(unsubscribeBrowserWebPush).not.toHaveBeenCalled();
    expect(deactivatePushSubscriptionByEndpoint).not.toHaveBeenCalled();
    expect(unregisterNativeFcmPush).not.toHaveBeenCalled();
    expect(deactivatePushSubscriptionByFcmToken).not.toHaveBeenCalled();
    expect(clearNativeBankMonitoring).not.toHaveBeenCalled();
    expect(clearAllDueNotifications).not.toHaveBeenCalled();
    expect(cancelDailyReminder).not.toHaveBeenCalled();
    expect(resetAppState).not.toHaveBeenCalled();
  });

  it("garante chamada de resetAppState mesmo se supabase.auth.signOut lançar erro", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("Network failure"));
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(resetAppState).toHaveBeenCalledTimes(2);
  });
});
