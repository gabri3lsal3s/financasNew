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

    vi.spyOn(stateModule, "usePortfolioAssets").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioAssets>);

    vi.spyOn(stateModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.useAllPortfolioTransactions>);

    vi.spyOn(stateModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioDividends>);

    renderHook(() => useAutoPortfolioSnapshot());

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total_value: 45000,
        total_cost: 45000,
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

    vi.spyOn(stateModule, "usePortfolioAssets").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioAssets>);

    vi.spyOn(stateModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.useAllPortfolioTransactions>);

    vi.spyOn(stateModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioDividends>);

    renderHook(() => useAutoPortfolioSnapshot());

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("recalibra snapshot do mês atual quando status for provisional e houver divergência relevante", () => {
    const mutateMock = vi.fn();
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    vi.spyOn(stateModule, "usePortfolioPosition").mockReturnValue({
      rows: [],
      totalBRL: 55000,
      totalCostBRL: 45000,
      cashBRL: 5000,
      totalDividendsBRL: 0,
      totalReturnPnlBRL: 5000,
      totalReturnPct: 10,
      unrealizedPnlBRL: 5000,
      unrealizedPct: 10,
      allTimeEconomicPnlBRL: 5000,
      realizedPnlBRL: 0,
      netInjectedCapitalBRL: 45000,
      netPocketGainBRL: 5000,
      portfolioIrr: {
        annualizedRatePct: 10,
        periodRatePct: 10,
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

    // Snapshot existente gravado no início do mês com valor defasado
    vi.spyOn(stateModule, "usePortfolioSnapshots").mockReturnValue({
      data: [
        {
          id: "s1",
          user_id: "u1",
          month: currentMonthStr,
          total_value: 40000,
          total_cost: 35000,
          status: "provisional",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioSnapshots>);

    vi.spyOn(stateModule, "useUpsertPortfolioSnapshot").mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpsertPortfolioSnapshot>);

    vi.spyOn(stateModule, "usePortfolioAssets").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioAssets>);

    vi.spyOn(stateModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.useAllPortfolioTransactions>);

    vi.spyOn(stateModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioDividends>);

    renderHook(() => useAutoPortfolioSnapshot());

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({
      month: currentMonthStr,
      total_value: 55000,
      total_cost: 50000,
      status: "provisional",
    });
  });

  it("NÃO recalibra snapshot do mês atual quando status for closed (fechamento oficial)", () => {
    const mutateMock = vi.fn();
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    vi.spyOn(stateModule, "usePortfolioPosition").mockReturnValue({
      rows: [],
      totalBRL: 55000,
      totalCostBRL: 45000,
      cashBRL: 5000,
      totalDividendsBRL: 0,
      totalReturnPnlBRL: 5000,
      totalReturnPct: 10,
      unrealizedPnlBRL: 5000,
      unrealizedPct: 10,
      allTimeEconomicPnlBRL: 5000,
      realizedPnlBRL: 0,
      netInjectedCapitalBRL: 45000,
      netPocketGainBRL: 5000,
      portfolioIrr: {
        annualizedRatePct: 10,
        periodRatePct: 10,
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

    // Snapshot existente já formalmente fechado
    vi.spyOn(stateModule, "usePortfolioSnapshots").mockReturnValue({
      data: [
        {
          id: "s1",
          user_id: "u1",
          month: currentMonthStr,
          total_value: 40000,
          total_cost: 35000,
          status: "closed",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioSnapshots>);

    vi.spyOn(stateModule, "useUpsertPortfolioSnapshot").mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpsertPortfolioSnapshot>);

    vi.spyOn(stateModule, "usePortfolioAssets").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioAssets>);

    vi.spyOn(stateModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.useAllPortfolioTransactions>);

    vi.spyOn(stateModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioDividends>);

    renderHook(() => useAutoPortfolioSnapshot());

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("NÃO materializa nem altera meses retroativos automaticamente (preserva imutabilidade pós-fechamento)", () => {
    const mutateMock = vi.fn();
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    // Mês atual já possui snapshot
    vi.spyOn(stateModule, "usePortfolioPosition").mockReturnValue({
      rows: [],
      totalBRL: 50000,
      totalCostBRL: 42000,
      cashBRL: 3000,
      totalDividendsBRL: 0,
      totalReturnPnlBRL: 5000,
      totalReturnPct: 12.5,
      unrealizedPnlBRL: 5000,
      unrealizedPct: 12.5,
      allTimeEconomicPnlBRL: 5000,
      realizedPnlBRL: 0,
      netInjectedCapitalBRL: 42000,
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
      data: [{ id: "s1", user_id: "u1", month: currentMonthStr, total_value: 50000, total_cost: 45000 }],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioSnapshots>);

    vi.spyOn(stateModule, "useUpsertPortfolioSnapshot").mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpsertPortfolioSnapshot>);

    // Ativo de ações + ativo de caixa
    vi.spyOn(stateModule, "usePortfolioAssets").mockReturnValue({
      data: [
        {
          id: "ast-petr4",
          user_id: "u1",
          ticker: "PETR4",
          asset_class: "Ações",
          currency: "BRL",
          quantity: 100,
          average_price: 30,
        },
        {
          id: "ast-cash",
          user_id: "u1",
          ticker: "CASH",
          asset_class: "Caixa",
          currency: "BRL",
          quantity: 2000,
          average_price: 1,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioAssets>);

    // Transação em mês retroativo ("2026-03")
    vi.spyOn(stateModule, "useAllPortfolioTransactions").mockReturnValue({
      data: [
        {
          id: "tx-1",
          user_id: "u1",
          asset_id: "ast-petr4",
          type: "buy",
          date: "2026-03-10",
          quantity: 100,
          price: 30,
          total: 3000,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.useAllPortfolioTransactions>);

    vi.spyOn(stateModule, "usePortfolioDividends").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioDividends>);

    renderHook(() => useAutoPortfolioSnapshot());

    // Nenhuma mutação automática pode ser disparada para meses retroativos
    expect(mutateMock).not.toHaveBeenCalled();
  });

  describe("Quality Gate 2 (QG2) — Integridade de Persistência e Desacoplamento Concorrente", () => {
    it("múltiplas telas chamando usePortfolioPosition simultaneamente NÃO gravam snapshots nem disparam mutações", () => {
      const mutateMock = vi.fn();
      vi.spyOn(stateModule, "useUpsertPortfolioSnapshot").mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as unknown as ReturnType<typeof stateModule.useUpsertPortfolioSnapshot>);

      // Simula montagem de 5 telas/abas simultâneas chamando usePortfolioPosition
      renderHook(() => stateModule.usePortfolioPosition());
      renderHook(() => stateModule.usePortfolioPosition());
      renderHook(() => stateModule.usePortfolioPosition());
      renderHook(() => stateModule.usePortfolioPosition());
      renderHook(() => stateModule.usePortfolioPosition());

      // usePortfolioPosition agora é estritamente uma query pura sem efeitos colaterais de escrita
      expect(mutateMock).not.toHaveBeenCalled();
    });

    it("apenas useAutoPortfolioSnapshot centraliza a gravação e previne regravações concorrentes", () => {
      const mutateMock = vi.fn();

      vi.spyOn(stateModule, "usePortfolioPosition").mockReturnValue({
        rows: [],
        totalBRL: 80000,
        totalCostBRL: 70000,
        cashBRL: 10000,
        totalDividendsBRL: 0,
        totalReturnPnlBRL: 0,
        totalReturnPct: 0,
        unrealizedPnlBRL: 0,
        unrealizedPct: 0,
        allTimeEconomicPnlBRL: 0,
        realizedPnlBRL: 0,
        netInjectedCapitalBRL: 70000,
        netPocketGainBRL: 0,
        portfolioIrr: {
          annualizedRatePct: 0,
          periodRatePct: 0,
          daysElapsed: 0,
          isEligible: false,
          status: "insufficient_data",
        },
        hasMarcoZeroContribution: false,
        monthlySeries: [],
        monthlyContributionCents: 0,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof stateModule.usePortfolioPosition>);

      vi.spyOn(stateModule, "usePortfolioSnapshots").mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof stateModule.usePortfolioSnapshots>);

      vi.spyOn(stateModule, "useUpsertPortfolioSnapshot").mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as unknown as ReturnType<typeof stateModule.useUpsertPortfolioSnapshot>);

      vi.spyOn(stateModule, "usePortfolioAssets").mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof stateModule.usePortfolioAssets>);

      vi.spyOn(stateModule, "useAllPortfolioTransactions").mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof stateModule.useAllPortfolioTransactions>);

      vi.spyOn(stateModule, "usePortfolioDividends").mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof stateModule.usePortfolioDividends>);

      const { rerender } = renderHook(() => useAutoPortfolioSnapshot());

      // 1ª renderização dispara materialização única
      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          total_value: 80000,
          total_cost: 80000, // 70.000 + 10.000 (caixa 1:1)
        }),
      );

      // Re-renderizações consecutivas não disparam mutações adicionais (deduplicação via ref)
      rerender();
      rerender();
      rerender();

      expect(mutateMock).toHaveBeenCalledTimes(1);
    });
  });
});
