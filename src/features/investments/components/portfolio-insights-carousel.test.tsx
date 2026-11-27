import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { todaySaoPauloISO } from "@/domain/portfolio";
import { resetCarouselDismissalsStore } from "@/hooks/use-carousel-dismissals";
import { currentMonth } from "@/lib/date";
import { setActiveUserId } from "@/services/user-storage";
import { debtsKey } from "@/state/queries/use-debts";
import { LOANS_QUERY_KEY } from "@/state/queries/use-loans";
import { publishCarouselEvidence, type CarouselEvidenceIdentity, type CarouselEvidencePayload } from "@/state/selectors";
import { PortfolioInsightsCarousel } from "./portfolio-insights-carousel";

const mockUseCorporateDividends = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseAssetGovernanceInsights = vi.fn();
const mockUsePortfolioPosition = vi.fn();
const mockUseGroupTargets = vi.fn();
const mockUsePortfolioAssets = vi.fn();
const mockUpdateAssetMutateAsync = vi.fn();
const mockNavigate = vi.fn();
const mockUpdateCustomSettings = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
};
let mockUserCustomSettings: Record<string, unknown> = {};
const mockUserPreferencesState = () => ({
  data: { custom_settings: mockUserCustomSettings },
  isLoading: false,
});

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/state/queries/use-user-preferences", () => ({
  useUserPreferences: () => mockUserPreferencesState(),
}));

vi.mock("@/state/mutations/use-preference-mutations", () => ({
  useUpdateCustomSettings: () => mockUpdateCustomSettings,
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
    useConfirmUserDividendEvents: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
    useDismissCorporateDividend: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useAssetGovernanceInsights: () => mockUseAssetGovernanceInsights(),
    usePortfolioPosition: () => mockUsePortfolioPosition(),
    usePortfolioAssets: () => mockUsePortfolioAssets(),
    useGroupTargets: () => mockUseGroupTargets(),
    useUpdatePortfolioAsset: () => ({
      mutateAsync: mockUpdateAssetMutateAsync,
      isPending: false,
    }),
    useUserPreferences: () => mockUserPreferencesState(),
    useUpdateCustomSettings: () => mockUpdateCustomSettings,
    useViewScope: () => ({
      viewScope: "all" as const,
      effectiveViewScope: "all" as const,
      setViewScope: vi.fn(),
      isBusinessModeEnabled: false,
    }),
  };
});

