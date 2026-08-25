import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalibrateFixedIncomeDialog } from "./calibrate-fixed-income-dialog";
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
}));

const mockAsset: PortfolioAsset = {
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

describe("CalibrateFixedIncomeDialog", () => {
  it("renderiza o formulário e executa calibração de Marco Zero", async () => {
    mockUpdateAsset.mockResolvedValue({ ...mockAsset });
    mockSetManualPrice.mockResolvedValue({});
    const onOpenChange = vi.fn();

    render(
      <CalibrateFixedIncomeDialog
        asset={mockAsset}
        open={true}
        onOpenChange={onOpenChange}
        currentEstimatedValueCents={1050000}
      />,
    );

    expect(screen.getByText("Calibrar com Extrato")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Calibração/i }));

    await waitFor(() => {
      expect(mockUpdateAsset).toHaveBeenCalledWith({
        id: "asset-rf-1",
        patch: expect.objectContaining({
          average_price: 10500,
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
});
