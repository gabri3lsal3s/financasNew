import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RealCashHeroCard } from "./real-cash-hero-card";
import type { UseRealCashBalanceResult } from "@/state";

vi.mock("@/state", () => ({
  useCreateCashCheckpoint: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("RealCashHeroCard", () => {
  const mockRealCashData: UseRealCashBalanceResult = {
    cashBalance: {
      currentBalanceCents: 542000,
      latestCheckpoint: {
        id: "chk-1",
        date: "2026-08-20",
        balanceCents: 500000,
        notes: null,
      },
      checkpointBalanceCents: 500000,
      inflowSinceCheckpointCents: 82000,
      outflowSinceCheckpointCents: 40000,
      eventsSinceCheckpoint: [],
    },
    safeToSpend: {
      realCashBalanceCents: 542000,
      openInvoicesCents: 120000,
      payablePendingCents: 30000,
      receivablePendingCents: 0,
      essentialBudgetsRemainingCents: 0,
      committedObligationsCents: 150000,
      safeToSpendCents: 392000,
      safeToSpendWithBudgetsCents: 392000,
      safeToSpendWithReceivablesCents: 392000,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };

  it("renderiza o saldo bancário real, badge de aferição e métrica Safe-to-Spend", () => {
    render(<RealCashHeroCard realCashData={mockRealCashData} />);

    expect(screen.getByText("Saldo Disponível em Conta")).toBeInTheDocument();
    expect(screen.getByText(/5\.420,00/)).toBeInTheDocument();
    expect(screen.getByText("Aferido em 20/08/2026")).toBeInTheDocument();
    expect(screen.getByText("Faturas e contas a pagar do ciclo:")).toBeInTheDocument();
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText("Saldo Livre Real:")).toBeInTheDocument();
    expect(screen.getByText(/3\.920,00/)).toBeInTheDocument();
  });

  it("abre o diálogo de calibração ao clicar em 'Calibrar com o banco'", () => {
    render(<RealCashHeroCard realCashData={mockRealCashData} />);

    const button = screen.getByRole("button", { name: /Calibrar com o banco/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByText("Calibrar Saldo com o Banco")).toBeInTheDocument();
  });

  it("renderiza badge 'Acumulado do Fluxo' quando não há checkpoint anterior", () => {
    const noCheckpointData: UseRealCashBalanceResult = {
      ...mockRealCashData,
      cashBalance: {
        ...mockRealCashData.cashBalance,
        latestCheckpoint: null,
      },
    };

    render(<RealCashHeroCard realCashData={noCheckpointData} />);
    expect(screen.getByText("Acumulado do Fluxo")).toBeInTheDocument();
  });
});
