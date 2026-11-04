import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioExecutiveReport } from "./portfolio-executive-report";
import type { PositionRow } from "@/components/modules/position-table";

let mockMonthlyPositionLoading = false;
let mockMonthlyPositionData: unknown = null;

vi.mock("@/state", () => ({
  usePortfolioMonthlyPosition: () => ({
    data: mockMonthlyPositionData,
    isLoading: mockMonthlyPositionLoading,
    refetch: vi.fn(),
  }),
  usePortfolioSnapshots: () => ({
    data: [
      { id: "s1", month: "2026-08", total_value: 100000, total_cost: 90000 },
      { id: "s2", month: "2026-07", total_value: 95000, total_cost: 88000 },
    ],
  }),
  useDeletePortfolioSnapshot: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("./monthly-closing-editor", () => ({
  MonthlyClosingEditor: () => <div data-testid="closing-editor" />,
}));

describe("PortfolioExecutiveReport — Ausência de Flash e Estado de Carregamento", () => {
  const defaultRows: PositionRow[] = [
    {
      assetId: "a1",
      ticker: "PETR4",
      assetClass: "acoes",
      quantity: 100,
      averageCost: 30,
      priceBRL: 38,
      valueBRL: 3800,
      currency: "BRL",
      source: "manual",
      pricingMode: "unit_price",
      pct: 100,
      unrealizedPnl: 800,
      unrealizedPct: 26.6,
      isCash: false,
    },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    rows: defaultRows,
    totalBRL: 80000,
    cashBRL: 10000,
    yearDividendsBRL: 1200,
    portfolioIrr: undefined,
    portfolioTwr: undefined,
    totalReturnPct: 15,
    totalReturnPnlBRL: 10000,
    allTimeEconomicPnlBRL: 10000,
  };

  it("exibe skeleton e NÃO renderiza a síntese executiva do mês atual enquanto a competência histórica estiver carregando", () => {
    mockMonthlyPositionLoading = true;
    mockMonthlyPositionData = null;

    render(
      <PortfolioExecutiveReport
        {...defaultProps}
        initialMonth="2026-07"
      />,
    );

    // Deve exibir o esqueleto de carregamento com data-testid
    const skeletons = screen.getAllByTestId("report-loading-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);

    // NÃO deve renderizar o cabeçalho oficial de relatório enquanto carrega
    expect(
      screen.queryByText("Relatório Executivo de Acompanhamento da Carteira"),
    ).not.toBeInTheDocument();
  });

  it("renderiza mensagem de indisponibilidade quando os dados carregados indicam saldo consolidado sem custódia (fidelity)", () => {
    mockMonthlyPositionLoading = false;
    mockMonthlyPositionData = {
      month: "2026-07",
      totalValueBRL: 95000,
      totalCostBRL: 88000,
      cashQuantity: 0,
      positions: [],
      fidelity: {
        canGenerateExecutiveReport: false,
        reasons: ["Esta competência possui apenas registro consolidado de saldo patrimonial (TWA)."],
        snapshotTotalValue: 95000,
      },
    };

    render(
      <PortfolioExecutiveReport
        {...defaultProps}
        initialMonth="2026-07"
      />,
    );

    const errorTitles = screen.getAllByText("Relatório Analítico Não Disponível para esta Competência");
    expect(errorTitles.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Esta competência possui apenas registro consolidado de saldo patrimonial/)[0],
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Conferir & Calibrar Fechamento/i })[0]).toBeInTheDocument();
  });
});
