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

vi.mock("@/state/queries/use-user-subscription", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
}));

vi.mock("@/state/queries/use-permission", () => ({
  usePermission: () => "write",
}));

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  usePermission: () => "write",
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
    const content = document.body.textContent?.replace(/\u00a0/g, " ");
    expect(content).toContain("5.420,00");
    expect(screen.getByText("Aferido em 20/08/2026")).toBeInTheDocument();
    expect(screen.getByText(/Vence este mês:/)).toBeInTheDocument();
    expect(content).toContain("1.500,00");
    expect(screen.getByText("Sobra do Ciclo")).toBeInTheDocument();
    expect(content).toContain("3.920,00");
    expect(screen.getByText("Próximas Faturas")).toBeInTheDocument();
    expect(screen.getByText("Gasto Diário Seguro")).toBeInTheDocument();
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

  it("renderiza os gatilhos de memória de cálculo do Saldo Disponível e Saldo Livre Real (Regra 33)", () => {
    render(<RealCashHeroCard realCashData={mockRealCashData} />);
    expect(
      screen.getByRole("button", {
        name: "Ver memória de cálculo de Saldo Disponível em Conta",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ver memória de cálculo de Sobra do Ciclo (Safe-to-Spend)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ver memória de cálculo de Gasto Diário Seguro",
      }),
    ).toBeInTheDocument();
  });

  it("renderiza a decomposição Pessoal vs Meu Negócio quando houver atividade empresarial (Melhoria 2)", () => {
    const withBusinessData: UseRealCashBalanceResult = {
      ...mockRealCashData,
      businessCashBreakdown: {
        personalCashCents: 442000,
        businessCashCents: 100000,
        hasBusinessCash: true,
      },
    };

    render(<RealCashHeroCard realCashData={withBusinessData} />);
    expect(screen.getByText("Pessoal:")).toBeInTheDocument();
    expect(screen.getByText("Meu Negócio:")).toBeInTheDocument();
    expect(screen.getByText(/4\.420,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
  });

  it("exibe Próximas Faturas e Gasto Diário Seguro com memória de cálculo quando há faturas futuras e renda média", () => {
    const withUpcomingCardsData: UseRealCashBalanceResult = {
      cashBalance: {
        ...mockRealCashData.cashBalance,
        currentBalanceCents: 29359, // R$ 293,59
      },
      safeToSpend: {
        realCashBalanceCents: 29359,
        openInvoicesCents: 0,
        payablePendingCents: 0,
        receivablePendingCents: 6532,
        essentialBudgetsRemainingCents: 0,
        committedObligationsCents: 0,
        safeToSpendCents: 29359,
        safeToSpendWithBudgetsCents: 29359,
        safeToSpendWithReceivablesCents: 35891,
        nextCycleInvoicesCents: 165082,
        futureInvoicesCents: 273282,
        totalUpcomingCardInvoicesCents: 438364,
        safeToSpendAfterNextInvoicesCents: -135723,
        freeToSpendCents: 0,
      },
      safeDailySpending: {
        hasIncomeBase: true,
        incomeSource: "year_average",
        incomeMonthsCount: 10,
        horizonDays: 38,
        safeToSpendCents: 29359,
        averageMonthlyIncomeCents: 350000,
        nextCycleInvoicesCents: 165082,
        futureInvoicesCents: 273282,
        nextMonthPayableDebtsCents: 0,
        savingsMarginRate: 0.1,
        savingsMarginCents: 35000,
        netBeforeMarginCents: 214277,
        netAfterMarginCents: 179277,
        safeDailyCents: 4717,
        breakEvenDailyCents: 5638,
      },
      cycleBreakdown: {
        invoices: [],
        openInvoicesCents: 0,
        nextCycleInvoices: [
          {
            cardId: "c1",
            cardName: "Rico",
            cardColor: "#000000",
            competenceMonth: "2026-12",
            dueDate: "2026-12-10",
            saldoCents: 74938,
          },
          {
            cardId: "c2",
            cardName: "Nubank",
            cardColor: "#8A05BE",
            competenceMonth: "2026-12",
            dueDate: "2026-12-15",
            saldoCents: 90144,
          },
        ],
        nextCycleInvoicesCents: 165082,
        futureInvoices: [
          {
            cardId: "c1",
            cardName: "Rico",
            cardColor: "#000000",
            competenceMonth: "2027-01",
            dueDate: "2027-01-10",
            saldoCents: 273282,
          },
        ],
        futureInvoicesCents: 273282,
        totalUpcomingCardInvoicesCents: 438364,
        payableDebts: [],
        payableDebtsCents: 0,
        committedObligationsCents: 0,
        receivableDebts: [],
        receivablePendingCents: 6532,
        futureDebts: { count: 0, totalCents: 0 },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };

    render(<RealCashHeroCard realCashData={withUpcomingCardsData} />);

    expect(screen.getByText("Próximas Faturas")).toBeInTheDocument();
    expect(screen.getByText("Gasto Diário Seguro")).toBeInTheDocument();
    expect(screen.getByText("Base: renda média (10 meses)")).toBeInTheDocument();
    const content = document.body.textContent?.replace(/\u00a0/g, " ");
    expect(content).toContain("1.650,82");
    expect(content).toContain("2.732,82");
    expect(content).toContain("47,17/dia");
    expect(
      screen.getByRole("button", {
        name: "Ver memória de cálculo de Gasto Diário Seguro",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver próximas faturas de cartão em acumulação e faturas futuras",
      }),
    );
    expect(screen.getByText("Próximas Faturas em Acumulação")).toBeInTheDocument();
    expect(screen.getByText(/Faturas futuras de cartão:/)).toBeInTheDocument();
  });
});
