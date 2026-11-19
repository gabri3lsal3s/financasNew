import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioInsightsCarousel } from "./portfolio-insights-carousel";

const mockUseCorporateDividends = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseAssetGovernanceInsights = vi.fn();
const mockUsePortfolioPosition = vi.fn();
const mockUseGroupTargets = vi.fn();
const mockUpdateAssetMutateAsync = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuth: () => ({ user: { id: "user-1" } }),
    useCorporateDividends: () => mockUseCorporateDividends(),
    useApproveDividendsBatch: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
    useDismissCorporateDividend: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useAssetGovernanceInsights: () => mockUseAssetGovernanceInsights(),
    usePortfolioPosition: () => mockUsePortfolioPosition(),
    useGroupTargets: () => mockUseGroupTargets(),
    useUpdatePortfolioAsset: () => ({
      mutateAsync: mockUpdateAssetMutateAsync,
      isPending: false,
    }),
  };
});

describe("PortfolioInsightsCarousel (Regra 19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 0,
      upcomingReviewsCount: 0,
      unscoredAssetsCount: 0,
      quarantinedCount: 0,
      discountOpportunitiesCount: 0,
      lowScoreRiskCount: 0,
      overdueAssets: [],
      upcomingReviewAssets: [],
      unscoredAssets: [],
      isLoading: false,
    });
    mockUsePortfolioPosition.mockReturnValue({
      rows: [],
      totalBRL: 0,
      cashBRL: 0,
      isLoading: false,
    });
    mockUseGroupTargets.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("não renderiza nada se não houver proventos nem governança ativa", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });

    const { container } = render(<PortfolioInsightsCarousel />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza o slide de proventos disponíveis com botão de aprovação rápida no Caixa", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [
        {
          corporateDividendId: "c1",
          assetId: "a1",
          ticker: "PETR4",
          type: "DIVIDENDO",
          comDate: "2026-10-30",
          paymentDate: "2026-11-05",
          quantityOnComDate: 100,
          rate: 1.0,
          netRate: 1.0,
          totalAmount: 100,
          currency: "BRL",
          status: "available",
        },
      ],
      projected: [],
      totalAvailableAmount: 100,
      totalProjectedAmount: 0,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Proventos Creditados na Corretora")).toBeInTheDocument();
    expect(screen.getByText("Aprovar no Caixa")).toBeInTheDocument();
    expect(screen.getByText("Ver detalhes")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Aprovar no Caixa"));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      dividends: [
        {
          asset_id: "a1",
          ticker: "PETR4",
          date: "2026-11-05",
          amount: 100,
          notes: "Provento automático (DIVIDENDO) apurado na B3",
          corporate_dividend_id: "c1",
        },
      ],
      sync_cash: true,
    });
  });

  it("renderiza o slide de proventos previstos", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [
        {
          corporateDividendId: "c2",
          assetId: "a2",
          ticker: "VALE3",
          type: "JCP",
          comDate: "2026-11-10",
          paymentDate: "2026-11-25",
          quantityOnComDate: 50,
          rate: 2.0,
          netRate: 1.7,
          totalAmount: 85,
          currency: "BRL",
          status: "projected",
        },
      ],
      totalAvailableAmount: 0,
      totalProjectedAmount: 85,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Proventos Previstos no Mês")).toBeInTheDocument();
    expect(screen.getByText("Ver projeção")).toBeInTheDocument();
  });

  it("renderiza o slide de revisão de teses pendente com navegação para metas", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 2,
      quarantinedCount: 0,
      discountOpportunitiesCount: 0,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Revisão de Teses Pendente")).toBeInTheDocument();
    expect(screen.getByText("2 ativos")).toBeInTheDocument();
    expect(screen.getByText("Revisar Metas")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Revisar Metas"));
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=rebalancear&view=metas&subtab=assets");
  });

  it("renderiza o slide de ativos em quarentena com navegação para carteira", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 0,
      quarantinedCount: 1,
      discountOpportunitiesCount: 0,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Ativos em Quarentena")).toBeInTheDocument();
    expect(screen.getByText("1 em observação")).toBeInTheDocument();
    expect(screen.getByText("Auditar Carteira")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Auditar Carteira"));
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=rebalancear&view=metas&subtab=assets");
  });

  it("renderiza o slide de oportunidade em desconto com navegação para aporte", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 0,
      quarantinedCount: 0,
      discountOpportunitiesCount: 3,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Oportunidade em Desconto")).toBeInTheDocument();
    expect(screen.getByText("3 ativos")).toBeInTheDocument();
    expect(screen.getByText("Simular Aporte")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Simular Aporte"));
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=rebalancear&view=simulador");
  });

  it("renderiza o slide de desvio de alocação normalizando 'Ações de Dividendos' sem valores de Gap em R$", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUsePortfolioPosition.mockReturnValue({
      rows: [
        { assetId: "1", ticker: "RF1", assetClass: "Renda Fixa", valueBRL: 10000, isCash: false },
      ],
      totalBRL: 10000,
      cashBRL: 0,
      isLoading: false,
    });
    mockUseGroupTargets.mockReturnValue({
      data: [
        { id: "c1", name: "Renda Fixa", target_percentage: 70 },
        { id: "c2", name: "Ações de Dividendos", target_percentage: 30 },
      ],
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Desvio de Alocação Detectado")).toBeInTheDocument();
    expect(screen.getByText(/Ações \(-30 p\.p\.\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Ações de Dividendos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gap:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Simular Rebalanceamento"));
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=rebalancear&view=simulador");
  });

  it("exibe tickers em revisão próxima do prazo e permite dispensar por 7 dias", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 0,
      upcomingReviewsCount: 1,
      consolidatedUpcomingAlert: {
        id: "gov-upcoming-1",
        kind: "review_upcoming",
        severity: "info",
        title: "Reavaliação próxima: WEGE3",
        description: "Vence em 10 dias.",
        tickers: ["WEGE3"],
        daysUntilReview: 10,
      },
      upcomingReviewAssets: [
        { id: "a1", ticker: "WEGE3", asset_class: "Ações", score: 9 },
      ],
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Reavaliação Próxima do Prazo")).toBeInTheDocument();
    expect(screen.getByText(/WEGE3 vence em até 10 dias/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dispensar alerta" }));
    fireEvent.click(screen.getByText("Dispensar por 7 dias"));

    expect(screen.queryByText("Reavaliação Próxima do Prazo")).not.toBeInTheDocument();
  });

  it("renderiza o slide de ativos sem nota definida para avaliação inicial sem exibir revisão de teses pendente", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 0,
      upcomingReviewsCount: 0,
      unscoredAssetsCount: 1,
      quarantinedCount: 0,
      discountOpportunitiesCount: 0,
      lowScoreRiskCount: 0,
      overdueAssets: [],
      upcomingReviewAssets: [],
      unscoredAssets: [{ id: "a-bbas3", ticker: "BBAS3", asset_class: "Ações", score: null }],
      consolidatedUnscoredAlert: {
        id: "gov-unscored-1",
        kind: "unscored_asset",
        severity: "info",
        title: "Ativo sem nota: BBAS3",
        description: "BBAS3 ainda não possui nota de convicção para o motor de rebalanceamento.",
        tickers: ["BBAS3"],
      },
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Ativos sem Nota Definida")).toBeInTheDocument();
    expect(screen.getByText("1 ativo")).toBeInTheDocument();
    expect(screen.getByText("Avaliar Agora")).toBeInTheDocument();
    expect(screen.getByText(/Defina a nota de BBAS3 para incluí-lo no rebalanceamento/)).toBeInTheDocument();

    // NÃO deve exibir revisão periódica de teses
    expect(screen.queryByText("Revisão de Teses Pendente")).not.toBeInTheDocument();
    expect(screen.queryByText("Reavaliação Próxima do Prazo")).not.toBeInTheDocument();
  });
});
