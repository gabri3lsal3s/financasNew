import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioImportDialog } from "./portfolio-import-dialog";

const mockCreateAsset = vi.fn().mockResolvedValue({ id: "new-asset-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" });
const mockUpdateAsset = vi.fn().mockResolvedValue({ id: "existing-1", ticker: "VALE3", asset_class: "Ações", currency: "BRL" });
const mockCreateBatch = vi.fn().mockResolvedValue([]);

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [{ id: "existing-1", ticker: "VALE3", asset_class: "Ações", currency: "BRL", quantity: 0, average_price: 0 }],
    isLoading: false,
  }),
  useCreatePortfolioAsset: () => ({
    mutateAsync: mockCreateAsset,
    isPending: false,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: mockUpdateAsset,
    isPending: false,
  }),
  useCreatePortfolioTransactionsBatch: () => ({
    mutateAsync: mockCreateBatch,
    isPending: false,
  }),
}));

describe("PortfolioImportDialog — Fase 35 & 36", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o modal quando aberto no passo 1", () => {
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Importar Carteira de Investimentos")).toBeInTheDocument();
    expect(screen.getByText(/Linguagem Natural \/ Texto/i)).toBeInTheDocument();
    expect(screen.getByText(/Planilha \(Excel \/ CSV\)/i)).toBeInTheDocument();
  });

  it("avança para conferência ao interpretar texto colado válido", async () => {
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "15/08 comprei 100 PETR4 a 38,50" } });

    const processBtn = screen.getByRole("button", { name: /Processar texto/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText("PETR4")).toBeInTheDocument();
      expect(screen.getByText("Compra")).toBeInTheDocument();
      expect(screen.getByText("Novo ativo")).toBeInTheDocument();
    });
  });

  it("avança para o passo de Mapeamento de Colunas ao processar planilha CSV com cabeçalhos", async () => {
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    const csv = `Data do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;PETR4;100;38,50;3850,00`;
    fireEvent.change(textarea, { target: { value: csv } });

    const processBtn = screen.getByRole("button", { name: /Processar texto/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText(/Linhas identificadas/i)).toBeInTheDocument();
      expect(screen.getByText(/Coluna de Código \/ Ticker/i)).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole("button", { name: /Avançar para conferência/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByText("PETR4")).toBeInTheDocument();
      expect(screen.getByText("Compra")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar importação \(1\)/i })).toBeInTheDocument();
    });
  });

  it("executa a criação de ativos e batch de transações ao confirmar", async () => {
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "15/08 comprei 100 PETR4 a 38,50" } });

    fireEvent.click(screen.getByRole("button", { name: /Processar texto/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar importação \(1\)/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar importação \(1\)/i }));

    await waitFor(() => {
      expect(mockCreateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: "PETR4",
          quantity: 100,
          average_price: 38.5,
        }),
      );
      expect(mockCreateBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: "buy",
            quantity: 100,
            price: 38.5,
          }),
        ]),
      );
    });
  });

  it("permite editar valores de células diretamente no passo de conferência", async () => {
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "15/08 comprei 100 PETR4 a 38,50" } });

    fireEvent.click(screen.getByRole("button", { name: /Processar texto/i }));

    await waitFor(() => {
      expect(screen.getByText("PETR4")).toBeInTheDocument();
    });

    // Clica no botão de editar (Pencil)
    const editBtn = screen.getByTitle(/Editar valores desta linha/i);
    fireEvent.click(editBtn);

    expect(screen.getByText(/Editando ativo #1/i)).toBeInTheDocument();

    // Altera a quantidade e preço
    const inputs = screen.getAllByRole("spinbutton");
    if (inputs[0]) fireEvent.change(inputs[0], { target: { value: "200" } });
    if (inputs[1]) fireEvent.change(inputs[1], { target: { value: "40" } });

    // Conclui edição
    fireEvent.click(screen.getByRole("button", { name: /Concluir edição/i }));

    expect(screen.getByText(/200 cotas/i)).toBeInTheDocument();
    expect(screen.getByText(/@ R\$40.00/i)).toBeInTheDocument();
  });
});
