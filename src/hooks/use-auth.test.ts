import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "./use-auth";
import * as devicesRepo from "@/data/repositories/devices";
import type { Session, User } from "@supabase/supabase-js";

vi.mock("@/data/repositories/profiles", () => ({
  ensureOwnProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/data/repositories/categories", () => ({
  ensureDefaultCategories: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/data/repositories/devices", () => ({
  registerDevice: vi.fn(),
  checkDeviceRevoked: vi.fn(),
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

describe("useAuth - Leitura Reativa de Sessão", () => {
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

  it("carrega a sessão ativa de forma puramente reativa sem disparar chamadas de dispositivo", async () => {
    mockSessionData = { session: fakeSession };

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("user-123");
    expect(result.current.session?.access_token).toBe("fake-access-token");

    // O registro e checagem de revogação agora vivem exclusivamente no singleton useDeviceSessionSync
    expect(devicesRepo.checkDeviceRevoked).not.toHaveBeenCalled();
    expect(devicesRepo.registerDevice).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
