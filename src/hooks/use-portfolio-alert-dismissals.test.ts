import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolioAlertDismissals } from "./use-portfolio-alert-dismissals";

vi.mock("./use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

describe("usePortfolioAlertDismissals", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("dispensa alerta pelo período configurado e respeita o fingerprint", () => {
    const { result } = renderHook(() => usePortfolioAlertDismissals());

    expect(result.current.isAlertDismissed("allocation-drift", "fp-1")).toBe(false);

    act(() => {
      result.current.dismissAlert("allocation-drift", 7, "fp-1");
    });

    expect(result.current.isAlertDismissed("allocation-drift", "fp-1")).toBe(true);
    // Quando o estado muda (novo fingerprint), o alerta volta automaticamente
    expect(result.current.isAlertDismissed("allocation-drift", "fp-2")).toBe(false);
  });

  it("expira automaticamente após o prazo do snooze", () => {
    const now = 1_700_000_000_000;
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    const { result } = renderHook(() => usePortfolioAlertDismissals());

    act(() => {
      result.current.dismissAlert("upcoming-reviews", 7, "WEGE3");
    });
    expect(result.current.isAlertDismissed("upcoming-reviews", "WEGE3")).toBe(true);

    // Avança 8 dias
    dateSpy.mockReturnValue(now + 8 * 24 * 60 * 60 * 1000);
    expect(result.current.isAlertDismissed("upcoming-reviews", "WEGE3")).toBe(false);

    dateSpy.mockRestore();
  });
});
