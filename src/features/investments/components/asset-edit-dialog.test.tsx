import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AssetEditDialog } from "./asset-edit-dialog";
import type { PortfolioAsset } from "@/types";

const mockUpdateAsset = vi.fn();
const mockSetManualPrice = vi.fn();

vi.mock("@/state", () => ({
  useUpdatePortfolioAsset: () => ({
    mutateAsync: mockUpdateAsset,
    isPending: false,
  }),
  useSetManualPrice: () => ({
    mutateAsync: mockSetManualPrice,
    isPending: false,
  }),
  useAssetPrices: () => ({
    data: [
      {
        ticker: "CDB BANCO INTER",
        price: 10500,
        manual_price: 10500,
      },
    ],
  }),
}));

const mockFixedIncomeAsset: PortfolioAsset = {
  id: "asset-rf-1",
  user_id: "user-1",
  ticker: "CDB BANCO INTER",
  asset_class: "Renda Fixa",
  currency: "BRL",
  quantity: 1,
  average_price: 10000,
  fixed_income_metadata: {
    rate_type: "cdi",
    rate_value: 110,
    base_date: "2026-01-01",
    initial_investment_date: "2026-01-01",
    maturity_date: "2028-01-01",
    is_tax_exempt: false,
  },
  notes: null,
};

const mockStockAsset: PortfolioAsset = {
  id: "asset-stock-1",
  user_id: "user-1",
  ticker: "WEGE3",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 45.5,
  notes: "Tese de longo prazo",
};

const mockCashAsset: PortfolioAsset = {
  id: "asset-cash-1",
  user_id: "user-1",
  ticker: "CAIXA",
  asset_class: "Caixa",
  currency: "BRL",
  quantity: 5000,
  average_price: 1,
  notes: null,
};

describe("AssetEditDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza campos de posição inicial e saldo para ativo de Renda Fixa", async () => {
    mockUpdateAsset.mockResolvedValue({ ...mockFixedIncomeAsset });
    mockSetManualPrice.mockResolvedValue({});
    const onOpenChange = vi.fn();

    render(
      <AssetEditDialog
        asset={mockFixedIncomeAsset}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Editar Ativo")).toBeInTheDocument();
    expect(screen.getByText("Posição de Custódia (Renda Fixa)")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço inicial investido")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço atual ou saldo")).toBeInTheDocument();
    expect(screen.getByText("Parâmetros de Renda Fixa")).toBeInTheDocument();

    // Submete o formulário
    fireEvent.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(mockUpdateAsset).toHaveBeenCalledWith({
        id: "asset-rf-1",
        patch: expect.objectContaining({
          ticker: "CDB BANCO INTER",
          asset_class: "Renda Fixa",
          quantity: 1,
          average_price: 10000,
          fixed_income_metadata: expect.objectContaining({
            rate_type: "cdi",
            rate_value: 110,
          }),
        }),
      });
    });

    expect(mockSetManualPrice).toHaveBeenCalledWith({
      ticker: "CDB BANCO INTER",
      price: 10500,
    });
  });

  it("renderiza campos de quantidade e preço médio para Ações", async () => {
    mockUpdateAsset.mockResolvedValue({ ...mockStockAsset });
    const onOpenChange = vi.fn();

    render(
      <AssetEditDialog
        asset={mockStockAsset}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Posição Atual de Custódia")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade de cotas")).toHaveValue("100");
    expect(screen.getByLabelText("Preço médio por cota")).toBeInTheDocument();

    // Altera a quantidade
    fireEvent.change(screen.getByLabelText("Quantidade de cotas"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(mockUpdateAsset).toHaveBeenCalledWith({
        id: "asset-stock-1",
        patch: expect.objectContaining({
          ticker: "WEGE3",
          asset_class: "Ações",
          quantity: 150,
          average_price: 45.5,
        }),
      });
    });
  });

  it("renderiza campos de saldo para ativo de Caixa", async () => {
    mockUpdateAsset.mockResolvedValue({ ...mockCashAsset });
    const onOpenChange = vi.fn();

    render(
      <AssetEditDialog
        asset={mockCashAsset}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Saldo Disponível em Caixa")).toBeInTheDocument();
    expect(screen.getByLabelText("Saldo em caixa")).toHaveValue("5000");

    fireEvent.change(screen.getByLabelText("Saldo em caixa"), { target: { value: "7500" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(mockUpdateAsset).toHaveBeenCalledWith({
        id: "asset-cash-1",
        patch: expect.objectContaining({
          ticker: "CAIXA",
          quantity: 7500,
          average_price: 1,
        }),
      });
    });
  });
});
