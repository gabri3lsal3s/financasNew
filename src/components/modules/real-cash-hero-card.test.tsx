import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RealCashHeroCard } from "./real-cash-hero-card";
import type { UseRealCashBalanceResult } from "@/state";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
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
    cycleBreakdown: {
      invoices: [
        {
          cardId: "c1",
          cardName: "Nubank",
          cardColor: "#8A05BE",
          competenceMonth: "2026-08",
          dueDate: "2026-08-25",
          saldoCents: 120000,
        },
      ],
      openInvoicesCents: 120000,
      payableDebts: [
        {
          id: "d1",
          name: "Boleto de Energia",
          dueDate: "2026-08-28",
          amountCents: 30000,
          isOverdue: false,
          type: "payable",
        },
      ],
      payableDebtsCents: 30000,
      committedObligationsCents: 150000,
      receivableDebts: [],
      receivablePendingCents: 0,
      futureDebts: { count: 1, totalCents: 50000 },
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
    expect(screen.getByText("Faturas e contas a pagar do ciclo (bruto):")).toBeInTheDocument();
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText("Saldo Livre Real:")).toBeInTheDocument();
    expect(screen.getByText(/3\.920,00/)).toBeInTheDocument();
  });

  it("abre o diálogo de detalhamento das obrigações do ciclo ao clicar no botão de obrigações", () => {
    render(<RealCashHeroCard realCashData={mockRealCashData} />);

    const obligationsBtn = screen.getByRole("button", {
      name: "Ver detalhamento das faturas e contas a pagar do ciclo",
    });
    fireEvent.click(obligationsBtn);

    expect(screen.getByText("Obrigações do Ciclo Atual")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText("Boleto de Energia")).toBeInTheDocument();
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

  it("não exibe 'A receber previsto' quando não houver recebíveis no ciclo", () => {
    render(<RealCashHeroCard realCashData={mockRealCashData} />);
    expect(screen.queryByText("A receber previsto:")).not.toBeInTheDocument();
  });

  it("exibe 'A receber previsto' quando houver recebíveis pendentes no ciclo", () => {
    const withReceivablesData: UseRealCashBalanceResult = {
      ...mockRealCashData,
      safeToSpend: {
        ...mockRealCashData.safeToSpend,
        receivablePendingCents: 85000,
      },
    };

    render(<RealCashHeroCard realCashData={withReceivablesData} />);
    expect(screen.getByText("A receber previsto:")).toBeInTheDocument();
    expect(screen.getByText(/850,00/)).toBeInTheDocument();
  });
});
