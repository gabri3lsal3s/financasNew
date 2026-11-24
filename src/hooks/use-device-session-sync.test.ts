import { createElement, StrictMode, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useDeviceSessionSync,
  resetDeviceSessionSyncForTests,
} from "./use-device-session-sync";
import * as devicesRepo from "@/data/repositories/devices";
import * as deviceInfoService from "@/services/native/device-info";
import * as toastService from "@/services/toast";
import type { User } from "@supabase/supabase-js";

const mockSignOut = vi.fn().mockResolvedValue(undefined);

const fakeUser: User = {
  id: "user-123",
  app_metadata: {},
  user_metadata: { name: "Gabriel" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
  email: "gabriel@exemplo.com",
};

let mockAuthState: {
  user: User | null;
  loading: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
} = {
  user: fakeUser,
  loading: false,
  mfaRequired: false,
  mfaVerified: false,
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuthState,
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

vi.mock("@/data/repositories/devices", () => ({
  registerDevice: vi.fn().mockResolvedValue({
    id: "rec-1",
    user_id: "user-123",
    device_id: "dev-1",
    device_name: "Chrome no Linux",
    browser: "Google Chrome",
    os: "Linux",
    ip_address: null,
    last_seen_at: "2026-11-24T12:00:00Z",
    created_at: "2026-11-24T12:00:00Z",
    is_revoked: false,
  }),
  checkDeviceRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/services/native/device-info", () => ({
  getOrCreateDeviceId: vi.fn(() => "dev-1"),
  getDeviceInfo: vi.fn(() => ({
    deviceId: "dev-1",
    deviceName: "Chrome no Linux",
    browser: "Google Chrome",
    os: "Linux",
  })),
  shouldSyncDeviceSession: vi.fn(() => true),
  markDeviceSessionSynced: vi.fn(),
  clearDeviceSessionSync: vi.fn(),
  rotateDeviceId: vi.fn(() => "dev-2"),
  consumePendingExplicitDeviceRegistration: vi.fn(() => false),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/observability", () => ({
  reportError: vi.fn(),
}));

type RealtimePayloadCallback = (payload: { new?: Record<string, unknown> }) => void;
type SubscribeCallback = (status: string) => void;

let realtimeUpdateCallback: RealtimePayloadCallback | null = null;
let realtimeSubscribeCallback: SubscribeCallback | null = null;
const mockChannelFn = vi.fn();
const mockRemoveChannelFn = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    channel: (name: string) => {
      mockChannelFn(name);
      const chain = {
        on: (_type: string, _filter: Record<string, unknown>, cb: RealtimePayloadCallback) => {
          realtimeUpdateCallback = cb;
          return chain;
        },
        subscribe: (cb?: SubscribeCallback) => {
          realtimeSubscribeCallback = cb ?? null;
          cb?.("SUBSCRIBED");
          return chain;
        },
      };
      return chain;
    },
    removeChannel: (...args: unknown[]) => mockRemoveChannelFn(...args),
  }),
}));

