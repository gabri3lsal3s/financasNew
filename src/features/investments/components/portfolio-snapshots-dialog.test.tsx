import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioSnapshotsDialog } from "./portfolio-snapshots-dialog";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";

const mockSeries: PortfolioMonthlySeriesPoint[] = [
  {
    month: "2025-12",
    valueBRL: 80000,
    costBRL: 75000,
    monthDividendsBRL: 300,
    accumulatedDividendsBRL: 3000,
    capitalGainPnl: 5000,
    capitalGainPct: 6.67,
    totalReturnPnl: 8000,
    totalReturnPct: 10.67,
    twrMonthPct: 0.5,
    twrAccumulatedPct: 15.0,
    sharePrice: 115.0,
  },
  {
    month: "2026-08",
    valueBRL: 100000,
    costBRL: 90000,
    monthDividendsBRL: 450,
    accumulatedDividendsBRL: 6000,
    capitalGainPnl: 10000,
    capitalGainPct: 11.11,
    totalReturnPnl: 16000,
    totalReturnPct: 17.78,
    twrMonthPct: 1.2,
    twrAccumulatedPct: 22.0,
    sharePrice: 122.0,
  },
  {
    month: "2026-09",
    valueBRL: 108000,
    costBRL: 95000,
    monthDividendsBRL: 500,
    accumulatedDividendsBRL: 6500,
    capitalGainPnl: 13000,
    capitalGainPct: 13.68,
    totalReturnPnl: 19500,
    totalReturnPct: 20.53,
    twrMonthPct: 2.5,
    twrAccumulatedPct: 25.0,
    sharePrice: 125.0,
  },
];

describe("PortfolioSnapshotsDialog", () => {
  it("renderiza a tabela analítica completa com os pontos ordenados decrescentemente", () => {
    const onOpenChange = vi.fn();
    render(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeries}
        currentMonthStr="2026-09"
      />,
    );

    expect(
      screen.getByText("Extrato Analítico de Evolução Patrimonial"),
    ).toBeInTheDocument();

    // KPIs de resumo
    expect(screen.getByText("3 meses")).toBeInTheDocument();
    expect(screen.getAllByText(/108\.000,00/).length).toBeGreaterThan(0);

    // Colunas da tabela
    expect(screen.getByText("Competência")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio")).toBeInTheDocument();
    expect(screen.getByText("Mês (TWR %)")).toBeInTheDocument();
    expect(screen.getByText("TWR Acum.")).toBeInTheDocument();

    // Linhas de dados formatadas
    expect(screen.getByText("Set/2026")).toBeInTheDocument();
    expect(screen.getByText("Ago/2026")).toBeInTheDocument();
    expect(screen.getByText("Dez/2025")).toBeInTheDocument();

    // Badge atual no mês 2026-09
    expect(screen.getByText("atual")).toBeInTheDocument();
  });

  it("permite filtrar por ano", () => {
    const onOpenChange = vi.fn();
    render(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeries}
        currentMonthStr="2026-09"
      />,
    );

    // Botões de filtro por ano
    const btn2025 = screen.getByRole("button", { name: "2025" });
    expect(btn2025).toBeInTheDocument();

    fireEvent.click(btn2025);

    // Agora deve exibir apenas 1 mês (Dez/2025)
    expect(screen.getByText("1 mês")).toBeInTheDocument();
    expect(screen.getByText("Dez/2025")).toBeInTheDocument();
    expect(screen.queryByText("Set/2026")).not.toBeInTheDocument();
    expect(screen.queryByText("Ago/2026")).not.toBeInTheDocument();
  });
});
