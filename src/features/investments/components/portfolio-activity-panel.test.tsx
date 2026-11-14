import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioActivityPanel } from "./portfolio-activity-panel";

const mockDeleteTransaction = vi.fn().mockResolvedValue(undefined);
const mockDeleteContribution = vi.fn().mockResolvedValue(undefined);
const mockDeleteDividend = vi.fn().mockResolvedValue(undefined);
const mockUpdateAsset = vi.fn().mockResolvedValue(undefined);
const mockDownloadCsv = vi.fn();

vi.mock("@/services/export-actions", () => ({
  downloadCsv: (...args: unknown[]) => mockDownloadCsv(...args),
  shareText: vi.fn(),
}));


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
  useAllPortfolioTransactions: () => ({
    data: [
      { id: "tx-1", user_id: "u-1", asset_id: "a-1", type: "buy", date: "2026-08-05", quantity: 10, price: 38.5, total: 385, notes: "Compra PETR4" },
      { id: "tx-2", user_id: "u-1", asset_id: "a-2", type: "sell", date: "2026-08-12", quantity: 1, price: 1400, total: 1400, notes: "Resgate CDB-FACTA" },
      { id: "tx-3", user_id: "u-1", asset_id: "a-1", type: "buy", date: "2026-08-02", quantity: 100, price: 30, total: 3000 },
      { id: "tx-div", user_id: "u-1", asset_id: "a-1", type: "dividend", date: "2026-08-25", quantity: 0, price: 0, total: 12.5, notes: "Dividendo PETR4 via ledger" },
      { id: "tx-cash", user_id: "u-1", asset_id: "a-cash", type: "buy", date: "2026-08-10", quantity: 500, price: 1, total: 500, notes: "Pseudo-compra de Caixa" },
    ],
    isLoading: false,
  }),
  usePortfolioContributions: () => ({
    data: [
      { id: "c-1", user_id: "u-1", asset_id: null, date: "2026-08-01", amount: 500, notes: "Injeção de capital" },
      { id: "c-2", user_id: "u-1", asset_id: "a-1", date: "2026-08-02", amount: 3000, notes: "Aporte inicial · Compra de PETR4" },
      { id: "c-3", user_id: "u-1", asset_id: "a-cash", date: "2026-08-03", amount: 250, notes: "Aporte em Caixa · Depósito" },
    ],
    isLoading: false,
  }),
  usePortfolioDividends: () => ({
    data: [
      { id: "d-1", user_id: "u-1", asset_id: "a-1", date: "2026-08-20", amount: 50.25, notes: "Dividendo PETR4", sync_cash: true, cash_amount: 50.25 },
    ],
    isLoading: false,
  }),
  usePortfolioAssets: () => ({
    data: [
      { id: "a-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" },
      { id: "a-2", ticker: "CDB-FACTA", asset_class: "Renda Fixa", currency: "BRL" },
      { id: "a-cash", ticker: "CAIXA", asset_class: "Caixa", currency: "BRL", quantity: 2000 },
    ],
    isLoading: false,
  }),
  useDeletePortfolioTransaction: () => ({
    mutateAsync: mockDeleteTransaction,
    isPending: false,
  }),
  useDeletePortfolioContribution: () => ({
    mutateAsync: mockDeleteContribution,
    isPending: false,
  }),
  useDeletePortfolioDividend: () => ({
    mutateAsync: mockDeleteDividend,
    isPending: false,
  }),
  useCreatePortfolioContribution: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdatePortfolioContribution: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: mockUpdateAsset,
    isPending: false,
  }),
  usePortfolioPosition: () => ({
    rows: [],
  }),
}));

