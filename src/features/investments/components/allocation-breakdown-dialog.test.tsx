import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AllocationBreakdownDialog } from "./allocation-breakdown-dialog";
import type { PortfolioPositionRow } from "@/state";

const mockRows: PortfolioPositionRow[] = [
  {
    assetId: "a-1",
    ticker: "PETR4",
    assetClass: "Ações",
    sector: "Petróleo e Gás",
    currency: "BRL",
    quantity: 100,
    averageCost: 30,
    totalCost: 3000,
    totalCostBRL: 3000,
    averageCostBRL: 30,
    dividends: 200,
    priceQuote: 38,
    priceBRL: 38,
    usdRate: 1,
    source: "api",
    valueBRL: 3800,
    pct: 38,
    unrealizedPnl: 800,
    unrealizedPct: 26.67,
    totalReturnPnl: 1000,
    totalReturnPct: 33.33,
    isCash: false,
    pricingMode: "unit_price",
  },
  {
    assetId: "a-2",
    ticker: "VALE3",
    assetClass: "Ações",
    sector: "Mineração",
    currency: "BRL",
    quantity: 50,
    averageCost: 60,
    totalCost: 3000,
    totalCostBRL: 3000,
    averageCostBRL: 60,
    dividends: 100,
    priceQuote: 62,
    priceBRL: 62,
    usdRate: 1,
    source: "api",
    valueBRL: 3100,
    pct: 31,
    unrealizedPnl: 100,
    unrealizedPct: 3.33,
    totalReturnPnl: 200,
    totalReturnPct: 6.67,
    isCash: false,
    pricingMode: "unit_price",
  },
  {
    assetId: "a-3",
    ticker: "VEA",
    assetClass: "Internacional",
    sector: "Desenvolvidos",
    currency: "USD",
    quantity: 20,
    averageCost: 50,
    totalCost: 1000,
    totalCostBRL: 5500,
    averageCostBRL: 275,
    dividends: 30,
    priceQuote: 55,
    priceBRL: 302.5,
    usdRate: 5.5,
    source: "api",
    valueBRL: 6050,
    pct: 31,
    unrealizedPnl: 550,
    unrealizedPct: 10,
    totalReturnPnl: 715,
    totalReturnPct: 13,
    isCash: false,
    pricingMode: "unit_price",
  },
];

describe("AllocationBreakdownDialog", () => {
  it("renderiza o raio-x de uma classe com seus ativos filtrados e KPIs consolidados", () => {
    render(
      <AllocationBreakdownDialog
        open={true}
        onOpenChange={vi.fn()}
        type="class"
        groupName="Ações"
        rows={mockRows}
        totalPortfolioBRL={12950}
        targetPercent={50}
      />,
    );

    // Título e badge
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("Classe")).toBeInTheDocument();
    expect(screen.getByText(/2 ativo\(s\) em custódia/i)).toBeInTheDocument();

    // Ativos da classe Ações estão presentes
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("VALE3")).toBeInTheDocument();

    // Ativo de outra classe não deve aparecer
    expect(screen.queryByText("VEA")).not.toBeInTheDocument();

    // KPIs da classe
    expect(screen.getByText("Meta de Alocação")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
  });

  it("renderiza o raio-x de um setor com os ativos daquele setor", () => {
    render(
      <AllocationBreakdownDialog
        open={true}
        onOpenChange={vi.fn()}
        type="sector"
        groupName="Mineração"
        rows={mockRows}
        totalPortfolioBRL={12950}
      />,
    );

    expect(screen.getByRole("heading", { name: "Mineração" })).toBeInTheDocument();
    expect(screen.getByText("Setor")).toBeInTheDocument();
    expect(screen.getByText("VALE3")).toBeInTheDocument();
    expect(screen.queryByText("PETR4")).not.toBeInTheDocument();
  });

  it("chama onSelectAsset quando um ativo é clicado", async () => {
    const user = userEvent.setup();
    const onSelectAsset = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <AllocationBreakdownDialog
        open={true}
        onOpenChange={onOpenChange}
        type="class"
        groupName="Ações"
        rows={mockRows}
        totalPortfolioBRL={12950}
        onSelectAsset={onSelectAsset}
      />,
    );

    await user.click(screen.getByText("PETR4"));

    expect(onSelectAsset).toHaveBeenCalledWith("a-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
