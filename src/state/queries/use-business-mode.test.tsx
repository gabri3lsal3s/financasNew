import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as userPrefsRepo from "@/data/repositories/user-preferences";
import { setActiveUserId } from "@/services/user-storage";
import type { UserPreferences } from "@/types";
import { useBusinessMode } from "./use-business-mode";

vi.mock("@/data/repositories/user-preferences", () => ({
  getUserPreferences: vi.fn(),
  updateCustomSettings: vi.fn(),
}));

const mockHasFeature = vi.fn().mockReturnValue(true);

vi.mock("@/state/queries/use-user-access", () => ({
  useUserAccess: () => ({
    hasFeature: mockHasFeature,
    role: "user",
    status: "active",
    isLoading: false,
  }),
}));

const mockPreferencesBase: UserPreferences = {
  user_id: "user-1",
  theme: "dark",
  app_mode: "investor",
  reminders_enabled: true,
  reminder_days_before_bill: 3,
  reminder_days_before_debt: 2,
  report_weights_enabled: true,
  max_sector_acoes: 25,
  max_sector_fiis: 20,
};

describe("useBusinessMode Hook — Isolamento Opt-in Estrito", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasFeature.mockReturnValue(true);
    setActiveUserId("user-1");
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("inicia estritamente desligado (false) quando businessModeEnabled não está definido", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValueOnce({
      ...mockPreferencesBase,
      custom_settings: {},
    });

    const { result } = renderHook(() => useBusinessMode(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isBusinessModeEnabled).toBe(false);
  });

  it("retorna true quando ativado e persiste alteração ao chamar toggleBusinessMode", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValue({
      ...mockPreferencesBase,
      custom_settings: { businessModeEnabled: true },
    });
    vi.mocked(userPrefsRepo.updateCustomSettings).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useBusinessMode(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isBusinessModeEnabled).toBe(true);

    await act(async () => {
      await result.current.toggleBusinessMode(false);
    });

    expect(userPrefsRepo.updateCustomSettings).toHaveBeenCalledWith({
      businessModeEnabled: false,
    });
  });
});
