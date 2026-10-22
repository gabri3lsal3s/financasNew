import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserPreferences, userPreferencesKey } from "./use-user-preferences";
import * as userPrefsRepo from "@/data/repositories/user-preferences";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { setActiveUserId } from "@/services/user-storage";
import type { UserPreferences } from "@/types";

vi.mock("@/data/repositories/user-preferences", () => ({
  getUserPreferences: vi.fn(),
}));

const mockPreferences: UserPreferences = {
  user_id: "user-1",
  theme: "dark",
  reminders_enabled: true,
  reminder_days_before_bill: 3,
  reminder_days_before_debt: 2,
  report_weights_enabled: true,
  max_sector_acoes: 25,
  max_sector_fiis: 20,
};

describe("useUserPreferences Hook — Calibração de Cache (Tarefa 1.2)", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setActiveUserId("user-1");
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("carrega preferências com staleTime de 5 minutos e gcTime de 30 minutos", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValueOnce(mockPreferences);

    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPreferences);
    expect(userPrefsRepo.getUserPreferences).toHaveBeenCalledTimes(1);

    const query = queryClient.getQueryCache().find({ queryKey: userPreferencesKey });
    expect(query).toBeDefined();
    const observers = (query as unknown as { observers: Array<{ options: { staleTime?: number; gcTime?: number } }> }).observers;
    expect(observers[0]?.options.staleTime).toBe(STALE_TIMES.static);
    expect(observers[0]?.options.staleTime).toBe(300_000);
    expect(observers[0]?.options.gcTime).toBe(STATIC_GC_TIME);
  });
});
