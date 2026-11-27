import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioImportDialog } from "./portfolio-import-dialog";

const mockCreateAsset = vi.fn().mockResolvedValue({ id: "new-asset-1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" });
const mockUpdateAsset = vi.fn().mockResolvedValue({ id: "existing-1", ticker: "VALE3", asset_class: "Ações", currency: "BRL" });
const mockCreateBatch = vi.fn().mockResolvedValue([]);
const mockImportAtomic = vi.fn().mockResolvedValue({ success: true });

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
  useImportPortfolioAtomic: () => ({
    mutateAsync: mockImportAtomic,
    isPending: false,
  }),
}));

async function uploadMockPortfolioFile(
  user: ReturnType<typeof userEvent.setup>,
  content: string,
  fileName = "negociacoes.csv",
) {
  const file = new File([content], fileName, { type: "text/csv" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeInTheDocument();
  await user.upload(input, file);
}

describe("PortfolioImportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o modal quando aberto no passo 1 com a dropzone de planilha", () => {
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Importar Carteira de Investimentos")).toBeInTheDocument();
    expect(screen.getByText(/Selecione sua planilha de custódia ou movimentações/i)).toBeInTheDocument();
  });

  it("avança para o passo de Mapeamento de Colunas ao processar planilha CSV com cabeçalhos", async () => {
    const user = userEvent.setup();
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const csv = `Data do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;PETR4;100;38,50;3850,00`;
    await uploadMockPortfolioFile(user, csv);

    await waitFor(() => {
      expect(screen.getByText(/Linhas identificadas/i)).toBeInTheDocument();
      expect(screen.getByText(/Coluna de Código \/ Ticker/i)).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole("button", { name: /Avançar para conferência/i });
    await user.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByText("PETR4")).toBeInTheDocument();
      expect(screen.getByText("Compra")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar importação \(1\)/i })).toBeInTheDocument();
    });
  });

  it("interpreta múltiplas linhas de negociação da B3 avançando pelo mapeamento para conferência", async () => {
    const user = userEvent.setup();
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const multilineCsv = `Data do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;PETR4;100;38,50;3850,00
16/08/2026;Compra;MXRF11;50;10,20;510,00`;
    await uploadMockPortfolioFile(user, multilineCsv);

    await waitFor(() => {
      expect(screen.getByText(/Linhas identificadas/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Avançar para conferência/i }));

    await waitFor(() => {
      expect(screen.getByText("PETR4")).toBeInTheDocument();
      expect(screen.getByText("MXRF11")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar importação \(2\)/i })).toBeInTheDocument();
    });
  });

  it("executa a criação de ativos e batch de transações ao confirmar", async () => {
    const user = userEvent.setup();
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const csv = `Data do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;PETR4;100;38,50;3850,00`;
    await uploadMockPortfolioFile(user, csv);

    await waitFor(() => {
      expect(screen.getByText(/Linhas identificadas/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Avançar para conferência/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar importação \(1\)/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Confirmar importação \(1\)/i }));

    await waitFor(() => {
      expect(mockImportAtomic).toHaveBeenCalledWith(
        expect.objectContaining({
          assetsToCreate: expect.arrayContaining([
            expect.objectContaining({
              ticker: "PETR4",
              quantity: 100,
              average_price: 38.5,
            }),
          ]),
          transactions: expect.arrayContaining([
            expect.objectContaining({
              type: "buy",
              quantity: 100,
              price: 38.5,
            }),
          ]),
        }),
      );
    });
  });

  it("permite editar valores de células diretamente no passo de conferência", async () => {
    const user = userEvent.setup();
    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const csv = `Data do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;PETR4;100;38,50;3850,00`;
    await uploadMockPortfolioFile(user, csv);

    await waitFor(() => {
      expect(screen.getByText(/Linhas identificadas/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Avançar para conferência/i }));

    await waitFor(() => {
      expect(screen.getByText("PETR4")).toBeInTheDocument();
    });

    // Clica no botão de editar (Pencil)
    const editBtn = screen.getByTitle(/Editar valores desta linha/i);
    await user.click(editBtn);

    expect(screen.getByText(/Editando ativo #1/i)).toBeInTheDocument();

    // Altera a quantidade e preço
    const qtyInput = screen.getByLabelText(/Quantidade \/ Cotas/i);
    await user.clear(qtyInput);
    await user.type(qtyInput, "200");

    const priceInput = screen.getByLabelText(/Preço Unitário/i);
    await user.clear(priceInput);
    await user.type(priceInput, "40");

    // Conclui edição
    await user.click(screen.getByRole("button", { name: /Concluir edição/i }));

    expect(screen.getByText(/200 cotas/i)).toBeInTheDocument();
    expect(screen.getByText(/40,00/i)).toBeInTheDocument();
  });

  it("consolida múltiplas compras do mesmo ticker calculando o preço médio ponderado total ao criar o ativo", async () => {
    mockImportAtomic.mockClear();
    const user = userEvent.setup();

    render(<PortfolioImportDialog open={true} onOpenChange={vi.fn()} />);

    const csv = `Data do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
10/08/2026;Compra;BBAS3;100;20,00;2000,00
15/08/2026;Compra;BBAS3;100;30,00;3000,00`;
    await uploadMockPortfolioFile(user, csv);

    await waitFor(() => {
      expect(screen.getByText(/Linhas identificadas/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Avançar para conferência/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar importação \(2\)/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Confirmar importação \(2\)/i }));

    await waitFor(() => {
      expect(mockImportAtomic).toHaveBeenCalledWith(
        expect.objectContaining({
          assetsToCreate: expect.arrayContaining([
            expect.objectContaining({
              ticker: "BBAS3",
              quantity: 200,
              average_price: 25,
            }),
          ]),
          transactions: expect.arrayContaining([
            expect.objectContaining({ type: "buy", quantity: 100, price: 20 }),
            expect.objectContaining({ type: "buy", quantity: 100, price: 30 }),
          ]),
        }),
      );
    });
  });
});
