import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioDarfMonitor } from "./portfolio-darf-monitor";
import { OFFICIAL_TAX_DISCLAIMER } from "@/lib/institutional";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

describe("features/investments/components/PortfolioDarfMonitor", () => {
  const mockAssets: PortfolioAsset[] = [
    {
      id: "asset-1",
      user_id: "user-1",
      ticker: "PETR4",
      asset_class: "Ações",
      quantity: 1000,
      average_price: 20,
      currency: "BRL",
      notes: null,
    },
    {
      id: "asset-2",
      user_id: "user-1",
      ticker: "HGLG11",
      asset_class: "FIIs",
      quantity: 100,
      average_price: 150,
      currency: "BRL",
      notes: null,
    },
  ];

  it("renderiza o modal aberto com o disclaimer contábil/fiscal oficial alinhado ao CFC e RFB", () => {
    render(
      <PortfolioDarfMonitor
        open={true}
        onOpenChange={vi.fn()}
        assets={mockAssets}
        transactions={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: /Monitor Mensal de DARF & Isenção de 20k/i })).toBeInTheDocument();
    expect(screen.getByText("Sem DARF a recolher no período")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma operação de venda realizada neste mês.")).toBeInTheDocument();

    // Valida a presença do disclaimer oficial de isenção contábil/fiscal
    expect(screen.getByText(OFFICIAL_TAX_DISCLAIMER)).toBeInTheDocument();
  });

  it("apresenta apuração de DARF a recolher e discriminação de imposto quando há vendas com lucro", () => {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);

    const mockTransactions: PortfolioTransaction[] = [
      {
        id: "tx-fii-sell",
        user_id: "user-1",
        asset_id: "asset-2",
        type: "sell",
        date: `${currentMonthPrefix}-10`,
        quantity: 50,
        price: 170, // lucro de 20 por cota = 1000 de lucro -> 20% DARF = 200
        total: 8500,
      },
    ];

    render(
      <PortfolioDarfMonitor
        open={true}
        onOpenChange={vi.fn()}
        assets={mockAssets}
        transactions={mockTransactions}
      />,
    );

    expect(screen.getByText("DARF a Recolher neste Mês")).toBeInTheDocument();
    expect(screen.getByText("Fundos Imobiliários (FIIs)")).toBeInTheDocument();
    expect(screen.getByText(OFFICIAL_TAX_DISCLAIMER)).toBeInTheDocument();
  });
});
