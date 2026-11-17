import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MovimentacoesTab } from "./movimentacoes-tab";

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  usePermission: () => ({
    canWrite: true,
    canRead: true,
    isHidden: false,
    isReadOnlyMode: false,
    accessLevel: "write",
  }),
  usePortfolioAssets: () => ({ data: [], isLoading: false }),
  useAllPortfolioTransactions: () => ({ data: [], isLoading: false }),
  usePortfolioPosition: () => ({
    monthlySeries: [],
    allMonthlySeries: [],
  }),
}));

vi.mock("../components", () => ({
  PortfolioActivityPanel: () => <div data-testid="portfolio-activity-panel">Extrato de Movimentações</div>,
  PortfolioSnapshotsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="snapshots-dialog">Diálogo de Marcos Históricos</div> : null,
  PortfolioImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog">Diálogo de Importação</div> : null,
  PortfolioDarfMonitor: ({ open }: { open: boolean }) =>
    open ? <div data-testid="darf-monitor-dialog">Diálogo de DARF</div> : null,
}));

describe("MovimentacoesTab — Extrato, Marcos, Importação e DARF", () => {
  it("renderiza o painel de extrato e os três cards operacionais (Marcos Históricos, Importar, DARF)", () => {
    render(<MovimentacoesTab />);

    expect(screen.getByTestId("portfolio-activity-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marcos Históricos/i })).toBeInTheDocument();
    expect(screen.getByText("Posição ou histórico desatualizado?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar Planilha/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Consultar DARF Mensal/i })).toBeInTheDocument();
  });

  it("abre o diálogo de Marcos Históricos ao clicar no botão correspondente", async () => {
    const user = userEvent.setup();
    render(<MovimentacoesTab />);

    await user.click(screen.getByRole("button", { name: /Marcos Históricos/i }));
    expect(screen.getByTestId("snapshots-dialog")).toBeInTheDocument();
  });

  it("abre o diálogo de importação ao clicar no botão Importar Planilha", async () => {
    const user = userEvent.setup();
    render(<MovimentacoesTab />);

    const importBtn = screen.getByRole("button", { name: /Importar Planilha/i });
    await user.click(importBtn);

    expect(screen.getByTestId("import-dialog")).toBeInTheDocument();
  });

  it("abre o diálogo de monitor de DARF ao clicar em Consultar DARF Mensal", async () => {
    const user = userEvent.setup();
    render(<MovimentacoesTab />);

    const darfBtn = screen.getByRole("button", { name: /Consultar DARF Mensal/i });
    await user.click(darfBtn);

    expect(screen.getByTestId("darf-monitor-dialog")).toBeInTheDocument();
  });
});
