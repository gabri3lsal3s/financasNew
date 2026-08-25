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
  ContributionsPanel: () => <div data-testid="contributions-panel">Painel de Contribuições</div>,
  PortfolioImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog">Diálogo de Importação</div> : null,
}));

describe("AporteTab — Calculadora e Aportes", () => {
  it("renderiza os controles da calculadora e o bloco de importação contextual", () => {
    render(
      <MemoryRouter>
        <AporteTab />
      </MemoryRouter>,
    );

    expect(screen.getByText("Valor do aporte")).toBeInTheDocument();
    expect(screen.getByText("Usar saldo em caixa (R$ 1000.00)")).toBeInTheDocument();
    expect(screen.getByText("Posição desatualizada?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar Planilha/i })).toBeInTheDocument();
  });

  it("abre o diálogo de importação ao clicar em Importar Planilha", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AporteTab />
      </MemoryRouter>,
    );

    const importBtn = screen.getByRole("button", { name: /Importar Planilha/i });
    await user.click(importBtn);

    expect(screen.getByTestId("import-dialog")).toBeInTheDocument();
  });
});
