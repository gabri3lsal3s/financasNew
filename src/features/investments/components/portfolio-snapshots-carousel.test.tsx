import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioSnapshotsCarousel } from "./portfolio-snapshots-carousel";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";

const mockSeries: PortfolioMonthlySeriesPoint[] = [
  {
    month: "2026-07",
    valueBRL: 102000,
    costBRL: 95000,
    monthDividendsBRL: 500,
    accumulatedDividendsBRL: 6500,
    capitalGainPnl: 7000,
    capitalGainPct: 7.37,
    totalReturnPnl: 13500,
    totalReturnPct: 14.21,
    twrMonthPct: 0.93,
    twrAccumulatedPct: 23.0,
    sharePrice: 123.01,
  },
  {
    month: "2026-08",
    valueBRL: 105000,
    costBRL: 96000,
    monthDividendsBRL: 600,
    accumulatedDividendsBRL: 7100,
    capitalGainPnl: 9000,
    capitalGainPct: 9.38,
    totalReturnPnl: 16100,
    totalReturnPct: 16.77,
    twrMonthPct: 1.25,
    twrAccumulatedPct: 24.5,
    sharePrice: 124.55,
  },
  {
    month: "2026-09",
    valueBRL: 108000,
    costBRL: 98000,
    monthDividendsBRL: 400,
    accumulatedDividendsBRL: 7500,
    capitalGainPnl: 10000,
    capitalGainPct: 10.2,
    totalReturnPnl: 17500,
    totalReturnPct: 17.86,
    twrMonthPct: 2.1,
    twrAccumulatedPct: 27.1,
    sharePrice: 127.11,
  },
];

describe("PortfolioSnapshotsCarousel", () => {
  it("não renderiza nada se a série estiver vazia", () => {
    const { container } = render(<PortfolioSnapshotsCarousel series={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza os cards de meses ordenados do mais recente ao mais antigo com botões de rolagem no desktop", () => {
    const onOpen = vi.fn();
    render(
      <PortfolioSnapshotsCarousel
        series={mockSeries}
        currentMonthStr="2026-09"
        totalMonthsCount={32}
        onOpenAnalyticsDialog={onOpen}
      />,
    );

    expect(screen.getByText("Evolução Histórica")).toBeInTheDocument();
    expect(screen.getByText("(3 meses)")).toBeInTheDocument();

    // Meses formatados em ordem decrescente (Set/2026 primeiro)
    const monthElements = screen.getAllByText(/(Set|Ago|Jul)\/2026/);
    expect(monthElements[0]).toHaveTextContent("Set/2026");
    expect(monthElements[1]).toHaveTextContent("Ago/2026");
    expect(monthElements[2]).toHaveTextContent("Jul/2026");

    // Badge atual
    expect(screen.getByText("atual")).toBeInTheDocument();

    // Valores
    expect(screen.getByText(/108\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("+2.1% m/m")).toBeInTheDocument();

    // Botões de rolagem por setas no desktop
    expect(screen.getByRole("button", { name: /Rolar carrossel para a esquerda/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rolar carrossel para a direita/i })).toBeInTheDocument();

    // Botão de cabeçalho
    const headerBtn = screen.getByRole("button", { name: /Ver extrato analítico completo/i });
    expect(headerBtn).toBeInTheDocument();
    fireEvent.click(headerBtn);
    expect(onOpen).toHaveBeenCalledTimes(1);

    // Card final CTA
    const ctaBtn = screen.getByRole("button", { name: /Abrir tabela analítica completa de snapshots/i });
    expect(ctaBtn).toBeInTheDocument();
    fireEvent.click(ctaBtn);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
