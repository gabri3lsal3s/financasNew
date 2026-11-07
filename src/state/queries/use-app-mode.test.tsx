import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppMode } from "./use-app-mode";
import * as userPrefsRepo from "@/data/repositories/user-preferences";
import { setActiveUserId } from "@/services/user-storage";
import type { UserPreferences } from "@/types";

vi.mock("@/data/repositories/user-preferences", () => ({
  getUserPreferences: vi.fn(),
  updateAppMode: vi.fn(),
}));

const mockBasePreferences: UserPreferences = {
  user_id: "user-1",
  theme: "system",
  reminders_enabled: true,
  reminder_days_before_bill: 3,
  reminder_days_before_debt: 2,
  report_weights_enabled: false,
  max_sector_acoes: 25,
  max_sector_fiis: 20,
  app_mode: "investor",
};

describe("useAppMode Hook — Governança de Perfis de Visualização (§Plano 07)", () => {
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

  it("assume 'investor' como padrão seguro quando preferências não possuem app_mode ou são nulas", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAppMode(), {
      wrapper: createWrapper(),
    });

    expect(result.current.appMode).toBe("investor");
    expect(result.current.isInvestorMode).toBe(true);
    expect(result.current.isEssentialMode).toBe(false);
  });

  it("reflete 'essential' quando retornado das preferências", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValueOnce({
      ...mockBasePreferences,
      app_mode: "essential",
    });

    const { result } = renderHook(() => useAppMode(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.appMode).toBe("essential");
    });

    expect(result.current.isInvestorMode).toBe(false);
    expect(result.current.isEssentialMode).toBe(true);
  });

  it("permite alternar modo com atualização otimista imediata e persistência", async () => {
    vi.mocked(userPrefsRepo.getUserPreferences).mockResolvedValueOnce({
      ...mockBasePreferences,
      app_mode: "investor",
    });
    vi.mocked(userPrefsRepo.updateAppMode).mockResolvedValueOnce();

    const { result } = renderHook(() => useAppMode(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.appMode).toBe("investor");
    });

    await act(async () => {
      await result.current.setAppMode("essential");
    });

    expect(userPrefsRepo.updateAppMode).toHaveBeenCalledWith("essential");
    expect(result.current.appMode).toBe("essential");
    expect(result.current.isEssentialMode).toBe(true);
  });
});
