import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthlyClosingEditor } from "./monthly-closing-editor";
import type { PointInTimeResult } from "@/domain/portfolio";

const mockSaveClosing = vi.fn();
vi.mock("@/state/mutations/use-portfolio-monthly-mutations", () => ({
  useSaveMonthlyClosing: () => ({
    mutateAsync: mockSaveClosing,
    isPending: false,
  }),
}));

const mockHistoricalPosition: PointInTimeResult = {
  month: "2026-08",
  cutoffDate: "2026-08-31",
  cashQuantity: 100,
  totalInvestedBRL: 8000,
  totalCostBRL: 7500,
  totalValueBRL: 8100,
  monthDividendsTotalBRL: 50,
  accumulatedDividendsTotalBRL: 500,
  positions: [
    {
      assetId: "ast-voo",
      ticker: "VOO",
      assetClass: "Internacional",
      sector: "Índice EUA",
      currency: "USD",
      quantity: 1,
      averagePrice: 400,
      totalCost: 400,
      totalCostBRL: 2100,
      priceQuote: 500,
      priceBRL: 2625,
      valueBRL: 2625,
      quoteSource: "api",
      isEstimate: false,
      unrealizedPnl: 525,
      unrealizedPct: 25,
      monthDividendsBRL: 0,
      accumulatedDividendsBRL: 0,
      totalReturnPnl: 525,
      totalReturnPct: 25,
    },
    {
      assetId: "ast-petr4",
      ticker: "PETR4",
      assetClass: "Ações",
      sector: "Petróleo",
      currency: "BRL",
      quantity: 100,
      averagePrice: 30,
      totalCost: 3000,
      totalCostBRL: 3000,
      priceQuote: 35,
      priceBRL: 35,
      valueBRL: 3500,
      quoteSource: "api",
      isEstimate: false,
      unrealizedPnl: 500,
      unrealizedPct: 16.67,
      monthDividendsBRL: 0,
      accumulatedDividendsBRL: 0,
      totalReturnPnl: 500,
      totalReturnPct: 16.67,
    },
  ],
  fidelity: {
    status: "complete",
    canGenerateExecutiveReport: true,
    reasons: [],
    reconstructedTotalValue: 8100,
    totalAssetsCount: 2,
    calibratedQuotesCount: 0,
    apiQuotesCount: 2,
    fallbackQuotesCount: 0,
  },
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

describe("MonthlyClosingEditor", () => {
  it("renderiza os ativos com badges de cotação e calcula totais considerando paridade USD/BRL", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyClosingEditor
          month="2026-08"
          historicalPosition={mockHistoricalPosition}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Conferência e Calibração do Fechamento (2026-08)")).toBeInTheDocument();
    expect(screen.getByText("VOO")).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    // Exibe valor total de VOO convertido em BRL: R$ 2.625,00
    expect(screen.getByText(/2\.625,00/)).toBeInTheDocument();
  });

  it("carrega ativos candidatos da carteira quando a competência possui apenas saldo TWA (balance_only)", () => {
    const mockTwaPosition: PointInTimeResult = {
      month: "2026-07",
      cutoffDate: "2026-07-31",
      cashQuantity: 500,
      totalInvestedBRL: 0,
      totalCostBRL: 0,
      totalValueBRL: 500,
      monthDividendsTotalBRL: 0,
      accumulatedDividendsTotalBRL: 0,
      positions: [],
      fidelity: {
        status: "balance_only",
        canGenerateExecutiveReport: false,
        reasons: ["Competência registrada apenas com saldo consolidado (TWA)."],
        snapshotTotalValue: 10000,
        reconstructedTotalValue: 0,
        totalAssetsCount: 0,
        calibratedQuotesCount: 0,
        apiQuotesCount: 0,
        fallbackQuotesCount: 0,
      },
      candidateAssets: [
        {
          assetId: "cand-1",
          ticker: "VALE3",
          assetClass: "Ações",
          currency: "BRL",
          suggestedQuantity: 100,
          referencePrice: 60,
        },
      ],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyClosingEditor
          month="2026-07"
          historicalPosition={mockTwaPosition}
        />
      </QueryClientProvider>,
    );

    // Deve carregar o ativo candidato com badge "Sugerido"
    expect(screen.getByText("VALE3")).toBeInTheDocument();
    expect(screen.getByText("Sugerido")).toBeInTheDocument();
    // Exibe régua de reconciliação com o TWA
    expect(screen.getByText("Saldo Registrado no TWA")).toBeInTheDocument();
    expect(screen.getAllByText(/10\.000,00/)[0]).toBeInTheDocument();
  });

  it("permite salvar o fechamento consolidado", async () => {
    mockSaveClosing.mockResolvedValue({});
    const onSaved = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <MonthlyClosingEditor
          month="2026-08"
          historicalPosition={mockHistoricalPosition}
          onSaved={onSaved}
        />
      </QueryClientProvider>,
    );

    const saveButton = screen.getByRole("button", { name: /Salvar Fechamento/i });
    expect(saveButton).toBeInTheDocument();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveClosing).toHaveBeenCalledWith(
        expect.objectContaining({
          month: "2026-08",
          prices: expect.arrayContaining([
            expect.objectContaining({ ticker: "VOO", currency: "USD" }),
            expect.objectContaining({ ticker: "PETR4", currency: "BRL" }),
          ]),
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
