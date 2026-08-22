import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestmentsPage } from "./investments-page";

let positionMock = {
  rows: [] as unknown[],
  totalBRL: 0,
  totalCostBRL: 0,
  cashBRL: 0,
  monthlySeries: [] as { month: string; valueBRL: number; costBRL: number }[],
  monthlyContributionCents: 0,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
};

const row = (overrides: Partial<Record<string, unknown>> = {}) => ({
  assetId: "a1",
  ticker: "PETR4",
  assetClass: "Ações",
  currency: "BRL",
  quantity: 10,
  averageCost: 40,
  totalCost: 400,
  totalCostBRL: 400,
  averageCostBRL: 40,
  dividends: 0,
  priceBRL: 42.5,
  source: "api",
  valueBRL: 8000,
  unrealizedPct: 20,
  unrealizedPnl: 1600,
  pct: 80,
  isCash: false,
  ...overrides,
});

vi.mock("react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("@/state", () => ({
  usePortfolioPosition: () => positionMock,
  useAllPortfolioTransactions: () => ({
    data: [] as { type: string; date: string; total: number }[],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePortfolioAssets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  usePortfolioDividends: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  usePortfolioContributions: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  usePortfolioSnapshots: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useAllocationTargets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useGroupTargets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSectorCaps: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransactionsBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssetPrices: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSyncQuotes: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

describe("InvestmentsPage — F17 unificada", () => {
  beforeEach(() => {
    positionMock = {
      rows: [],
      totalBRL: 0,
      totalCostBRL: 0,
      cashBRL: 0,
      monthlySeries: [],
      monthlyContributionCents: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("renderiza o header, abas e navegação padrão", () => {
    render(<InvestmentsPage />);
    expect(screen.getByRole("heading", { name: "Investimentos", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resumo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Proventos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Metas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aporte" })).toBeInTheDocument();
  });

  it("estado vazio quando não há ativos", () => {
    render(<InvestmentsPage />);
    expect(screen.getByText("Sem investimentos cadastrados")).toBeInTheDocument();
  });

  it("com ativos, exibe KPIs e tabela de posições", () => {
    positionMock = {
      ...positionMock,
      rows: [row({ assetId: "a1", ticker: "PETR4", valueBRL: 8000, pct: 80, unrealizedPct: 20 })],
      totalBRL: 8000,
    };
    render(<InvestmentsPage />);

    expect(screen.getByText("Patrimônio total")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 8.000,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Rentabilidade")).toBeInTheDocument();
    expect(screen.getByText("Proventos no mês")).toBeInTheDocument();
    expect(screen.getByText("Ativos em carteira")).toBeInTheDocument();
  });
});