describe("useDeviceSessionSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDeviceSessionSyncForTests();
    realtimeUpdateCallback = null;
    realtimeSubscribeCallback = null;
    mockAuthState = {
      user: fakeUser,
      loading: false,
      mfaRequired: false,
      mfaVerified: false,
    };
    vi.mocked(deviceInfoService.consumePendingExplicitDeviceRegistration).mockReturnValue(false);
    vi.mocked(deviceInfoService.shouldSyncDeviceSession).mockReturnValue(true);
    vi.mocked(devicesRepo.checkDeviceRevoked).mockResolvedValue(false);
  });

  afterEach(() => {
    resetDeviceSessionSyncForTests();
  });

  it("gate de MFA: bloqueia checkDeviceRevoked e registerDevice em AAL1 e libera após AAL2", async () => {
    mockAuthState = {
      user: fakeUser,
      loading: false,
      mfaRequired: true,
      mfaVerified: false,
    };

    const { rerender } = renderHook(() => useDeviceSessionSync());

    expect(devicesRepo.checkDeviceRevoked).not.toHaveBeenCalled();
    expect(devicesRepo.registerDevice).not.toHaveBeenCalled();
    expect(mockChannelFn).not.toHaveBeenCalled();

    // Eleva para AAL2
    mockAuthState = {
      user: fakeUser,
      loading: false,
      mfaRequired: false,
      mfaVerified: true,
    };
    vi.mocked(deviceInfoService.consumePendingExplicitDeviceRegistration).mockReturnValueOnce(true);

    rerender();

    await waitFor(() => {
      expect(devicesRepo.registerDevice).toHaveBeenCalledTimes(1);
      expect(mockChannelFn).toHaveBeenCalledWith("user-devices-user-123");
    });
  });

  it("ordem de execução: login explícito chama registerDevice antes de checkDeviceRevoked", async () => {
    vi.mocked(deviceInfoService.consumePendingExplicitDeviceRegistration).mockReturnValueOnce(true);

    renderHook(() => useDeviceSessionSync());

    await waitFor(() => {
      expect(devicesRepo.registerDevice).toHaveBeenCalledTimes(1);
      expect(deviceInfoService.markDeviceSessionSynced).toHaveBeenCalledTimes(1);
    });
    expect(devicesRepo.checkDeviceRevoked).not.toHaveBeenCalled();
  });

  it("ordem de execução: boot/reload chama checkDeviceRevoked primeiro e registra se não revogado", async () => {
    vi.mocked(deviceInfoService.consumePendingExplicitDeviceRegistration).mockReturnValueOnce(false);

    renderHook(() => useDeviceSessionSync());

    await waitFor(() => {
      expect(devicesRepo.checkDeviceRevoked).toHaveBeenCalledWith("dev-1");
      expect(devicesRepo.registerDevice).toHaveBeenCalledTimes(1);
    });
  });

  it("revogação via Realtime + mutex: rotaciona deviceId, exibe 1 toast e chama signOut local uma única vez", async () => {
    renderHook(() => useDeviceSessionSync());

    await waitFor(() => {
      expect(realtimeUpdateCallback).not.toBeNull();
    });

    await act(async () => {
      realtimeUpdateCallback?.({ new: { device_id: "dev-1", is_revoked: true } });
      realtimeUpdateCallback?.({ new: { device_id: "dev-1", is_revoked: true } });
    });

    expect(deviceInfoService.rotateDeviceId).toHaveBeenCalledTimes(1);
    expect(deviceInfoService.clearDeviceSessionSync).toHaveBeenCalledTimes(1);
    expect(toastService.pushToast).toHaveBeenCalledTimes(1);
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Esta sessão foi encerrada remotamente por outro dispositivo.",
      }),
    );
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("reconexão: revalida checkDeviceRevoked em online e reconexão Realtime SUBSCRIBED", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(100_000);

    renderHook(() => useDeviceSessionSync());

    await waitFor(() => {
      expect(devicesRepo.checkDeviceRevoked).toHaveBeenCalledTimes(1);
    });

    // Avança além do throttle (10s) e dispara evento online
    nowSpy.mockReturnValue(120_000);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(devicesRepo.checkDeviceRevoked).toHaveBeenCalledTimes(2);
    });

    // Avança além do throttle e simula reconexão SUBSCRIBED
    nowSpy.mockReturnValue(140_000);
    await act(async () => {
      realtimeSubscribeCallback?.("SUBSCRIBED");
    });

    await waitFor(() => {
      expect(devicesRepo.checkDeviceRevoked).toHaveBeenCalledTimes(3);
    });

    nowSpy.mockRestore();
  });

  it("StrictMode: double-mount não dispara chamadas de sync duplicadas dentro do throttle", async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);

    renderHook(() => useDeviceSessionSync(), { wrapper });

    await waitFor(() => {
      expect(devicesRepo.checkDeviceRevoked).toHaveBeenCalledTimes(1);
      expect(devicesRepo.registerDevice).toHaveBeenCalledTimes(1);
    });
  });
});
