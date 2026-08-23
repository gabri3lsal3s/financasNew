import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FerrantasTab } from "./relatorios-tab";

// Barrel de componentes da feature — todos com dependências transitivas são mockados aqui.
vi.mock("../components", () => ({
  PortfolioImportDialog: ({ open }: { open: boolean }) =>
    open ? <div>dialog-importar</div> : null,
  PortfolioExecutiveReport: ({ open }: { open: boolean }) =>
    open ? <div>Relatório Executivo</div> : null,
  PortfolioTaxReport: ({ open }: { open: boolean }) =>
    open
      ? (
        <div>
          <div>Facilitador de IRPF / Declaração Anual</div>
          <div>100 cotas/ações de PETR4</div>
        </div>
      )
      : null,
  PortfolioDarfMonitor: ({ open }: { open: boolean }) =>
    open
      ? (
        <div>
          <div>Monitor Mensal de DARF &amp; Isenção de 20k</div>
          <div>Sem DARF a recolher no período</div>
        </div>
      )
      : null,
}));

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({
    rows: [
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 30,
        priceBRL: 35,
        valueBRL: 3500,
        pct: 70,
        unrealizedPnl: 500,
        unrealizedPct: 16.67,
        isCash: false,
      },
    ],
    totalBRL: 5000,
    cashBRL: 1500,
    isLoading: false,
    error: null,
  }),
  usePortfolioAssets: () => ({
    data: [
      { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL", quantity: 100, average_price: 30 },
    ],
    isLoading: false,
    error: null,
  }),
  usePortfolioDividends: () => ({
    data: [
      { id: "d1", user_id: "u1", asset_id: "a1", date: "2026-08-15", amount: 200, notes: "DIVIDENDO" },
    ],
    isLoading: false,
    error: null,
  }),
  useAllPortfolioTransactions: () => ({
    data: [
      { id: "t1", user_id: "u1", asset_id: "a1", type: "sell", date: "2026-08-10", quantity: 20, unit_price: 35, total: 700 },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe("FerrantasTab — Ferramentas de Investimentos", () => {
  it("renderiza a grade de 4 ferramentas com Relatório Executivo, IRPF e Monitor de DARF", () => {
    render(<FerrantasTab />);

    expect(screen.getByText("Importar via Planilha")).toBeInTheDocument();
    expect(screen.getByText("Relatório Executivo (A4/PDF)")).toBeInTheDocument();
    expect(screen.getByText("Facilitador de IRPF Anual")).toBeInTheDocument();
    expect(screen.getByText("Monitor Mensal de DARF")).toBeInTheDocument();
  });

  it("abre o facilitador de IRPF e exibe a discriminação do ativo", async () => {
    const user = userEvent.setup();
    render(<FerrantasTab />);

    await user.click(screen.getByRole("button", { name: "Abrir Fichas do IRPF" }));

    expect(screen.getByText("Facilitador de IRPF / Declaração Anual")).toBeInTheDocument();
    expect(screen.getByText(/100 cotas\/ações de PETR4/i)).toBeInTheDocument();
  });

  it("abre o monitor de DARF com status de isenção de 20k", async () => {
    const user = userEvent.setup();
    render(<FerrantasTab />);

    await user.click(screen.getByRole("button", { name: "Consultar Apuração Mensal" }));

    expect(screen.getByText("Monitor Mensal de DARF & Isenção de 20k")).toBeInTheDocument();
    expect(screen.getByText("Sem DARF a recolher no período")).toBeInTheDocument();
  });
});