describe("PortfolioInsightsCarousel (Regra 19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserCustomSettings = {};
    window.localStorage.clear();
    setActiveUserId("user-1");
    resetCarouselDismissalsStore();
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
    mockUsePortfolioAssets.mockReturnValue({
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
          taxRatePct: 0,
          grossAmount: 100,
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

    expect(screen.getByText("Proventos a Conferir")).toBeInTheDocument();
    expect(screen.getByText("Aprovar no Caixa")).toBeInTheDocument();
    expect(screen.getByText("Ver detalhes")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Aprovar no Caixa"));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      items: [
        {
          event_id: null,
          corporate_dividend_id: "c1",
          asset_id: "a1",
          ticker: "PETR4",
          type: "DIVIDENDO",
          com_date: "2026-10-30",
          date: "2026-11-05",
          amount: 100,
          tax_rate_pct: 0,
          quantity_on_com_date: 100,
          gross_rate: 1.0,
          net_rate: 1.0,
          currency: "BRL",
          fx_rate: null,
          notes: "Provento automático (DIVIDENDO)",
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
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=metas");
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
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=metas");
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
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=aporte");
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
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=aporte");
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

    fireEvent.click(screen.getByRole("button", { name: /Dispensar Reavaliação Próxima do Prazo/i }));
    fireEvent.click(screen.getByRole("button", { name: /7 dias/i }));

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

  it("renderiza o slide de hiperconcentração em ativo único quando ultrapassa limite", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUsePortfolioAssets.mockReturnValue({
      data: [
        {
          id: "p1",
          ticker: "PETR4",
          asset_class: "Ações",
          quantity: 1000,
          average_price: 40, // 40.000 BRL
        },
        {
          id: "v1",
          ticker: "VALE3",
          asset_class: "Ações",
          quantity: 100,
          average_price: 60, // 6.000 BRL
        },
      ],
      isLoading: false,
    });
    mockUsePortfolioPosition.mockReturnValue({
      rows: [],
      totalBRL: 46000,
      cashBRL: 0,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Alta concentração em PETR4")).toBeInTheDocument();
    expect(screen.getByText("87,0% do total")).toBeInTheDocument();
    expect(screen.getByText("Simular Rebalanceamento")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Simular Rebalanceamento"));
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=aporte");
  });

  it("renderiza o slide de teto de emissor FGC na Renda Fixa", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    // Carteira de 1.500.000 BRL onde BMG tem 300.000 (> 250k FGC) distribuído em 2 CDBs (150k cada = 10% <= 25%)
    mockUsePortfolioAssets.mockReturnValue({
      data: [
        {
          id: "cdb1",
          ticker: "CDB-BMG-2027",
          asset_class: "Renda Fixa",
          quantity: 150,
          average_price: 1000, // 150.000 BRL (10%)
        },
        {
          id: "cdb2",
          ticker: "CDB-BMG-2028",
          asset_class: "Renda Fixa",
          quantity: 150,
          average_price: 1000, // 150.000 BRL (10%)
        },
        {
          id: "tesouro1",
          ticker: "TESOURO-SELIC-29",
          asset_class: "Renda Fixa",
          quantity: 300,
          average_price: 1000, // 300.000 BRL (20%)
        },
        {
          id: "tesouro2",
          ticker: "TESOURO-IPCA-35",
          asset_class: "Renda Fixa",
          quantity: 300,
          average_price: 1000, // 300.000 BRL (20%)
        },
        {
          id: "tesouro3",
          ticker: "TESOURO-PREFIXADO-31",
          asset_class: "Renda Fixa",
          quantity: 300,
          average_price: 1000, // 300.000 BRL (20%)
        },
        {
          id: "cdb-itau",
          ticker: "CDB-ITAU-2029",
          asset_class: "Renda Fixa",
          quantity: 150,
          average_price: 1000, // 150.000 BRL (10%)
        },
        {
          id: "cdb-bradesco",
          ticker: "CDB-BRADESCO-2029",
          asset_class: "Renda Fixa",
          quantity: 150,
          average_price: 1000, // 150.000 BRL (10%)
        },
      ],
      isLoading: false,
    });
    mockUsePortfolioPosition.mockReturnValue({
      rows: [],
      totalBRL: 1500000,
      cashBRL: 0,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getAllByText(/Exposição concentrada em.*BMG/)[0]).toBeInTheDocument();
    expect(screen.getAllByText("Teto FGC")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Ver Renda Fixa")[0]).toBeInTheDocument();

    const btn = screen.getAllByText("Ver Renda Fixa")[0];
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn!);
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=posicao");
  });

  it("renderiza o slide de sobreposição excessiva de ETFs do mesmo benchmark", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    // Carteira de 1.000.000 BRL com IVVB11 (175k = 17.5%) + VOO (175k = 17.5%) = 35% S&P 500 (> 30% teto)
    // Nenhum ativo ou classe viola outro teto estrutural (cada posição <= 14%)
    mockUsePortfolioAssets.mockReturnValue({
      data: [
        {
          id: "etf1",
          ticker: "IVVB11",
          asset_class: "Internacional",
          quantity: 583.333,
          average_price: 300, // ~175.000 BRL
        },
        {
          id: "etf2",
          ticker: "VOO",
          asset_class: "Internacional",
          currency: "USD",
          quantity: 70,
          average_price: 500, // 70 * 500 * 5 = 175.000 BRL
        },
        {
          id: "a1",
          ticker: "PETR4",
          asset_class: "Ações",
          quantity: 3250,
          average_price: 40, // 130.000 BRL (13%)
        },
        {
          id: "a2",
          ticker: "VALE3",
          asset_class: "Ações",
          quantity: 2166,
          average_price: 60, // ~130.000 BRL (13%)
        },
        {
          id: "a3",
          ticker: "ITUB4",
          asset_class: "Ações",
          quantity: 3714,
          average_price: 35, // ~130.000 BRL (13%)
        },
        {
          id: "f1",
          ticker: "HGLG11",
          asset_class: "FIIs",
          quantity: 812,
          average_price: 160, // ~130.000 BRL (13%)
        },
        {
          id: "rf1",
          ticker: "TESOURO SELIC",
          asset_class: "Renda Fixa",
          quantity: 1,
          average_price: 130000, // 130.000 BRL (13%)
        },
      ],
      isLoading: false,
    });
    mockUsePortfolioPosition.mockReturnValue({
      rows: [],
      totalBRL: 1000000,
      cashBRL: 0,
      usdRate: 5.0,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getAllByText("Sobreposição de ETFs em S&P 500")[0]).toBeInTheDocument();
    expect(screen.getAllByText("2 ETFs sobrepostos")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Ver Carteira")[0]).toBeInTheDocument();

    const btn = screen.getAllByText("Ver Carteira")[0];
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn!);
    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=posicao");
  });

  it("bloqueia 1-clique cego no carrossel quando houver provento com isTypeUncertain=true", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [
        {
          corporateDividendId: "c-yahoo-1",
          assetId: "a1",
          ticker: "BBAS3",
          type: "DIVIDENDO",
          comDate: "2026-10-30",
          paymentDate: "2026-11-05",
          quantityOnComDate: 100,
          rate: 0.8,
          netRate: 0.8,
          totalAmount: 80,
          currency: "BRL",
          status: "available",
          isTypeUncertain: true,
        },
      ],
      projected: [],
      totalAvailableAmount: 80,
      totalProjectedAmount: 0,
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    expect(screen.getByText("Alíquota a conferir")).toBeInTheDocument();
    expect(screen.queryByText("Aprovar no Caixa")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e Aprovar/i }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("exibe slides já prontos enquanto isDividendsLoading for true se houver alertas ativos, e omite skeleton sem histórico prévio", () => {
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: true,
    });
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
      consolidatedReviewAlert: null,
      isLoading: false,
    });

    const { container, rerender } = render(<PortfolioInsightsCarousel />);
    expect(container.firstChild).toBeNull();

    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 2,
      upcomingReviewsCount: 0,
      unscoredAssetsCount: 0,
      quarantinedCount: 0,
      discountOpportunitiesCount: 0,
      lowScoreRiskCount: 0,
      overdueAssets: [
        {
          id: "a1",
          ticker: "ITUB4",
          asset_class: "Ações",
          score: 8,
          last_reviewed_at: "2025-01-01",
        },
      ],
      upcomingReviewAssets: [],
      unscoredAssets: [],
      consolidatedReviewAlert: {
        id: "gov-overdue",
        severity: "warning",
        category: "overdue_review",
        title: "2 ativos com revisão vencida",
        description: "Revisar teses.",
        assetIds: ["a1"],
      },
      isLoading: false,
    });

    rerender(<PortfolioInsightsCarousel />);
    expect(screen.getByText("Revisão de Teses Pendente")).toBeInTheDocument();
    expect(screen.getByText("2 ativos")).toBeInTheDocument();
  });

  it("respeita lowScoreThreshold da política, prioriza ativo >5% no lowScoreSample e exclui cotação >= teto no discountSample", () => {
    mockUserCustomSettings = {
      portfolioRiskPolicy: { lowScoreThreshold: 6 },
    };
    mockUseCorporateDividends.mockReturnValue({
      available: [],
      projected: [],
      totalAvailableAmount: 0,
      totalProjectedAmount: 0,
      isLoading: false,
    });
    mockUsePortfolioAssets.mockReturnValue({
      data: [
        { id: "a-small", ticker: "SMALL3", asset_class: "Ações", score: 5, quantity: 10, average_price: 20 },
        { id: "a-big", ticker: "BIG3", asset_class: "Ações", score: 6, quantity: 100, average_price: 10 },
        { id: "d-over", ticker: "OVER3", asset_class: "Ações", score: 9, ceiling_price: 20, quantity: 10, average_price: 15 },
        { id: "d-ok", ticker: "DISC3", asset_class: "Ações", score: 9, ceiling_price: 30, quantity: 10, average_price: 20 },
      ],
      isLoading: false,
    });
    mockUsePortfolioPosition.mockReturnValue({
      rows: [
        { assetId: "a-small", ticker: "SMALL3", valueBRL: 200, priceQuote: 20, isEstimate: false },
        { assetId: "a-big", ticker: "BIG3", valueBRL: 1000, priceQuote: 10, isEstimate: false },
        { assetId: "d-over", ticker: "OVER3", valueBRL: 250, priceQuote: 25, isEstimate: false, canonicalSource: "quote_cache" },
        { assetId: "d-ok", ticker: "DISC3", valueBRL: 210, priceQuote: 21, isEstimate: false, canonicalSource: "quote_cache" },
      ],
      totalBRL: 10000,
      cashBRL: 0,
      isLoading: false,
    });
    mockUseAssetGovernanceInsights.mockReturnValue({
      overdueReviewsCount: 0,
      upcomingReviewsCount: 0,
      unscoredAssetsCount: 0,
      quarantinedCount: 0,
      discountOpportunitiesCount: 1,
      lowScoreRiskCount: 1,
      overdueAssets: [],
      upcomingReviewAssets: [],
      unscoredAssets: [],
      isLoading: false,
    });

    render(<PortfolioInsightsCarousel />);

    const lowMemBtn = screen.getByRole("button", {
      name: /Ver memória de cálculo.*Concentração em Baixa Convicção/i,
      hidden: true,
    });
    fireEvent.click(lowMemBtn);
    expect(screen.getAllByText(/Sobrepeso em Baixa Convicção: BIG3/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nota <= 6/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Fechar/i })[0]!);

    const discMemBtn = screen.getByRole("button", {
      name: /Ver memória de cálculo.*Oportunidade em Desconto/i,
      hidden: true,
    });
    fireEvent.click(discMemBtn);
    expect(screen.getAllByText(/Margem de Segurança: DISC3/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/OVER3/)).not.toBeInTheDocument();
  });

  describe("Onda 2 · Fase 5 — Projeção passiva Home -> Carteira", () => {
    const createEvidenceIdentity = (): CarouselEvidenceIdentity => ({
      userId: "user-1",
      mode: "auth",
      scope: "all",
      month: currentMonth(),
      asOf: todaySaoPauloISO(),
    });

    const createBaseEvidence = (
      overrides?: Partial<CarouselEvidencePayload>,
    ): CarouselEvidencePayload => ({
      surplusCapacity: {
        operatingBalanceCents: 200_000,
        committedObligationsCents: 50_000,
        pendingRecurringObligationsCents: 0,
        surplusCents: 150_000,
        suggestedAporteCents: 30_000,
        suggestedEmergencyAllocationCents: 0,
        hasSurplus: true,
        allocationIntent: "portfolio_aporte",
      },
      cashGapResult: {
        isCashGapDetected: false,
        severity: "none",
        gapDate: null,
        daysUntilGap: null,
        maxDeficitCents: 0,
        nextInflowDate: null,
        causingObligations: [],
        recommendationMessage: null,
        runway: [],
      },
      isCurrentMonth: true,
      dayOfMonth: 15,
      daysInMonth: 30,
      safeToSpendCents: 120_000,
      hasLiquidityContext: true,
      investmentCents: 0,
      debtsCount: 0,
      ...overrides,
    });

    it("deep-link frio em /investments sem evidência prévia não exibe cards de fluxo da Home nem cria queries extras", () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      mockUseCorporateDividends.mockReturnValue({
        available: [],
        projected: [],
        totalAvailableAmount: 0,
        totalProjectedAmount: 0,
        isLoading: false,
      });

      const { container } = render(
        <QueryClientProvider client={qc}>
          <PortfolioInsightsCarousel />
        </QueryClientProvider>,
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByText(/Furo de caixa previsto/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Aporte combinado disponível/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/livres para investir/i)).not.toBeInTheDocument();
      expect(qc.getQueryCache().getAll().some((q) => Boolean(q.options.queryFn))).toBe(false);
    });

    it("evidência quente com cash_gap crítico assume prioridade 1 e suprime sinais de estímulo ao aporte", () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      publishCarouselEvidence(
        qc,
        createEvidenceIdentity(),
        createBaseEvidence({
          cashGapResult: {
            isCashGapDetected: true,
            severity: "critical",
            gapDate: todaySaoPauloISO(),
            daysUntilGap: 2,
            maxDeficitCents: 45_000,
            nextInflowDate: null,
            causingObligations: [],
            recommendationMessage: "Furo crítico de R$ 450,00 nos próximos dias.",
            runway: [],
          },
        }),
      );

      mockUseCorporateDividends.mockReturnValue({
        available: [],
        projected: [],
        totalAvailableAmount: 0,
        totalProjectedAmount: 0,
        isLoading: false,
      });
      mockUseGroupTargets.mockReturnValue({
        data: [
          { id: "gt-1", user_id: "user-1", group_by: "class", name: "Renda Variável", target_percentage: 60 },
          { id: "gt-2", user_id: "user-1", group_by: "class", name: "Renda Fixa", target_percentage: 40 },
        ],
        isLoading: false,
      });
      mockUsePortfolioPosition.mockReturnValue({
        rows: [
          { assetId: "a1", ticker: "ITUB4", assetClass: "Renda Variável", valueBRL: 200, isCash: false },
          { assetId: "a2", ticker: "CDB", assetClass: "Renda Fixa", valueBRL: 800, isCash: false },
        ],
        totalBRL: 1200,
        cashBRL: 200,
        isLoading: false,
      });

      render(
        <QueryClientProvider client={qc}>
          <PortfolioInsightsCarousel />
        </QueryClientProvider>,
      );

      const slides = Array.from(document.querySelectorAll("[data-carousel-slide-id]")).map((el) =>
        el.getAttribute("data-carousel-slide-id"),
      );
      expect(slides[0]).toBe("cashflow.cash_gap");
      expect(screen.getByText("Furo de caixa previsto antes do aporte")).toBeInTheDocument();
      expect(screen.queryByText("Aporte combinado disponível")).not.toBeInTheDocument();
      expect(screen.queryByText(/livres para investir/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/parados na corretora/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Ver projeção de caixa" }));
      expect(mockNavigate).toHaveBeenCalledWith("/insights?aba=projection");
    });

    it("evidência quente com sobra + caixa na corretora exibe bridge.combined_contribution sem somar proventos pendentes e navega para simulador combinado", () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      publishCarouselEvidence(qc, createEvidenceIdentity(), createBaseEvidence());

      mockUseCorporateDividends.mockReturnValue({
        available: [
          {
            corporateDividendId: "cd-1",
            assetId: "a1",
            ticker: "PETR4",
            type: "DIVIDENDO",
            comDate: "2026-10-30",
            paymentDate: "2026-11-10",
            quantityOnComDate: 50,
            rate: 1,
            netRate: 1,
            taxRatePct: 0,
            totalAmount: 50,
            currency: "BRL",
            isManual: false,
          },
        ],
        projected: [],
        totalAvailableAmount: 50,
        totalProjectedAmount: 0,
        isLoading: false,
      });
      mockUseGroupTargets.mockReturnValue({
        data: [
          { id: "gt-1", user_id: "user-1", group_by: "class", name: "Renda Variável", target_percentage: 60 },
          { id: "gt-2", user_id: "user-1", group_by: "class", name: "Renda Fixa", target_percentage: 40 },
        ],
        isLoading: false,
      });
      mockUsePortfolioPosition.mockReturnValue({
        rows: [
          { assetId: "a1", ticker: "PETR4", assetClass: "Renda Variável", valueBRL: 200, isCash: false },
          { assetId: "a2", ticker: "CDB", assetClass: "Renda Fixa", valueBRL: 800, isCash: false },
        ],
        totalBRL: 1100,
        cashBRL: 100,
        isLoading: false,
      });

      render(
        <QueryClientProvider client={qc}>
          <PortfolioInsightsCarousel />
        </QueryClientProvider>,
      );

      expect(screen.getAllByText("Aporte combinado disponível").length).toBeGreaterThan(0);
      // 300 sobra + 100 caixa = R$ 400,00 (sem somar R$ 50 de dividendos pendentes)
      expect(screen.getAllByText(/total de R\$\s*400,00/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/450,00/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/1 provento\(s\) a conferir separadamente/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/parados na corretora/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: "Simular aporte combinado", hidden: true })[0]!);
      expect(mockNavigate).toHaveBeenCalledWith(
        "/investments?tab=rebalancear&view=simulador&valor=30000&usarCaixa=1",
      );
    });

    it("aplica teto de 5 slides com no máximo 2 riscos estruturais mesmo com pontes ativas", () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      publishCarouselEvidence(qc, createEvidenceIdentity(), createBaseEvidence());

      qc.setQueryData(LOANS_QUERY_KEY, [
        {
          id: "loan-1",
          user_id: "user-1",
          name: "CDC Caro",
          loan_type: "loan",
          principal_amount: 10000,
          interest_rate_monthly: 2.1,
          amortization_system: "price",
          total_installments: 12,
          start_date: "2026-01-10",
          installment_group_id: "ig-1",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]);
      qc.setQueryData(debtsKey, [
        {
          id: "d-1",
          name: "Parcela CDC 1/12",
          type: "payable",
          amount: 1000,
          due_date: todaySaoPauloISO(),
          paid_at: null,
          installment_group_id: "ig-1",
        },
      ]);

      mockUseCorporateDividends.mockReturnValue({
        available: [
          {
            corporateDividendId: "cd-1",
            assetId: "a1",
            ticker: "CONC3",
            type: "DIVIDENDO",
            comDate: "2026-10-30",
            paymentDate: "2026-11-10",
            quantityOnComDate: 100,
            rate: 1,
            netRate: 1,
            taxRatePct: 0,
            totalAmount: 100,
            currency: "BRL",
            isManual: false,
          },
        ],
        projected: [],
        totalAvailableAmount: 100,
        totalProjectedAmount: 0,
        isLoading: false,
      });
      mockUseGroupTargets.mockReturnValue({
        data: [
          { id: "gt-1", user_id: "user-1", group_by: "class", name: "Ações", target_percentage: 60 },
          { id: "gt-2", user_id: "user-1", group_by: "class", name: "Renda Fixa", target_percentage: 40 },
        ],
        isLoading: false,
      });
      // Gera múltiplos riscos estruturais (> 25% em 2 ativos + baixa diversificação + exposição emissor)
      mockUsePortfolioAssets.mockReturnValue({
        data: [
          { id: "a1", ticker: "CONC3", asset_class: "Ações", sector: "Financeiro", quantity: 400, average_price: 100 },
          { id: "a2", ticker: "BIGR3", asset_class: "Ações", sector: "Financeiro", quantity: 350, average_price: 100 },
          { id: "a3", ticker: "CDB-BMG-28", asset_class: "Renda Fixa", issuer_institution: "Banco BMG", quantity: 300, average_price: 1000 },
        ],
        isLoading: false,
      });
      mockUsePortfolioPosition.mockReturnValue({
        rows: [
          { assetId: "a1", ticker: "CONC3", assetClass: "Ações", valueBRL: 40000, isCash: false },
          { assetId: "a2", ticker: "BIGR3", assetClass: "Ações", valueBRL: 35000, isCash: false },
          { assetId: "a3", ticker: "CDB-BMG-28", assetClass: "Renda Fixa", valueBRL: 300000, isCash: false },
        ],
        totalBRL: 375500,
        cashBRL: 500,
        isLoading: false,
      });
      mockUseAssetGovernanceInsights.mockReturnValue({
        overdueReviewsCount: 1,
        upcomingReviewsCount: 0,
        unscoredAssetsCount: 0,
        quarantinedCount: 0,
        discountOpportunitiesCount: 0,
        lowScoreRiskCount: 0,
        overdueAssets: [{ id: "a1", ticker: "CONC3", score: 8 }],
        upcomingReviewAssets: [],
        unscoredAssets: [],
        consolidatedReviewAlert: { overdueCount: 1, isOverdue: true },
        isLoading: false,
      });

      render(
        <QueryClientProvider client={qc}>
          <PortfolioInsightsCarousel />
        </QueryClientProvider>,
      );

      const slides = Array.from(document.querySelectorAll("[data-carousel-slide-id]")).map((el) =>
        el.getAttribute("data-carousel-slide-id") ?? "",
      );
      expect(slides.length).toBeLessThanOrEqual(5);
      const structuralSlides = slides.filter((id) => id.startsWith("portfolio.risk."));
      expect(structuralSlides.length).toBeLessThanOrEqual(2);
    });
  });
});
