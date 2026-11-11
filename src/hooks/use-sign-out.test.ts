import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignOut } from "./use-sign-out";
import { resetAppState } from "@/services/auth-cleanup";
import { clearDeviceSessionSync } from "@/services/native/device-info";

vi.mock("@/services/auth-cleanup", () => ({
  resetAppState: vi.fn(),
}));

vi.mock("@/services/native/device-info", () => ({
  clearDeviceSessionSync: vi.fn(),
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

  it("chama resetAppState e supabase.auth.signOut com scope local por padrão para suportar multi-sessão", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(clearDeviceSessionSync).toHaveBeenCalledTimes(1);
    expect(resetAppState).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("permite especificar escopo customizado (ex: others)", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut({ scope: "others" });
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
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
