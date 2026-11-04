import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { InvestmentsTab } from "./investments-tab";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

  it("renderiza empty state informativo com botão para Investimentos quando hasDataForPeriod é false", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InvestmentsTab
          {...defaultProps}
          hasDataForPeriod={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Nenhum ativo ou custódia cadastrada")).toBeInTheDocument();
    expect(
      screen.getByText(/Você ainda não possui ativos ou saldo de caixa cadastrados na sua carteira/),
    ).toBeInTheDocument();

    const actionButton = screen.getByRole("button", { name: /Ir para Investimentos/i });
    expect(actionButton).toBeInTheDocument();

    await user.click(actionButton);
    expect(mockNavigate).toHaveBeenCalledWith("/investimentos");

    // Não deve renderizar o card de dossiê ou métricas
    expect(screen.queryByText(/Dossiê Executivo de Alocação/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Patrimônio Consolidado/i)).not.toBeInTheDocument();
  });

  it("renderiza normalmente a tela quando hasDataForPeriod é true com card de atalho para histórico", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InvestmentsTab
          {...defaultProps}
          hasDataForPeriod={true}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Análise e Auditoria de Meses Anteriores")).toBeInTheDocument();
    expect(
      screen.getByText(/Deseja auditar ou emitir relatórios de fechamento de meses anteriores\? Acesse os Fechamentos & Snapshots/),
    ).toBeInTheDocument();

    const historyButton = screen.getByRole("button", { name: /Ir para Fechamentos/i });
    expect(historyButton).toBeInTheDocument();
    await user.click(historyButton);
    expect(mockNavigate).toHaveBeenCalledWith("/investimentos");

    expect(screen.getByText(/Dossiê Executivo de Alocação & Patrimônio/i)).toBeInTheDocument();
    expect(screen.getByText("Patrimônio Consolidado")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("35.5%")).toBeInTheDocument();
  });
});
