import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePermissionsStatus } from "./use-permissions-status";
import * as localNotifs from "./local-notifications";
import * as bankListener from "./bank-listener";

vi.mock("./local-notifications", () => ({
  checkNotificationPermissions: vi.fn(),
  requestNotificationPermissions: vi.fn(),
}));

vi.mock("./bank-listener", () => ({
  isNotificationListenerGranted: vi.fn(),
  requestNotificationListenerPermission: vi.fn(),
}));

vi.mock("./platform", () => ({
  isNativePlatform: vi.fn(() => false),
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}));

describe("usePermissionsStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inicializa consultando permissões de notificações e leitor bancário", async () => {
    vi.mocked(localNotifs.checkNotificationPermissions).mockResolvedValue({ granted: true });
    vi.mocked(bankListener.isNotificationListenerGranted).mockResolvedValue(true);

    const { result } = renderHook(() => usePermissionsStatus());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.postNotificationsGranted).toBe(true);
    expect(result.current.listenerGranted).toBe(true);
    expect(result.current.isChecking).toBe(false);
  });

  it("reflete estado de permissões negadas", async () => {
    vi.mocked(localNotifs.checkNotificationPermissions).mockResolvedValue({ granted: false });
    vi.mocked(bankListener.isNotificationListenerGranted).mockResolvedValue(false);

    const { result } = renderHook(() => usePermissionsStatus());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.postNotificationsGranted).toBe(false);
    expect(result.current.listenerGranted).toBe(false);
  });

  it("atualiza estado ao chamar requestPostNotifications", async () => {
    vi.mocked(localNotifs.checkNotificationPermissions)
      .mockResolvedValueOnce({ granted: false })
      .mockResolvedValue({ granted: true });
    vi.mocked(localNotifs.requestNotificationPermissions).mockResolvedValue({ granted: true });
    vi.mocked(bankListener.isNotificationListenerGranted).mockResolvedValue(false);

    const { result } = renderHook(() => usePermissionsStatus());

    await act(async () => {
      await result.current.refresh();
    });

    let granted = false;
    await act(async () => {
      granted = await result.current.requestPostNotifications();
    });

    expect(granted).toBe(true);
    expect(result.current.postNotificationsGranted).toBe(true);
  });

  it("atualiza estado ao chamar requestNotificationListener", async () => {
    vi.mocked(localNotifs.checkNotificationPermissions).mockResolvedValue({ granted: false });
    vi.mocked(bankListener.isNotificationListenerGranted)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    vi.mocked(bankListener.requestNotificationListenerPermission).mockResolvedValue(true);

    const { result } = renderHook(() => usePermissionsStatus());

    await act(async () => {
      await result.current.refresh();
    });

    let granted = false;
    await act(async () => {
      granted = await result.current.requestNotificationListener();
    });

    expect(granted).toBe(true);
    expect(result.current.listenerGranted).toBe(true);
  });
});
