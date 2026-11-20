import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { OverviewKpiGrid } from "./overview-kpi-grid";
import type { OverviewTotals } from "@/domain/overview";

describe("OverviewKpiGrid — Memória de Cálculo e Explicabilidade (Regra 33)", () => {
  const mockTotals: OverviewTotals = {
    incomeCents: 500000,
    expenseCents: 300000,
    investmentCents: 50000,
    operatingBalanceCents: 200000,
    cashFlowBalanceCents: 150000,
    balanceCents: 200000,
    savingsRatePercent: 40,
  };

  const mockPrevTotals: OverviewTotals = {
    incomeCents: 450000,
    expenseCents: 280000,
    investmentCents: 40000,
    operatingBalanceCents: 170000,
    cashFlowBalanceCents: 130000,
    balanceCents: 170000,
    savingsRatePercent: 37.7,
  };

  const mockDailySeries = {
    incomeSeries: [0, 500000],
    expenseSeries: [100000, 300000],
    investmentSeries: [0, 50000],
    balanceSeries: [-100000, 200000],
    days: ["01", "02"],
    cumulativeSeries: [],
    expensesByDay: [],
    incomesByDay: [],
    investmentsByDay: [],
  };

  it("renderiza os gatilhos (?) de memória de cálculo em todos os 4 cards principais", () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <OverviewKpiGrid
          month="2026-08"
          totals={mockTotals}
          prevTotals={mockPrevTotals}
          incomeCents={500000}
          expenseCents={300000}
          grossIncomeCents={500000}
          grossExpenseCents={300000}
          dailySeries={mockDailySeries}
          onNavigate={onNavigate}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Ver memória de cálculo de Receitas do Mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver memória de cálculo de Despesas do Mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver memória de cálculo de Investimentos do Mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ver memória de cálculo de Resultado do Mês (Saldo Operacional)",
      }),
    ).toBeInTheDocument();
  });

  it("ao clicar no gatilho (?) não dispara a navegação do card principal (stopPropagation)", () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <OverviewKpiGrid
          month="2026-08"
          totals={mockTotals}
          prevTotals={mockPrevTotals}
          incomeCents={500000}
          expenseCents={300000}
          grossIncomeCents={500000}
          grossExpenseCents={300000}
          dailySeries={mockDailySeries}
          onNavigate={onNavigate}
        />
      </MemoryRouter>,
    );

    const memoryTrigger = screen.getByRole("button", {
      name: "Ver memória de cálculo de Receitas do Mês",
    });

    fireEvent.click(memoryTrigger);

    // O onNavigate do card NÃO deve ter sido chamado
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("ao abrir e fechar a memória de cálculo via botão Fechar não dispara a navegação (redirecionamento)", async () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <OverviewKpiGrid
          month="2026-08"
          totals={mockTotals}
          prevTotals={mockPrevTotals}
          incomeCents={500000}
          expenseCents={300000}
          grossIncomeCents={500000}
          grossExpenseCents={300000}
          dailySeries={mockDailySeries}
          onNavigate={onNavigate}
        />
      </MemoryRouter>,
    );

    const memoryTrigger = screen.getByRole("button", {
      name: "Ver memória de cálculo de Receitas do Mês",
    });

    fireEvent.click(memoryTrigger);
    expect(onNavigate).not.toHaveBeenCalled();

    const closeBtn = await screen.findByRole("button", { name: "Fechar" });
    fireEvent.click(closeBtn);

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
