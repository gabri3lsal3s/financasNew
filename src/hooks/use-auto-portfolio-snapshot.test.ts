import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoPortfolioSnapshot } from "./use-auto-portfolio-snapshot";
import * as stateModule from "@/state";

describe("useAutoPortfolioSnapshot (§F50)", () => {
  it("dispara upsertPortfolioSnapshot quando há patrimônio e o mês atual não possui snapshot", () => {
    const mutateMock = vi.fn();

    vi.spyOn(stateModule, "usePortfolioPosition").mockReturnValue({
      rows: [],
      totalBRL: 45000,
      totalCostBRL: 40000,
      cashBRL: 5000,
      totalDividendsBRL: 0,
      totalReturnPnlBRL: 5000,
      totalReturnPct: 12.5,
      unrealizedPnlBRL: 5000,
      unrealizedPct: 12.5,
      allTimeEconomicPnlBRL: 5000,
      realizedPnlBRL: 0,
      netInjectedCapitalBRL: 40000,
      netPocketGainBRL: 5000,
      portfolioIrr: {
        annualizedRatePct: 12.5,
        periodRatePct: 12.5,
        daysElapsed: 100,
        isEligible: true,
        status: "ok",
      },
      hasMarcoZeroContribution: false,
      monthlySeries: [],
      monthlyContributionCents: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioPosition>);

    vi.spyOn(stateModule, "usePortfolioSnapshots").mockReturnValue({
      data: [{ id: "s1", user_id: "u1", month: "2026-07", total_value: 40000, total_cost: 38000 }],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioSnapshots>);

    vi.spyOn(stateModule, "useUpsertPortfolioSnapshot").mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpsertPortfolioSnapshot>);

    renderHook(() => useAutoPortfolioSnapshot());

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total_value: 45000,
        total_cost: 40000,
      }),
    );
  });

  it("NÃO dispara upsert quando o snapshot do mês atual já existe", () => {
    const mutateMock = vi.fn();
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    vi.spyOn(stateModule, "usePortfolioPosition").mockReturnValue({
      rows: [],
      totalBRL: 45000,
      totalCostBRL: 40000,
      cashBRL: 5000,
      totalDividendsBRL: 0,
      totalReturnPnlBRL: 5000,
      totalReturnPct: 12.5,
      unrealizedPnlBRL: 5000,
      unrealizedPct: 12.5,
      allTimeEconomicPnlBRL: 5000,
      realizedPnlBRL: 0,
      netInjectedCapitalBRL: 40000,
      netPocketGainBRL: 5000,
      portfolioIrr: {
        annualizedRatePct: 12.5,
        periodRatePct: 12.5,
        daysElapsed: 100,
        isEligible: true,
        status: "ok",
      },
      hasMarcoZeroContribution: false,
      monthlySeries: [],
      monthlyContributionCents: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioPosition>);

    vi.spyOn(stateModule, "usePortfolioSnapshots").mockReturnValue({
      data: [{ id: "s1", user_id: "u1", month: currentMonthStr, total_value: 45000, total_cost: 40000 }],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioSnapshots>);

    vi.spyOn(stateModule, "useUpsertPortfolioSnapshot").mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpsertPortfolioSnapshot>);

    renderHook(() => useAutoPortfolioSnapshot());

    expect(mutateMock).not.toHaveBeenCalled();
  });
});
