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
}));

vi.mock("../components", () => ({
  PortfolioActivityPanel: () => <div data-testid="portfolio-activity-panel">Extrato de Movimentações</div>,
  PortfolioImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog">Diálogo de Importação</div> : null,
  PortfolioDarfMonitor: ({ open }: { open: boolean }) =>
    open ? <div data-testid="darf-monitor-dialog">Diálogo de DARF</div> : null,
}));

describe("MovimentacoesTab — Histórico e Importação", () => {
  it("renderiza o painel de movimentações e o card de importação de planilha", () => {
    render(<MovimentacoesTab />);

    expect(screen.getByTestId("portfolio-activity-panel")).toBeInTheDocument();
    expect(screen.getByText("Posição ou histórico desatualizado?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar Planilha/i })).toBeInTheDocument();
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
