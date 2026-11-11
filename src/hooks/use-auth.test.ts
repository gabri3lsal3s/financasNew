import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "./use-auth";
import * as devicesRepo from "@/data/repositories/devices";
import * as deviceInfoService from "@/services/native/device-info";
import type { Session, User } from "@supabase/supabase-js";

vi.mock("@/data/repositories/profiles", () => ({
  ensureOwnProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/data/repositories/categories", () => ({
  ensureDefaultCategories: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/data/repositories/devices", () => ({
  registerDevice: vi.fn().mockResolvedValue({
    id: "device-1",
    user_id: "user-123",
    device_id: "dev-device-1",
    device_name: "Chrome no Windows",
    browser: "Google Chrome",
    os: "Windows",
    ip_address: null,
    last_seen_at: "2026-11-11T10:00:00Z",
    created_at: "2026-11-11T10:00:00Z",
    is_revoked: false,
  }),
  checkDeviceRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/services/native/device-info", () => ({
  getOrCreateDeviceId: vi.fn(() => "dev-device-1"),
  getDeviceInfo: vi.fn(() => ({
    deviceId: "dev-device-1",
    deviceName: "Chrome no Windows",
    browser: "Google Chrome",
    os: "Windows",
  })),
  shouldSyncDeviceSession: vi.fn(() => true),
  markDeviceSessionSynced: vi.fn(),
  clearDeviceSessionSync: vi.fn(),
}));

const mockSignOut = vi.fn().mockResolvedValue({ error: null });
let mockSessionData: { session: Session | null } = { session: null };

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockImplementation(() => Promise.resolve({ data: mockSessionData, error: null })),
      onAuthStateChange: vi.fn().mockImplementation(() => {
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
      signOut: mockSignOut,
    },
  }),
}));

describe("useAuth - Suporte a Multi-Sessão", () => {
  const fakeUser: User = {
    id: "user-123",
    app_metadata: {},
    user_metadata: { name: "Gabriel" },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    email: "gabriel@exemplo.com",
  };

  const fakeSession: Session = {
    access_token: "fake-access-token",
    refresh_token: "fake-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: fakeUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = { session: null };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registra o dispositivo atual ao inicializar sessão mantendo multi-sessão", async () => {
    mockSessionData = { session: fakeSession };

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("user-123");

    await waitFor(() => {
      expect(devicesRepo.checkDeviceRevoked).toHaveBeenCalledWith("dev-device-1");
      expect(devicesRepo.registerDevice).toHaveBeenCalledWith({
        deviceId: "dev-device-1",
        deviceName: "Chrome no Windows",
        browser: "Google Chrome",
        os: "Windows",
      });
      expect(deviceInfoService.markDeviceSessionSynced).toHaveBeenCalled();
    });
  });

  it("quando o dispositivo atual estiver marcado como revogado, realiza signOut com scope local", async () => {
    mockSessionData = { session: fakeSession };
    vi.mocked(devicesRepo.checkDeviceRevoked).mockResolvedValueOnce(true);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
      expect(deviceInfoService.clearDeviceSessionSync).toHaveBeenCalled();
    });
  });

  it("permite que dois dispositivos distintos registrem sessões concorrentes sem invalidar um ao outro", async () => {
    // Aparelho 1
    mockSessionData = { session: fakeSession };
    vi.mocked(deviceInfoService.getOrCreateDeviceId).mockReturnValueOnce("aparelho-1-uuid");
    vi.mocked(deviceInfoService.getDeviceInfo).mockReturnValueOnce({
      deviceId: "aparelho-1-uuid",
      deviceName: "Chrome no Windows",
      browser: "Google Chrome",
      os: "Windows",
    });

    const { unmount } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(devicesRepo.registerDevice).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: "aparelho-1-uuid" }),
      );
    });

    unmount();

    // Aparelho 2 conectando na mesma conta
    vi.mocked(deviceInfoService.getOrCreateDeviceId).mockReturnValueOnce("aparelho-2-uuid");
    vi.mocked(deviceInfoService.getDeviceInfo).mockReturnValueOnce({
      deviceId: "aparelho-2-uuid",
      deviceName: "Safari no iOS (Mobile)",
      browser: "Safari",
      os: "iOS",
    });

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(devicesRepo.registerDevice).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: "aparelho-2-uuid" }),
      );
      // Nenhuma chamada a signOut global foi executada, ambos aparelhos coexistem
      expect(mockSignOut).not.toHaveBeenCalledWith({ scope: "global" });
    });
  });
});
