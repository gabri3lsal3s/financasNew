import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignOut } from "./use-sign-out";
import { resetAppState } from "@/services/auth-cleanup";

vi.mock("@/services/auth-cleanup", () => ({
  resetAppState: vi.fn(),
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

  it("chama resetAppState e supabase.auth.signOut ao executar signOut", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(resetAppState).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
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
