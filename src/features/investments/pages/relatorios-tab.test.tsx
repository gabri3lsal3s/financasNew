import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { FerramentasTab } from "./relatorios-tab";

// Barrel de componentes da feature — todos com dependências transitivas são mockados aqui.
vi.mock("../components", () => ({
  PortfolioImportDialog: ({ open }: { open: boolean }) =>
    open ? <div>dialog-importar</div> : null,
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
  usePortfolioAssets: () => ({
    data: [
      { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL", quantity: 100, average_price: 30 },
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

describe("FerramentasTab — Ferramentas da Carteira", () => {
  it("renderiza a grade de 4 ferramentas com Importação, Dossiê Executivo, IRPF e Monitor de DARF", () => {
    render(
      <MemoryRouter>
        <FerramentasTab />
      </MemoryRouter>,
    );

    expect(screen.getByText("Importar via Planilha")).toBeInTheDocument();
    expect(screen.getByText("Dossiê Executivo A4")).toBeInTheDocument();
    expect(screen.getByText("Facilitador de IRPF Anual")).toBeInTheDocument();
    expect(screen.getByText("Monitor Mensal de DARF")).toBeInTheDocument();
  });

  it("abre o diálogo de importação de carteira via planilha", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FerramentasTab />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Importar Carteira/i }));
    expect(screen.getByText("dialog-importar")).toBeInTheDocument();
  });

  it("abre o monitor de DARF", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FerramentasTab />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Abrir Monitor DARF/i }));
    expect(screen.getByText("Monitor Mensal de DARF & Isenção de 20k")).toBeInTheDocument();
    expect(screen.getByText("Sem DARF a recolher no período")).toBeInTheDocument();
  });
});
