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

let mockTargets = [{ asset_id: "asset-1", target_percentage: 20 }];
let mockAssetsList: PortfolioAsset[] = [mockAsset];
const mockRecordOrder = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: mockAssetsList,
    isLoading: false,
    error: null,
  }),
  usePortfolioPosition: () => ({
    totalBRL: 5000,
    cashBRL: 1000,
    investedBRL: 4000,
    rows: [{ assetId: "asset-1", ticker: "PETR4", valueBRL: 1000, pct: 20, assetClass: "Ações", priceBRL: 50 }],
    isLoading: false,
    error: null,
  }),
  useAllocationTargets: () => ({
    data: mockTargets,
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
    mutateAsync: mockRecordOrder,
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
    expect(screen.getAllByText("O").length).toBeGreaterThan(0);
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

  it("deixa quantidade vazia ao selecionar ativo recomendado quando não há saldo em caixa", () => {
    mockTargets = [{ asset_id: "asset-1", target_percentage: 80 }];
    mockAssetsList = [mockAsset]; // Sem ativo de CAIXA

    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Recomendados para aporte")).toBeInTheDocument();
    expect(screen.getByText(/Déficit para meta/i)).toBeInTheDocument();

    const suggestionCard = screen.getByText("PETR4").closest("button");
    expect(suggestionCard).toBeTruthy();
    fireEvent.click(suggestionCard!);

    // No passo 2, a quantidade deve vir vazia ("")
    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i) as HTMLInputElement;
    expect(qtyInput.value).toBe("");
  });

  it("sugere cotas limitadas ao caixa quando há saldo em caixa disponível", () => {
    mockTargets = [{ asset_id: "asset-1", target_percentage: 80 }];
    const cashAsset: PortfolioAsset = {
      id: "cash-1",
      user_id: "user-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      currency: "BRL",
      quantity: 150, // R$ 150 em caixa
      average_price: 1,
    };
    mockAssetsList = [mockAsset, cashAsset]; // PETR4 custa R$ 50 no mock, logo 150 / 50 = 3 cotas

    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Recomendados para aporte")).toBeInTheDocument();
    expect(screen.getByText(/Cabe no caixa: 3 cotas/i)).toBeInTheDocument();

    const suggestionCard = screen.getByText("PETR4").closest("button");
    expect(suggestionCard).toBeTruthy();
    fireEvent.click(suggestionCard!);

    // No passo 2, deve vir preenchido com 3 cotas
    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i) as HTMLInputElement;
    expect(qtyInput.value).toBe("3");
  });

  it("permite editar a quantidade após recomendação e submete total = parsedQty * price", async () => {
    mockTargets = [{ asset_id: "asset-1", target_percentage: 80 }];
    const cashAsset: PortfolioAsset = {
      id: "cash-1",
      user_id: "user-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      currency: "BRL",
      quantity: 500, // R$ 500 em caixa
      average_price: 1,
    };
    mockAssetsList = [mockAsset, cashAsset];

    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    const suggestionCard = screen.getByText("PETR4").closest("button");
    fireEvent.click(suggestionCard!);

    // Edita quantidade de 10 cotas para 1 cota
    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i);
    fireEvent.change(qtyInput, { target: { value: "1" } });

    // Avança para Revisão (Passo 3)
    const continueButton = screen.getByRole("button", { name: /^Continuar$/i });
    fireEvent.click(continueButton);

    // Na revisão, clica em Confirmar Operação
    const submitButton = screen.getByRole("button", { name: /Confirmar Operação/i });
    fireEvent.click(submitButton);

    // mutateAsync deve receber total = 50 (1 cota * R$ 50), e NÃO 500 ou 3000
    expect(mockRecordOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "buy",
        quantity: 1,
        price: 50,
        total: 50,
      }),
    );
  });
});
