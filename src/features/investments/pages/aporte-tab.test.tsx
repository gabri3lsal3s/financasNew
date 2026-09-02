import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AporteTab } from "./aporte-tab";

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({
    rows: [
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        valueBRL: 5000,
        priceBRL: 40,
        isCash: false,
      },
    ],
    cashBRL: 1000,
    totalBRL: 6000,
    isLoading: false,
    error: null,
  }),
  useAllocationTargets: () => ({
    data: [{ id: "t1", asset_id: "a1", target_percentage: 100 }],
    isLoading: false,
    error: null,
  }),
  useGroupTargets: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useExecutePortfolioBatchAporte: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  usePortfolioContributions: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreatePortfolioContribution: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeletePortfolioContribution: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../components", () => ({
  PortfolioActivityPanel: () => <div data-testid="portfolio-activity-panel">Extrato de Movimentações</div>,
  PortfolioImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog">Diálogo de Importação</div> : null,
}));

describe("AporteTab — Calculadora e Aportes", () => {
  it("renderiza a calculadora e os campos de simulação corretamente", () => {
    render(
      <MemoryRouter>
        <AporteTab />
      </MemoryRouter>,
    );

    expect(screen.getByText("Valor do aporte")).toBeInTheDocument();
    expect(screen.getByText(/Motor Hierárquico:/i)).toBeInTheDocument();
  });

  it("renderiza o extrato de movimentações com o bloco de importação contextual", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AporteTab />
      </MemoryRouter>,
    );

    const historicoTab = screen.getByRole("tab", { name: "Extrato de Movimentações" });
    await user.click(historicoTab);

    expect(screen.getByTestId("portfolio-activity-panel")).toBeInTheDocument();
    expect(screen.getByText("Posição ou histórico desatualizado?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar Planilha/i })).toBeInTheDocument();

    const importBtn = screen.getByRole("button", { name: /Importar Planilha/i });
    await user.click(importBtn);

    expect(screen.getByTestId("import-dialog")).toBeInTheDocument();
  });
});
