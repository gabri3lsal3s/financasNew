import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioInsightsCarousel } from "./portfolio-insights-carousel";

const mockUseCorporateDividends = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useCorporateDividends: () => mockUseCorporateDividends(),
    useApproveDividendsBatch: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
    useDismissCorporateDividend: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

describe("PortfolioInsightsCarousel (Regra 19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada se não houver proventos nem disponíveis nem previstos", () => {
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
});
