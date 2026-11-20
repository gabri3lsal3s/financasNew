import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { PortfolioKpiStrip } from "./portfolio-kpi-strip";
import type { PortfolioPerformanceSummary } from "@/domain/portfolio/resumo-metrics";

const mockPerformance: PortfolioPerformanceSummary = {
  totalReturnPnlBRL: 15000,
  totalReturnCents: 1500000,
  totalReturnPct: 15.0,
  unrealizedPnlBRL: 10000,
  capitalGainPct: 10.0,
  allTimePnlBRL: 25000,
  allTimePnlCents: 2500000,
  realizedPnlBRL: 5000,
  realizedPnlCents: 500000,
  cashPct: 10.0,
  irrTone: "positive",
  irrLabel: "+14,5% a.a.",
  irrHint: "Ponderada no tempo (400d)",
  isTwrActive: true,
  isCustodyActive: false,
  twrTone: "positive",
  twrLabel: "+18,4%",
  rentabilidadeValue: "+18,4%",
  rentabilidadeTone: "positive",
  rentabilidadeMode: "twr",
  twrHintText: "+14,2% a.a. (15m)",
};

describe("PortfolioKpiStrip", () => {
  it("renderiza os 4 KPIs de investimentos com botões de memória de cálculo (?)", async () => {
    const user = userEvent.setup();
    const onOpenExplainModal = vi.fn();

    render(
      <MemoryRouter>
        <PortfolioKpiStrip
          isLoading={false}
          totalBRL={100000}
          totalDividendsBRL={10000}
          performance={mockPerformance}
          onOpenExplainModal={onOpenExplainModal}
          portfolioTwr={{
            status: "ok",
            accumulatedRatePct: 18.4,
            annualizedRatePct: 14.2,
            monthsElapsed: 15,
            currentSharePrice: 118.4,
            series: [],
          }}
          portfolioIrr={{
            status: "ok",
            isEligible: true,
            annualizedRatePct: 14.5,
            periodRatePct: 16.0,
            daysElapsed: 400,
          }}
          totalCostBRL={85000}
        />
      </MemoryRouter>,
    );

    // Os 4 botões de interrogação devem estar acessíveis
    const memoryButtons = screen.getAllByRole("button", { name: /Ver memória de cálculo/i });
    expect(memoryButtons).toHaveLength(4);

    // 1. Abre modal de Patrimônio Total
    await user.click(memoryButtons[0]!);
    expect(onOpenExplainModal).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Patrimônio Total da Carteira" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onOpenExplainModal).not.toHaveBeenCalled();

    // 2. Abre modal de Rentabilidade TWR
    await user.click(memoryButtons[1]!);
    expect(onOpenExplainModal).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Rentabilidade Ponderada pelo Tempo (TWR · Cotas)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onOpenExplainModal).not.toHaveBeenCalled();

    // 3. Abre modal de Resultado Histórico
    await user.click(memoryButtons[2]!);
    expect(onOpenExplainModal).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Resultado Histórico Total (P&L da Vida em R$)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onOpenExplainModal).not.toHaveBeenCalled();

    // 4. Abre modal de TIR
    await user.click(memoryButtons[3]!);
    expect(onOpenExplainModal).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Retorno do Bolso (TIR / XIRR · Fluxo Pessoal)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onOpenExplainModal).not.toHaveBeenCalled();
  });

  it("aciona onOpenExplainModal ao clicar no corpo do card", async () => {
    const user = userEvent.setup();
    const onOpenExplainModal = vi.fn();

    render(
      <MemoryRouter>
        <PortfolioKpiStrip
          isLoading={false}
          totalBRL={100000}
          performance={mockPerformance}
          onOpenExplainModal={onOpenExplainModal}
        />
      </MemoryRouter>,
    );

    // Clica no card de Patrimônio Total pelo aria-label do container
    const patrimonioCard = screen.getByRole("button", { name: /^Patrimônio Total$/i });
    await user.click(patrimonioCard);
    expect(onOpenExplainModal).toHaveBeenCalled();
  });
});
