import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InvestmentsTab } from "./investments-tab";

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({
    rows: [],
    totalBRL: 50000,
    totalCostBRL: 40000,
  }),
  usePortfolioAssets: () => ({
    data: [],
  }),
  useGroupTargets: () => ({
    data: [],
  }),
}));

vi.mock("@/components/modules/reports", () => ({
  ReportAllocationDonuts: () => <div data-testid="allocation-donuts" />,
}));

vi.mock("@/features/investments/components", () => ({
  AllocationBreakdownDialog: () => null,
  AssetDetailSheet: () => null,
}));

describe("InvestmentsTab — Sincronização Temporal e Empty State", () => {
  const defaultProps = {
    totalPatrimonyBRL: 50000,
    allocationAnalysis: {
      totalBRL: 50000,
      alignmentScore: 85,
      treeNodes: [],
      classGaps: [],
      sectorGaps: [],
      assetGaps: [],
      topDeficitClass: null,
      topDeficitSector: null,
      topDeficitAsset: null,
    },
    concentrationRisk: {
      totalBRL: 50000,
      top5BRL: 17750,
      top5Pct: 35.5,
      top10BRL: 25000,
      top10Pct: 50,
      singleAssetDominance: null,
      sectorExposure: [],
      topSectorDominance: { sector: "Tecnologia", valueBRL: 10000, pct: 20 },
      top3SectorsPct: 40,
      currencyExposure: { brlBRL: 45000, brlPct: 90, usdBRL: 5000, usdPct: 10 },
      riskScore: 80,
      riskAlerts: [],
    },
    expandedTreeClasses: new Set<string>(),
    setExpandedTreeClasses: vi.fn(),
    expandedTreeSectors: new Set<string>(),
    setExpandedTreeSectors: vi.fn(),
    onOpenTearSheet: vi.fn(),
  };

  it("renderiza empty state informativo quando hasDataForPeriod é false e permite retornar ao mês atual", async () => {
    const handleReset = vi.fn();
    const user = userEvent.setup();

    render(
      <InvestmentsTab
        {...defaultProps}
        hasDataForPeriod={false}
        periodLabel="Maio de 2024"
        onResetToCurrentMonth={handleReset}
      />,
    );

    expect(screen.getByText("Nenhum dado patrimonial para Maio de 2024")).toBeInTheDocument();
    expect(
      screen.getByText(/Não foram encontrados snapshots, movimentações ou proventos registrados/),
    ).toBeInTheDocument();

    const resetButton = screen.getByRole("button", { name: /Ver mês atual/i });
    expect(resetButton).toBeInTheDocument();

    await user.click(resetButton);
    expect(handleReset).toHaveBeenCalledTimes(1);

    // Não deve renderizar botões da tela cheia ou tabela de gap
    expect(screen.queryByText(/Dossiê Executivo de Alocação/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Patrimônio Consolidado/i)).not.toBeInTheDocument();
  });

  it("renderiza normalmente a tela quando hasDataForPeriod é true", () => {
    render(
      <InvestmentsTab
        {...defaultProps}
        hasDataForPeriod={true}
        periodLabel="Março de 2026"
      />,
    );

    expect(screen.getByText(/Dossiê Executivo de Alocação & Patrimônio/i)).toBeInTheDocument();
    expect(screen.getByText("Patrimônio Consolidado")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("35.5%")).toBeInTheDocument();
  });
});
