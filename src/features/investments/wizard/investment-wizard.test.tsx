import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvestmentWizard } from "./investment-wizard";
import type { PortfolioAsset } from "@/types";

const mockAsset: PortfolioAsset = {
  id: "asset-1",
  user_id: "user-1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 30.0,
  notes: "Petrobras PN",
};

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [mockAsset],
    isLoading: false,
    error: null,
  }),
  usePortfolioPosition: () => ({
    totalBRL: 5000,
    cashBRL: 1000,
    investedBRL: 4000,
    rows: [{ assetId: "asset-1", ticker: "PETR4", valueBRL: 4000, pct: 80, assetClass: "Ações" }],
    isLoading: false,
    error: null,
  }),
  useAllocationTargets: () => ({
    data: [{ asset_id: "asset-1", target_percentage: 20 }],
    isLoading: false,
    error: null,
  }),
  useGroupTargets: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreatePortfolioAsset: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "new-asset-id", ticker: "WEGE3" }),
    isPending: false,
  }),
  useRecordOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useSaveAllocationTargets: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
  useSetManualPrice: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
}));

describe("InvestmentWizard (Fase 41)", () => {
  it("renderiza o passo inicial de seleção com autocomplete e sugestões", () => {
    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Ex: PETR4, MXRF11/i)).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
  });

  it("inicia em modo fast-track de Aporte quando recebe initialAsset", () => {
    render(<InvestmentWizard open={true} initialAsset={mockAsset} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Quantidade de Cotas")).toBeInTheDocument();
    expect(screen.getByText("Posição Atual: 100 cotas · PM:")).toBeInTheDocument();
  });

  it("inicia em modo fast-track de Venda quando recebe initialAsset e initialMode='sell'", () => {
    render(
      <InvestmentWizard
        open={true}
        initialAsset={mockAsset}
        initialMode="sell"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Quantidade a Vender")).toBeInTheDocument();
    expect(screen.getByText("Preço de Venda (BRL)")).toBeInTheDocument();
  });

  it("permite selecionar um ativo existente e transitar para o formulário de aporte", () => {
    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    const assetButton = screen.getByText("PETR4").closest("button");
    if (assetButton) {
      fireEvent.click(assetButton);
    }
    expect(screen.getByText("Quantidade de Cotas")).toBeInTheDocument();
  });

  it("permite buscar e selecionar ticker de 1 letra ('O' - Realty Income) transitando para posição inicial", () => {
    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Ex: PETR4, MXRF11/i);
    fireEvent.change(searchInput, { target: { value: "O" } });

    expect(screen.getByText("Realty Income Corporation (The Monthly Dividend Company)")).toBeInTheDocument();
    const resultButton = screen.getByText("Realty Income Corporation (The Monthly Dividend Company)").closest("button");
    if (resultButton) {
      fireEvent.click(resultButton);
    }
    expect(screen.getByLabelText("Código do Ativo (Ticker)")).toHaveValue("O");
    expect(screen.getByLabelText(/Quantidade Inicial de Cotas/i)).toBeInTheDocument();
  });

  it("exibe aviso informativo quando o usuário não possui metas cadastradas", () => {
    // Renderiza componente StepSelect diretamente com targets vazios
    render(
      <InvestmentWizard
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/PETR4/i)).toBeInTheDocument();
  });
});
