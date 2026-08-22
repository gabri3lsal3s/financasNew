import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioStatementDialog } from "./portfolio-statement-dialog";

vi.mock("@/state", () => ({
  useAllPortfolioTransactions: () => ({
    data: [
      { id: "tx-1", asset_id: "a-1", type: "buy", date: "2026-08-15", quantity: 100, price: 38.5, total: 3850 },
      { id: "tx-2", asset_id: "a-1", type: "dividend", date: "2026-08-18", quantity: 0, price: 0, total: 45 },
    ],
    isLoading: false,
  }),
  usePortfolioAssets: () => ({
    data: [{ id: "a-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" }],
    isLoading: false,
  }),
  useDeletePortfolioTransaction: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("PortfolioStatementDialog — Fase 35", () => {
  it("renderiza os lançamentos consolidados de todos os ativos", () => {
    render(<PortfolioStatementDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Extrato Consolidado da Carteira")).toBeInTheDocument();
    expect(screen.getAllByText("PETR4")).toHaveLength(2);
    expect(screen.getByText("Compra")).toBeInTheDocument();
    expect(screen.getByText("Dividendo")).toBeInTheDocument();
  });
});
