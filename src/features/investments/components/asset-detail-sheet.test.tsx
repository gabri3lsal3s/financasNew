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
  useSetManualPrice: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
}));


const mockRfAsset: PortfolioAsset = {
  id: "asset-rf",
  user_id: "user-1",
  ticker: "CDB-BMG-JAN27",
  asset_class: "Renda Fixa",
  currency: "BRL",
  quantity: 1,
  average_price: 1000.0,
  notes: "CDB Prefixado",
  fixed_income_metadata: {
    rate_type: "pre",
    rate_value: 16.22,
    maturity_date: "2027-01-04",
  },
};

const mockRfAssetZeroRate: PortfolioAsset = {
  id: "asset-rf-zero",
  user_id: "user-1",
  ticker: "CDB-MANUAL",
  asset_class: "Renda Fixa",
  currency: "BRL",
  quantity: 1,
  average_price: 2000.0,
  notes: "CDB Sem Taxa",
  fixed_income_metadata: {
    rate_type: "cdi",
    rate_value: 0,
  },
};

describe("AssetDetailSheet (Fase 41 & F57)", () => {
  it("renderiza os KPIs do ativo, YoC e histórico de lançamentos para Renda Variável", () => {
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

  it("renderiza corretamente para ativo de Renda Fixa com taxa e vencimento formatado pt-BR", () => {
    render(<AssetDetailSheet asset={mockRfAsset} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("CDB-BMG-JAN27")).toBeInTheDocument();
    expect(screen.getByText("16.22% a.a. • Projetado")).toBeInTheDocument();
    expect(screen.getByText("Valor Aplicado")).toBeInTheDocument();
  });

  it("oculta badge de taxa e sinaliza saldo manual quando a taxa for zero", () => {
    render(<AssetDetailSheet asset={mockRfAssetZeroRate} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("CDB-MANUAL")).toBeInTheDocument();
    expect(screen.queryByText(/0% CDI/i)).not.toBeInTheDocument();
    expect(screen.getByText("Saldo cadastrado manual")).toBeInTheDocument();
  });
});
