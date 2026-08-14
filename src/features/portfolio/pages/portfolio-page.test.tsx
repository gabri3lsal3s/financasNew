import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PortfolioPage } from "./portfolio-page";

const rows = [
  {
    assetId: "a1",
    ticker: "PETR4",
    assetClass: "Ações",
    currency: "BRL",
    quantity: 10,
    averageCost: 40,
    totalCost: 400,
    dividends: 0,
    priceBRL: 42.5,
    source: "manual",
    valueBRL: 425,
    pct: 42.5,
    isCash: false,
  },
  {
    assetId: "c1",
    ticker: "CAIXA",
    assetClass: "caixa",
    currency: "BRL",
    quantity: 575,
    averageCost: 1,
    totalCost: 575,
    dividends: 0,
    priceBRL: 1,
    source: "fallback",
    valueBRL: 575,
    pct: 57.5,
    isCash: true,
  },
];

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({
    rows,
    totalBRL: 1000,
    cashBRL: -425,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePortfolioAssets: () => ({ data: [], isLoading: false, error: null }),
  useAllocationTargets: () => ({ data: [], isLoading: false, error: null }),
  useGroupTargets: () => ({ data: [], isLoading: false, error: null }),
  useSectorCaps: () => ({ data: { maxSectorAcoes: null, maxSectorFiis: null }, isLoading: false, error: null }),
  useSaveAllocationTargets: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveGroupTarget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveGroupTarget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSectorCaps: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("PortfolioPage (carteira §3.11 — Fase 4 entrega 5)", () => {
  it("mostra a posição com patrimônio, caixa derivado e preço manual destacado", () => {
    render(<PortfolioPage />);
    // KPIs.
    expect(screen.getByText("Patrimônio total")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("Caixa derivado")).toBeInTheDocument();
    // Ativos da tabela.
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("CAIXA")).toBeInTheDocument();
    // Preço manual prevalece e é marcado (DoD F4); badge de caixa presente.
    expect(screen.getByText("manual")).toBeInTheDocument();
    expect(screen.getAllByText("caixa").length).toBeGreaterThan(0);
    expect(screen.getByTitle("Ativo de caixa/reserva valorado 1:1")).toBeInTheDocument();
  });

  it("edita metas por ativo com barra de soma e mostra travas setoriais", async () => {
    const user = userEvent.setup();
    render(<PortfolioPage />);
    await user.click(screen.getByRole("tab", { name: "Metas" }));

    expect(screen.getByText("Metas por ativo (% do patrimônio)")).toBeInTheDocument();
    expect(screen.getByText("Soma das metas")).toBeInTheDocument();
    expect(screen.getByText("Metas por classe")).toBeInTheDocument();
    expect(screen.getByText("Travas setoriais")).toBeInTheDocument();
    // Barra de soma 0% (nenhuma meta definida) — sobra 100%.
    expect(screen.getByText(/Sobram 100\.0%/)).toBeInTheDocument();
  });

  it("calculadora de aporte mostra sobra para caixa quando não há metas", async () => {
    const user = userEvent.setup();
    render(<PortfolioPage />);
    await user.click(screen.getByRole("tab", { name: "Aporte" }));

    // Sem metas → alerta de orientação.
    expect(screen.getByText(/Nenhuma meta definida/)).toBeInTheDocument();

    const input = screen.getByLabelText("Valor do aporte");
    await user.type(input, "100000"); // R$ 1.000,00

    expect(screen.getByText("Sobra para caixa")).toBeInTheDocument();
    // Aporte informado e sobra (sem metas, nada é alocado).
    expect(screen.getAllByText("R$ 1.000,00").length).toBeGreaterThan(0);
    expect(screen.getByText(/Nenhum ativo elegível/)).toBeInTheDocument();
  });
});
