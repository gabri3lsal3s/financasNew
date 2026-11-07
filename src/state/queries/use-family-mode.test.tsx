import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFamilyMode } from "./use-family-mode";
import * as userPrefsRepo from "@/data/repositories/user-preferences";
import { setActiveUserId } from "@/services/user-storage";
import type { UserPreferences } from "@/types";

vi.mock("@/data/repositories/user-preferences", () => ({
  getUserPreferences: vi.fn(),
  updateCustomSettings: vi.fn(),
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

describe("useFamilyMode Hook — Governança do Modo Familiar", () => {
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
        mutations: { retry: false },
      },
    });
  });

  it("retorna isFamilyModeEnabled como false por padrão quando indefinido", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValueOnce({
      ...mockPreferencesBase,
      custom_settings: {},
    });

    const { result } = renderHook(() => useFamilyMode(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isFamilyModeEnabled).toBe(false);
  });

  it("retorna isFamilyModeEnabled como true quando configurado na nuvem", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValueOnce({
      ...mockPreferencesBase,
      custom_settings: {
        familyModeEnabled: true,
      },
    });

    const { result } = renderHook(() => useFamilyMode(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isFamilyModeEnabled).toBe(true);
  });

  it("permite ativar e desativar o modo familiar via toggleFamilyMode", async () => {
    let currentPrefs: UserPreferences = {
      ...mockPreferencesBase,
      custom_settings: {
        familyModeEnabled: false,
      },
    };
    vi.mocked(userPrefsRepo.getUserPreferences).mockImplementation(async () => currentPrefs);
    vi.mocked(userPrefsRepo.updateCustomSettings).mockImplementation(async (patch) => {
      currentPrefs = {
        ...currentPrefs,
        custom_settings: {
          ...(currentPrefs.custom_settings ?? {}),
          ...patch,
        },
      };
    });

    const { result } = renderHook(() => useFamilyMode(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isFamilyModeEnabled).toBe(false);

    await act(async () => {
      await result.current.toggleFamilyMode(true);
    });

    expect(userPrefsRepo.updateCustomSettings).toHaveBeenCalledWith({
      familyModeEnabled: true,
    });
    await waitFor(() => {
      expect(result.current.isFamilyModeEnabled).toBe(true);
    });
  });
});
