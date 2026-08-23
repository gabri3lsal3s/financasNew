import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestmentsPage } from "./investments-page";

let positionMock = {
  rows: [] as unknown[],
  totalBRL: 0,
  totalCostBRL: 0,
  cashBRL: 0,
  investedBRL: 0,
  unrealizedPnlBRL: 0,
  unrealizedPct: 0 as number | null,
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
  useSaveAllocationTargets: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGroupTargets: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useSectorCaps: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransactionsBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecordOrder: () => ({ mutateAsync: vi.fn().mockResolvedValue({ success: true }), isPending: false }),
  useAssetPrices: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useAssetPosition: () => ({ data: [], isLoading: false, ledger: { dividends: 0 } }),
  useSyncQuotes: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useSetManualPrice: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
}));

function renderPage(entry = "/investments") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <InvestmentsPage />
    </MemoryRouter>,
  );
}

describe("InvestmentsPage — F17 unificada", () => {
  beforeEach(() => {
    positionMock = {
      rows: [],
      totalBRL: 0,
      totalCostBRL: 0,
      cashBRL: 0,
      investedBRL: 0,
      unrealizedPnlBRL: 0,
      unrealizedPct: 0,
      monthlySeries: [],
      monthlyContributionCents: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("renderiza o header com os botões de ação e abas de navegação", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Investimentos", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar caixa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova operação" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Carteira" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aporte" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Proventos" })).toBeInTheDocument();
  });

  it("estado vazio quando não há ativos", () => {
    renderPage();
    expect(screen.getByText("Nenhum ativo cadastrado")).toBeInTheDocument();
  });

  it("com ativos, exibe KPIs e tabela de posições", () => {
    positionMock = {
      ...positionMock,
      rows: [row({ assetId: "a1", ticker: "PETR4", valueBRL: 8000, pct: 80, unrealizedPct: 20 })],
      totalBRL: 8000,
    };
    renderPage();

    expect(screen.getByText("Saldo em caixa")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio Total")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 8.000,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Proventos deste Mês")).toBeInTheDocument();
  });

  it("abre o InvestmentWizard ao clicar no botão Nova Operação do header", async () => {
    renderPage();
    const novaOpBtn = screen.getByRole("button", { name: "Nova operação" });
    await userEvent.click(novaOpBtn);
    expect(screen.getByPlaceholderText(/Ex: PETR4, MXRF11/i)).toBeInTheDocument();
  });

  it("abre o CashFormDialog ao clicar no botão Adicionar Caixa do header", async () => {
    renderPage();
    const addCashBtn = screen.getByRole("button", { name: "Adicionar caixa" });
    await userEvent.click(addCashBtn);
    expect(screen.getByRole("heading", { name: /Cadastrar Saldo em Caixa|Editar Saldo em Caixa/i })).toBeInTheDocument();
  });

  it("abre automaticamente o InvestmentWizard via deep link ?novo=investimento", () => {
    renderPage("/investments?novo=investimento");
    expect(screen.getByPlaceholderText(/Ex: PETR4, MXRF11/i)).toBeInTheDocument();
  });
});
