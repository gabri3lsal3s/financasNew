import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetDetailSheet } from "./asset-detail-sheet";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

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

const mockTransaction: PortfolioTransaction = {
  id: "tx-1",
  user_id: "user-1",
  asset_id: "asset-1",
  type: "buy",
  date: "2026-08-20",
  quantity: 100,
  price: 30.0,
  total: 3000.0,
};

vi.mock("@/state", () => ({
  useAssetPosition: () => ({
    data: [mockTransaction],
    isLoading: false,
    ledger: {
      quantity: 100,
      averageCost: 30.0,
      totalCost: 3000.0,
      dividends: 150.0,
      cash: 0,
    },
  }),
  usePortfolioAssets: () => ({
    data: [mockAsset],
    isLoading: false,
  }),
  usePortfolioPosition: () => ({
    rows: [
      {
        assetId: "asset-1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 30.0,
        totalCostBRL: 3000.0,
        priceBRL: 35.0,
        valueBRL: 3500.0,
        unrealizedPnl: 500.0,
        unrealizedPct: 16.67,
        dividends: 150.0,
        isCash: false,
        source: "api" as const,
        pct: 100,
      },
    ],
    totalBRL: 3500,
    totalCostBRL: 3000,
    isLoading: false,
  }),
  useAssetPrices: () => ({
    data: [{ ticker: "PETR4", price: 35.0, price_cents: 3500 }],
    isLoading: false,
  }),
  useDeletePortfolioAsset: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
  useDeletePortfolioTransaction: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: vi.fn().mockResolvedValue(mockAsset),
    isPending: false,
  }),
}));


describe("AssetDetailSheet (Fase 41)", () => {
  it("renderiza os KPIs do ativo, YoC e histórico de lançamentos", () => {
    render(<AssetDetailSheet asset={mockAsset} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getAllByText("PETR4").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/100 cota/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Yield on Cost/i)).toBeInTheDocument();
    expect(screen.getByText(/Histórico de Operações/i)).toBeInTheDocument();
  });

  it("dispara callback ao clicar no botão de Aporte", () => {
    const onAction = vi.fn();
    render(<AssetDetailSheet asset={mockAsset} open={true} onOpenChange={vi.fn()} onAction={onAction} />);
    const aporteBtn = screen.getByRole("button", { name: /Aportar/i });
    fireEvent.click(aporteBtn);
    expect(onAction).toHaveBeenCalledWith("buy", mockAsset);
  });
});
