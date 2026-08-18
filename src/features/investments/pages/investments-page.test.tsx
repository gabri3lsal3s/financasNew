import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestmentsPage } from "./investments-page";

let positionMock = {
  rows: [] as unknown[],
  totalBRL: 0,
  cashBRL: 0,
  monthlySeries: [] as { month: string; valueBRL: number }[],
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
  useAllocationTargets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useGroupTargets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSectorCaps: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssetPrices: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSyncQuotes: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

describe("InvestmentsPage (F17 — dashboard /investments)", () => {
  beforeEach(() => {
    positionMock = {
      rows: [],
      totalBRL: 0,
      cashBRL: 0,
      monthlySeries: [],
      monthlyContributionCents: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("vazio exibe EmptyState com CTA para adicionar o primeiro ativo", () => {
    render(<InvestmentsPage />);
    expect(screen.getByText("Sem investimentos")).toBeInTheDocument();
    // Header e EmptyState oferecem o mesmo CTA (2 botões).
    expect(screen.getAllByRole("button", { name: /Adicionar ativo/i }).length).toBeGreaterThan(0);
  });

  it("com posição mostra KPIs executivos, donuts e tabela com ordenação", () => {
    positionMock = {
      ...positionMock,
      rows: [
        row(),
        row({
          assetId: "a2",
          ticker: "BOVA11",
          assetClass: "FIIs",
          valueBRL: 2000,
          unrealizedPct: 5,
          unrealizedPnl: 100,
          pct: 20,
        }),
      ],
      totalBRL: 10000,
      cashBRL: 500,
      monthlySeries: [
        { month: "2026-07", valueBRL: 8000 },
        { month: "2026-08", valueBRL: 10000 },
      ],
    };
    render(<InvestmentsPage />);
    expect(screen.getByText("Patrimônio total")).toBeInTheDocument();
    // Rentabilidade ponderada: (20×8000 + 5×2000) ÷ 10.000 = 17,0%
    expect(screen.getByText("+17,0%")).toBeInTheDocument();
    expect(screen.getByText("Proventos no mês")).toBeInTheDocument();
    expect(screen.getByText("Alocação por classe")).toBeInTheDocument();
    expect(screen.getByText("Alocação por ativo")).toBeInTheDocument();
    expect(screen.getByText("Posições")).toBeInTheDocument();
    // Ordenação: cabeçalho "Valor" é um botão.
    expect(screen.getByRole("button", { name: /Valor/i })).toBeInTheDocument();
  });

  it("loading exibe skeletons sem dados", () => {
    positionMock = { ...positionMock, isLoading: true };
    render(<InvestmentsPage />);
    expect(screen.queryByText("Patrimônio total")).not.toBeInTheDocument();
    expect(screen.getByText("Investimentos")).toBeInTheDocument();
  });
});
