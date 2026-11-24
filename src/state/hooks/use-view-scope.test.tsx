import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActiveUserId } from "@/services/user-storage";
import { resetViewScopeStoreForTest, useViewScope } from "./use-view-scope";

const mockIsBusinessEnabled = vi.fn().mockReturnValue(true);

vi.mock("@/state/queries/use-business-mode", () => ({
  useBusinessMode: () => ({
    isBusinessModeEnabled: mockIsBusinessEnabled(),
    toggleBusinessMode: vi.fn(),
    isLoading: false,
    isPending: false,
  }),
}));

describe("useViewScope (Persistência de Sessão Client-Side)", () => {
  function createWrapper() {
    const queryClient = new QueryClient();
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    setActiveUserId("u-scope");
    mockIsBusinessEnabled.mockReturnValue(true);
    resetViewScopeStoreForTest();
  });

  it("inicia em 'all' e alterna para 'business'/'personal' em 0ms", () => {
    const { result } = renderHook(() => useViewScope(), { wrapper: createWrapper() });
    expect(result.current.effectiveViewScope).toBe("all");

    act(() => {
      result.current.setViewScope("business");
    });
    expect(result.current.viewScope).toBe("business");
    expect(result.current.effectiveViewScope).toBe("business");

    // Se o Modo Negócio for desligado, effectiveViewScope trava imediatamente em 'all'
    mockIsBusinessEnabled.mockReturnValue(false);
    const { result: disabledResult } = renderHook(() => useViewScope(), {
      wrapper: createWrapper(),
    });
    expect(disabledResult.current.viewScope).toBe("business");
    expect(disabledResult.current.effectiveViewScope).toBe("all");
  });
});
