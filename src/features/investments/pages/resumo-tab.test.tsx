import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResumoTab } from "./resumo-tab";

const mockDeleteAsset = vi.fn();
const mockSyncQuotes = vi.fn();

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({
    totalBRL: 15000,
    cashBRL: 5000,
    rows: [
      {
        assetId: "c1",
        ticker: "CAIXA",
        assetClass: "Caixa",
        quantity: 5000,
        averageCost: 1,
        valueBRL: 5000,
        priceBRL: 1,
        source: "fallback",
        unrealizedPnl: 0,
        unrealizedPct: null,
        isCash: true,
        pct: 33.33,
      },
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        quantity: 100,
        averageCost: 30,
        valueBRL: 3500,
        priceBRL: 35,
        source: "api",
        unrealizedPnl: 500,
        unrealizedPct: 16.67,
        isCash: false,
        pct: 23.33,
      },
      {
        assetId: "a2",
        ticker: "MXRF11",
        assetClass: "FIIs",
        quantity: 650,
        averageCost: 10,
        valueBRL: 6500,
        priceBRL: 10,
        source: "api",
        unrealizedPnl: 0,
        unrealizedPct: 0,
        isCash: false,
        pct: 43.33,
      },
    ],
    monthlySeries: [
      { month: "2026-07", valueBRL: 14000, costBRL: 13500 },
      { month: "2026-08", valueBRL: 15000, costBRL: 14500 },
    ],
    isLoading: false,
    error: null,
  }),
  usePortfolioAssets: () => ({
    data: [
      { id: "c1", ticker: "CAIXA", asset_class: "Caixa", quantity: 5000, average_price: 1, currency: "BRL" },
      { id: "a1", ticker: "PETR4", asset_class: "Ações", quantity: 100, average_price: 30, currency: "BRL" },
      { id: "a2", ticker: "MXRF11", asset_class: "FIIs", quantity: 650, average_price: 10, currency: "BRL" },
    ],
    isLoading: false,
    error: null,
  }),
  usePortfolioDividends: () => ({
    data: [
      { id: "d1", asset_id: "a2", date: "2026-08-15", amount: 65, type: "dividend" },
    ],
    isLoading: false,
    error: null,
  }),
  useDeletePortfolioAsset: () => ({
    mutateAsync: mockDeleteAsset,
    isPending: false,
  }),
  useSyncQuotes: () => ({
    mutate: mockSyncQuotes,
    isPending: false,
  }),
  useCreatePortfolioAsset: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreatePortfolioContribution: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreatePortfolioTransactionsBatch: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAllPortfolioTransactions: () => ({
    data: [],
    isLoading: false,
  }),
  usePortfolioContributions: () => ({
    data: [],
    isLoading: false,
  }),
  useDeletePortfolioContribution: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useImportTransactions: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSetManualPrice: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSplitAsset: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("ResumoTab", () => {
  it("renderiza o card de Caixa em primeiro lugar com ações de editar e excluir, e não renderiza card de ativos em carteira", () => {
    render(<ResumoTab />);

    // Card de caixa
    expect(screen.getByText("Saldo em caixa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar saldo em caixa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir ativo de caixa/i })).toBeInTheDocument();

    // Outros KPIs
    expect(screen.getByText("Patrimônio total")).toBeInTheDocument();
    expect(screen.getByText("Proventos no mês")).toBeInTheDocument();

    // Card removido
    expect(screen.queryByText("Ativos em carteira")).not.toBeInTheDocument();
  });

  it("permite abrir o diálogo de edição do caixa ao clicar no botão de editar", async () => {
    const user = userEvent.setup();
    render(<ResumoTab />);

    const editBtn = screen.getByRole("button", { name: /Editar saldo em caixa/i });
    await user.click(editBtn);

    // Diálogo de edição do caixa
    expect(screen.getByRole("heading", { name: /Editar CAIXA/i })).toBeInTheDocument();
  });
});
