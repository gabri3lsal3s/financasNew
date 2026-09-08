import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AporteTab } from "./aporte-tab";

vi.mock("./targets-tab", () => ({
  TargetsTab: () => <div data-testid="targets-tab">Painel de Metas de Alocação</div>,
}));

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

  it("inicia por padrão com valor zerado (R$ 0,00) e permite navegar livremente entre as abas", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/investimentos?tab=aporte"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    // Calculadora zerada por padrão
    const input = screen.getByRole("textbox", { name: /Valor do aporte/i });
    expect(input).toHaveValue("R$ 0,00");
    expect(screen.queryByText(/Aporte sugerido/i)).not.toBeInTheDocument();

    // Navega livremente para Metas de Alocação
    const metasTab = screen.getByRole("tab", { name: "Metas de Alocação" });
    await user.click(metasTab);
    expect(screen.getByTestId("targets-tab")).toBeInTheDocument();

    // Navega livremente para Extrato de Movimentações
    const historicoTab = screen.getByRole("tab", { name: "Extrato de Movimentações" });
    await user.click(historicoTab);
    expect(screen.getByTestId("portfolio-activity-panel")).toBeInTheDocument();

    // Retorna para a Calculadora
    const calcTab = screen.getByRole("tab", { name: "Calculadora" });
    await user.click(calcTab);
    expect(screen.getByText("Valor do aporte")).toBeInTheDocument();
  });

  it("preenche automaticamente o valor e carrega sugestões quando a URL contém o parâmetro de valor", async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={["/investimentos?tab=aporte&valor=100000"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    // Esgota todos os timers (delay de 600ms + ticks de rAF da animação no JSDOM)
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const input = screen.getByRole("textbox", { name: /Valor do aporte/i });
    // MoneyInput pode usar espaço não-quebrável (\u00A0) — usa regex para flexibilidade
    await waitFor(() => expect(input.value).toMatch(/1[\.,]000,00/));
    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Aporte sugerido/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Lançar compras no extrato/i })).toBeInTheDocument();
  });
});
