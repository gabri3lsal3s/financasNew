import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignOut } from "./use-sign-out";
import {
  deactivatePushSubscriptionByEndpoint,
  deactivatePushSubscriptionByFcmToken,
} from "@/data/repositories/push-subscriptions";
import { revokeOtherDevices } from "@/data/repositories/devices";
import { postSessionOperation } from "@/data/session-transport";
import { resetAppState } from "@/services/auth-cleanup";
import { clearNativeBankMonitoring } from "@/services/native/bank-listener";
import { clearDeviceSessionSync, getOrCreateDeviceId } from "@/services/native/device-info";
import { cancelDailyReminder, clearAllDueNotifications } from "@/services/native/local-notifications";
import { unregisterNativeFcmPush } from "@/services/push/fcm-push";
import { unsubscribeBrowserWebPush } from "@/services/push/web-push";
import { resetSessionContextForTests, setSessionContext } from "@/services/session-context";

vi.mock("@/services/auth-cleanup", () => ({
  resetAppState: vi.fn(),
}));

const mockClearGlobalAuthSession = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  clearGlobalAuthSession: () => mockClearGlobalAuthSession(),
}));

vi.mock("@/data/repositories/devices", () => ({
  revokeOtherDevices: vi.fn().mockResolvedValue(2),
}));

vi.mock("@/services/native/device-info", () => ({
  clearDeviceSessionSync: vi.fn(),
  getOrCreateDeviceId: vi.fn(() => "dev-current-1"),
}));

vi.mock("@/services/native/bank-listener", () => ({
  clearNativeBankMonitoring: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/native/local-notifications", () => ({
  clearAllDueNotifications: vi.fn().mockResolvedValue(undefined),
  cancelDailyReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/push/web-push", () => ({
  unsubscribeBrowserWebPush: vi.fn().mockResolvedValue({
    unsubscribed: true,
    endpoint: "https://push.example/endpoint-1",
  }),
}));

vi.mock("@/services/push/fcm-push", () => ({
  unregisterNativeFcmPush: vi.fn().mockResolvedValue({
    unregistered: true,
    token: "fcm-token-1",
  }),
}));

vi.mock("@/data/repositories/push-subscriptions", () => ({
  deactivatePushSubscriptionByEndpoint: vi.fn().mockResolvedValue(undefined),
  deactivatePushSubscriptionByFcmToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/data/session-transport", () => ({
  postSessionOperation: vi.fn().mockResolvedValue({
    status: "neutral",
    upstreamConfirmed: true,
    pendingRevocations: 0,
  }),
}));

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: vi.fn(() => "user-123"),
  isAdminPortalContext: vi.fn(() => false),
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
    resetSessionContextForTests();
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

  it("encerra outras sessões (scope others) e revoga demais dispositivos sem destruir estado local", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut({ scope: "others" });
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
    expect(getOrCreateDeviceId).toHaveBeenCalledTimes(1);
    expect(revokeOtherDevices).toHaveBeenCalledWith("dev-current-1");
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

  it("garante chamada de resetAppState no finally mesmo quando push e signOut falham com 401 pós-revogação", async () => {
    vi.mocked(deactivatePushSubscriptionByEndpoint).mockRejectedValueOnce({ status: 401 });
    vi.mocked(deactivatePushSubscriptionByFcmToken).mockRejectedValueOnce({ status: 401 });
    mockSignOut.mockRejectedValueOnce({ status: 401, message: "Session not found" });
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(clearNativeBankMonitoring).toHaveBeenCalledTimes(1);
    expect(clearAllDueNotifications).toHaveBeenCalledWith("user-123");
    expect(cancelDailyReminder).toHaveBeenCalledTimes(1);
    expect(mockClearGlobalAuthSession).toHaveBeenCalledTimes(1);
    expect(resetAppState).toHaveBeenCalledTimes(1);
    expect(resetAppState).toHaveBeenCalledWith(undefined, null);
  });

  it("não trava o logout no APK se unregisterNativeFcmPush ou supabase.auth.signOut ficarem pendentes (timeout)", async () => {
    vi.useFakeTimers();
    vi.mocked(unregisterNativeFcmPush).mockImplementationOnce(() => new Promise(() => {}));
    mockSignOut.mockImplementationOnce(() => new Promise(() => {}));
    localStorage.setItem("sb-demo-auth-token", "stale-token");

    const { result } = renderHook(() => useSignOut());

    let done = false;
    const signOutPromise = act(async () => {
      await result.current.signOut();
      done = true;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await signOutPromise;

    expect(done).toBe(true);
    expect(localStorage.getItem("sb-demo-auth-token")).toBeNull();
    expect(mockClearGlobalAuthSession).toHaveBeenCalledTimes(1);
    expect(resetAppState).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it("propaga erro em scope others quando revokeOtherDevices falha no servidor", async () => {
    vi.mocked(revokeOtherDevices).mockRejectedValueOnce(new Error("Falha server-side"));
    const { result } = renderHook(() => useSignOut());

    await expect(
      act(async () => {
        await result.current.signOut({ scope: "others" });
      }),
    ).rejects.toThrow("Falha server-side");
  });

  it("chama postSessionOperation('logout') antes de limpar o contexto local quando contextId está ativo", async () => {
    setSessionContext({
      status: "authenticated",
      contextId: "ctx-logout-1",
      csrfToken: "csrf-logout-1",
      generation: 1,
      revision: 1,
      environment: "production",
      mode: "personal",
      accountRef: "acc-1",
      displayName: "Gabriel",
      expiresAt: Date.now() + 60_000,
    });

    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(postSessionOperation).toHaveBeenCalledWith("logout", {
      scope: "device",
      remember: false,
    });
    const logoutOrder = vi.mocked(postSessionOperation).mock.invocationCallOrder[0];
    const resetOrder = vi.mocked(resetAppState).mock.invocationCallOrder[0];
    expect(logoutOrder).toBeLessThan(resetOrder);
  });

  it("não chama postSessionOperation('logout') quando não há contextId ativo", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(postSessionOperation).not.toHaveBeenCalled();
    expect(resetAppState).toHaveBeenCalledTimes(1);
  });

  it("tolera falha best-effort em postSessionOperation('logout') e garante resetAppState", async () => {
    setSessionContext({
      status: "authenticated",
      contextId: "ctx-logout-err",
      csrfToken: "csrf-logout-err",
      generation: 1,
      revision: 1,
      environment: "production",
      mode: "personal",
      accountRef: "acc-1",
      displayName: "Gabriel",
      expiresAt: Date.now() + 60_000,
    });
    vi.mocked(postSessionOperation).mockRejectedValueOnce(new Error("BFF offline"));

    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(postSessionOperation).toHaveBeenCalledWith("logout", {
      scope: "device",
      remember: false,
    });
    expect(resetAppState).toHaveBeenCalledTimes(1);
  });
});