import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HouseholdWealthCard } from "./household-wealth-card";
import type { FamilyPortfolioSummary } from "@/types";

describe("HouseholdWealthCard", () => {
  const mockSummaryWithReserve: FamilyPortfolioSummary = {
    family_id: "fam-1",
    total_invested_cents: 408863, // R$ 4.088,63
    total_cash_cents: 257057, // R$ 2.570,57
    dividends_12m_cents: 0,
    assets_count: 4,
    assets: [],
  };

  it("calcula autonomia pelo teto estipulado e exibe barra de progresso da meta de 6 meses", () => {
    const handleManage = vi.fn();

    render(
      <HouseholdWealthCard
        portfolioSummary={mockSummaryWithReserve}
        monthlyCeilingCents={500000} // Teto: R$ 5.000,00
        monthlyExpensesCents={35000} // Gastos parciais no mês não devem distorcer a autonomia
        onOpenManageAssets={handleManage}
      />,
    );

    // Deve exibir o badge de 0.5 meses de reserva (2570 / 5000 = 0.5)
    expect(screen.getByText("0.5 meses de reserva")).toBeInTheDocument();

    // Deve identificar a reserva e o patrimônio total com descritivos claros de liquidez e composição
    expect(screen.getByText("Reserva da Casa")).toBeInTheDocument();
    expect(screen.getByText("Liquidez imediata (Caixa, Selic e CDI)")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio Total Compartilhado")).toBeInTheDocument();
    expect(screen.getByText("Reserva +")).toBeInTheDocument();
    expect(screen.getByText("em outros ativos")).toBeInTheDocument();

    // Deve explicitar que os valores refletem saldo atualizado a mercado
    expect(
      screen.getByText(/Os valores refletem o saldo atualizado a mercado/i),
    ).toBeInTheDocument();

    // Deve renderizar a régua da meta de 6 meses de segurança (6 * 5000 = R$ 30.000)
    expect(screen.getByText("Meta de Segurança (6 meses do teto)")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Quando proventos forem 0, não deve renderizar card estéril de Proventos 12m
    expect(screen.queryByText("Proventos 12m")).not.toBeInTheDocument();
    expect(screen.getByText(/Sem proventos 12m/)).toBeInTheDocument();
  });

  it("exibe proventos 12m quando houver dividendos registrados", () => {
    const summaryWithDividends: FamilyPortfolioSummary = {
      ...mockSummaryWithReserve,
      dividends_12m_cents: 125000, // R$ 1.250,00
    };

    render(
      <HouseholdWealthCard
        portfolioSummary={summaryWithDividends}
        monthlyCeilingCents={500000}
        onOpenManageAssets={vi.fn()}
      />,
    );

    expect(screen.getByText("Proventos 12m")).toBeInTheDocument();
    expect(screen.getByText("Renda passiva conjunta")).toBeInTheDocument();
  });

  it("exibe aviso orientando definir teto quando monthlyCeilingCents for zero", () => {
    render(
      <HouseholdWealthCard
        portfolioSummary={mockSummaryWithReserve}
        monthlyCeilingCents={0}
        monthlyExpensesCents={500000}
        onOpenManageAssets={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Defina o teto mensal de gastos da família nas configurações/),
    ).toBeInTheDocument();
  });

  it("aciona callback ao clicar no botão Gerenciar", async () => {
    const handleManage = vi.fn();
    const user = userEvent.setup();

    render(
      <HouseholdWealthCard
        portfolioSummary={mockSummaryWithReserve}
        monthlyCeilingCents={500000}
        onOpenManageAssets={handleManage}
      />,
    );

    const manageBtn = screen.getByRole("button", { name: /Gerenciar/i });
    await user.click(manageBtn);

    expect(handleManage).toHaveBeenCalledTimes(1);
  });
});
