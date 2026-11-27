import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolioAlertDismissals } from "./use-portfolio-alert-dismissals";

const mockMutate = vi.fn();
let mockCloudDismissals: Record<string, { dismissedUntil: number; fingerprint?: string }> | undefined;

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: () => "user-1",
  getUserStorageKey: (base: string, uid?: string | null) => `${base}:${uid ?? "anon"}`,
  subscribeActiveUserId: () => () => {},
}));

vi.mock("@/state/queries/use-user-preferences", () => ({
  useUserPreferences: () => ({
    data: {
      custom_settings: {
        portfolioAlertDismissals: mockCloudDismissals,
      },
    },
    isLoading: false,
  }),
}));

vi.mock("@/state/mutations/use-preference-mutations", () => ({
  useUpdateCustomSettings: () => ({
    mutate: mockMutate,
  }),
}));

describe("usePortfolioAlertDismissals", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockMutate.mockClear();
    mockCloudDismissals = undefined;
  });

  it("dispensa alerta pelo período de 7 dias e garante permanência silenciada mesmo com oscilações", () => {
    const { result } = renderHook(() => usePortfolioAlertDismissals());

    expect(result.current.isAlertDismissed("allocation-drift", "fp-1")).toBe(false);

    act(() => {
      result.current.dismissAlert("allocation-drift", 7, "fp-1");
    });

    expect(result.current.isAlertDismissed("allocation-drift", "fp-1")).toBe(true);
    // Permanece dispensado durante os 7 dias mesmo se o fingerprint oscilar
    expect(result.current.isAlertDismissed("allocation-drift", "fp-2")).toBe(true);
    // Sincroniza com o Supabase
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioAlertDismissals: expect.objectContaining({
          "allocation-drift": expect.objectContaining({
            fingerprint: "fp-1",
          }),
        }),
      }),
    );
  });

  it("carrega dispensas ativas vindas da nuvem (multi-dispositivo)", () => {
    const now = 1_700_000_000_000;
    mockCloudDismissals = {
      "idle-cash": {
        dismissedUntil: now + 7 * 24 * 60 * 60 * 1000,
        fingerprint: "idle",
      },
    };

    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    const { result } = renderHook(() => usePortfolioAlertDismissals());

    expect(result.current.isAlertDismissed("idle-cash")).toBe(true);
    dateSpy.mockRestore();
  });

  it("expira automaticamente após o prazo do snooze de 7 dias", () => {
    const now = 1_700_000_000_000;
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    const { result } = renderHook(() => usePortfolioAlertDismissals());

    act(() => {
      result.current.dismissAlert("upcoming-reviews", 7, "WEGE3");
    });
    expect(result.current.isAlertDismissed("upcoming-reviews", "WEGE3")).toBe(true);

    // Avança 8 dias (expirou os 7 dias)
    dateSpy.mockReturnValue(now + 8 * 24 * 60 * 60 * 1000);
    expect(result.current.isAlertDismissed("upcoming-reviews", "WEGE3")).toBe(false);

    dateSpy.mockRestore();
  });

  it("permite dispensar por 30 dias (lembrar no próximo mês)", () => {
    const now = 1_700_000_000_000;
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    const { result } = renderHook(() => usePortfolioAlertDismissals());

    act(() => {
      result.current.dismissAlert("allocation-drift", 30, "Ações");
    });

    // 20 dias depois: continua silenciado
    dateSpy.mockReturnValue(now + 20 * 24 * 60 * 60 * 1000);
    expect(result.current.isAlertDismissed("allocation-drift")).toBe(true);

    // 31 dias depois: expirou
    dateSpy.mockReturnValue(now + 31 * 24 * 60 * 60 * 1000);
    expect(result.current.isAlertDismissed("allocation-drift")).toBe(false);

    dateSpy.mockRestore();
  });
});
