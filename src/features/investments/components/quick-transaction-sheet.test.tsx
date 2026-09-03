import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickTransactionSheet } from "./quick-transaction-sheet";
import type { PortfolioAsset } from "@/types";

const mockAsset: PortfolioAsset = {
  id: "asset-1",
  user_id: "user-1",
  ticker: "VALE3",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 60.0,
};

const mockRecordOrder = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [mockAsset],
    isLoading: false,
    error: null,
  }),
  useRecordOrder: () => ({
    mutateAsync: mockRecordOrder,
    isPending: false,
  }),
  usePortfolioPosition: () => ({
    rows: [],
  }),
}));

describe("QuickTransactionSheet (Fase 41)", () => {
  it("renderiza corretamente para o ativo fornecido", () => {
    render(<QuickTransactionSheet open={true} asset={mockAsset} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Movimentar VALE3")).toBeInTheDocument();
    expect(screen.getByText("Compra / Aporte")).toBeInTheDocument();
    expect(screen.getByText("Venda / Resgate")).toBeInTheDocument();
  });

  it("permite alternar para modo de Venda e exibe campo de quantidade a vender", async () => {
    const user = userEvent.setup();
    render(<QuickTransactionSheet open={true} asset={mockAsset} onOpenChange={vi.fn()} />);
    const sellTab = screen.getByRole("tab", { name: /Venda/i });
    await user.click(sellTab);
    expect(screen.getByText("Quantidade a Vender")).toBeInTheDocument();
  });
});
