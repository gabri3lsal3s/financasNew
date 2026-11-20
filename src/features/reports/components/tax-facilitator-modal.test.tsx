import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaxFacilitatorModal } from "./tax-facilitator-modal";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

const mockAssets: PortfolioAsset[] = [
  {
    id: "asset-1",
    user_id: "user-1",
    ticker: "PETR4",
    asset_class: "acoes",
    quantity: 100,
    average_price: 35.5,
    currency: "BRL",
    created_at: "2024-01-01",
  },
  {
    id: "asset-2",
    user_id: "user-1",
    ticker: "KNRI11",
    asset_class: "fiis",
    quantity: 50,
    average_price: 160.0,
    currency: "BRL",
    created_at: "2024-01-01",
  },
];

const mockDividends: PortfolioDividend[] = [
  {
    id: "div-1",
    asset_id: "asset-1",
    user_id: "user-1",
    amount: 250,
    date: `${new Date().getFullYear() - 1}-05-15`,
    notes: "dividendo",
    created_at: "2024-05-15",
  },
  {
    id: "div-2",
    asset_id: "asset-2",
    user_id: "user-1",
    amount: 400,
    date: `${new Date().getFullYear() - 1}-06-15`,
    notes: "rendimento",
    created_at: "2024-06-15",
  },
];

describe("TaxFacilitatorModal (Fase 11)", () => {
  it("renderiza cabeçalho de IRPF e grupos canônicos da Receita Federal", () => {
    render(
      <TaxFacilitatorModal
        open={true}
        onOpenChange={vi.fn()}
        assets={mockAssets}
        dividends={mockDividends}
        accountHolder="Investidor Exemplo"
      />,
    );

    expect(screen.getAllByText(/Facilitador de Declaração de IRPF/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ficha: Bens e Direitos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PETR4/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/KNRI11/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rendimentos Isentos & Exclusivos/i).length).toBeGreaterThan(0);
  });
});