describe("PortfolioActivityPanel", () => {
  it("renderiza o extrato completo com compras, vendas/resgates, aportes e proventos", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    expect(screen.getByText("Compras de Ativos")).toBeInTheDocument();
    expect(screen.getByText("Vendas / Resgates")).toBeInTheDocument();
    expect(screen.getAllByText(/Proventos/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Aportes do Bolso")).toBeInTheDocument();

    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CDB-FACTA")).toBeInTheDocument();
    expect(screen.getByText("Aporte Financeiro")).toBeInTheDocument();
  });

  it("filtra movimentações pelos botões de tipo", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    const sellFilterBtn = screen.getByRole("radio", { name: /Vendas/i });
    fireEvent.click(sellFilterBtn);

    expect(screen.getByText("CDB-FACTA")).toBeInTheDocument();
    expect(screen.queryByText("PETR4")).not.toBeInTheDocument();

    const buyFilterBtn = screen.getByRole("radio", { name: /^Compras/i });
    fireEvent.click(buyFilterBtn);

    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("CDB-FACTA")).not.toBeInTheDocument();
    expect(screen.queryByText("Aporte Financeiro")).not.toBeInTheDocument();

    const contribFilterBtn = screen.getByRole("radio", { name: /^Aportes/i });
    fireEvent.click(contribFilterBtn);

    expect(screen.getByText("Aporte Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Aporte em Caixa")).toBeInTheDocument();
    expect(screen.queryByText("CDB-FACTA")).not.toBeInTheDocument();

    const dividendFilterBtn = screen.getByRole("radio", { name: /Proventos/i });
    fireEvent.click(dividendFilterBtn);

    expect(screen.getAllByText("Provento").length).toBeGreaterThan(0);
    expect(screen.getByText(/Dividendo PETR4 via ledger/i)).toBeInTheDocument();
    expect(screen.queryByText("CDB-FACTA")).not.toBeInTheDocument();
  });

  it("abre diálogo de confirmação ao clicar no botão de exclusão", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    const deleteButtons = screen.getAllByRole("button", { name: /Excluir movimentação/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    const firstButton = deleteButtons[0];
    if (!firstButton) throw new Error("Botão de exclusão não encontrado");
    fireEvent.click(firstButton);

    expect(screen.getByText("Excluir movimentação?")).toBeInTheDocument();
  });

  it("exibe o badge 'Aporte Inicial' e notas explicativas para compras com aporte inicial vinculado", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    expect(screen.getByText("Aporte Inicial")).toBeInTheDocument();
    expect(screen.getByText(/Aporte inicial · Compra de PETR4/i)).toBeInTheDocument();
  });

  it("exporta movimentações da carteira em CSV respeitando os filtros", () => {
    mockDownloadCsv.mockClear();
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    const exportBtn = screen.getByRole("button", { name: "Exportar CSV" });
    fireEvent.click(exportBtn);

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, content] = mockDownloadCsv.mock.calls[0] as [string, string];
    expect(filename).toBe("movimentacoes_carteira_2026-08_todas.csv");
    expect(content).toContain("Data;Tipo;Ticker / Ativo;Classe;Quantidade;Preço unitário (R$);Valor total (R$);Observações");
    expect(content).toContain("PETR4");
    expect(content).toContain("CDB-FACTA");
    expect(content).not.toContain("Pseudo-compra de Caixa");
  });

  it("não renderiza nem computa transações do ativo CAIXA na timeline", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    // Não deve listar a transação espúria de CAIXA
    expect(screen.queryByText("Pseudo-compra de Caixa")).not.toBeInTheDocument();
  });

  it("renderiza contribuições para Caixa com badge 'Aporte em Caixa' em vez de 'Compra'", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    // Contribuição para CAIXA exibe o badge Aporte em Caixa
    expect(screen.getByText("Aporte em Caixa")).toBeInTheDocument();
    expect(screen.getByText(/Aporte em Caixa · Depósito/i)).toBeInTheDocument();

    // Injeção de capital com asset_id null exibe Aporte Financeiro com badge Aporte
    expect(screen.getByText("Aporte Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Aporte")).toBeInTheDocument();
  });

  it("renderiza selo 'Creditado no Caixa' para proventos que aumentaram o saldo de liquidez", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    expect(screen.getByText("Creditado no Caixa")).toBeInTheDocument();
  });

  it("ao excluir provento vinculado ao Caixa, oferece estorno e chama deleteDividend com rollbackCash", async () => {
    mockDeleteDividend.mockClear();
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    // Filtra por proventos para isolar o botão de exclusão
    const provFilterBtn = screen.getByRole("radio", { name: /^Proventos/i });
    fireEvent.click(provFilterBtn);

    // Clica no botão de lixeira do provento PETR4 d-1 (que possui sync_cash: true)
    const deleteButtons = screen.getAllByRole("button", { name: /Excluir movimentação de PETR4/i });
    expect(deleteButtons[1]).toBeDefined();
    fireEvent.click(deleteButtons[1]!);

    // O modal deve ser exibido com a opção de estorno do Caixa
    expect(screen.getByText("Estornar valor do Caixa")).toBeInTheDocument();

    // Confirma a exclusão
    const confirmButton = screen.getByRole("button", { name: "Excluir movimentação" });
    fireEvent.click(confirmButton);

    expect(mockDeleteDividend).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "d-1",
        rollbackCash: true,
      }),
    );
  });

  it("ao excluir venda com estorno de Caixa ativado, estorna subtraindo o crédito do Caixa", async () => {
    mockDeleteTransaction.mockClear();
    mockUpdateAsset.mockClear();
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    // Filtra por Vendas
    const sellFilterBtn = screen.getByRole("radio", { name: /Vendas/i });
    fireEvent.click(sellFilterBtn);

    // Clica no botão de exclusão de CDB-FACTA
    const deleteButton = screen.getByRole("button", { name: /Excluir movimentação de CDB-FACTA/i });
    fireEvent.click(deleteButton);

    // Modal deve exibir opção de estorno do Caixa
    expect(screen.getByText("Estornar valor creditado no Caixa")).toBeInTheDocument();
    expect(screen.getByText(/Abaterá R\$ 1400.00 do saldo atual de Caixa/i)).toBeInTheDocument();

    // Confirma exclusão
    const confirmButton = screen.getByRole("button", { name: "Excluir movimentação" });
    fireEvent.click(confirmButton);

    expect(mockDeleteTransaction).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockUpdateAsset).toHaveBeenCalledWith({
        id: "a-cash",
        patch: {
          quantity: 600, // 2000 - 1400
          average_price: 1,
        },
      });
    });
  });

  it("renderiza botão de edição para aporte financeiro e abre ContributionFormDialog", () => {
    render(<PortfolioActivityPanel defaultMonth="2026-08" />);

    // Filtra por aportes
    const contribFilterBtn = screen.getByRole("radio", { name: /^Aportes/i });
    fireEvent.click(contribFilterBtn);

    const editContribButtons = screen.getAllByRole("button", { name: /Editar aporte/i });
    expect(editContribButtons.length).toBeGreaterThan(0);
    fireEvent.click(editContribButtons[0]!);

    expect(screen.getByText("Editar Aporte Financeiro")).toBeInTheDocument();
  });
});

