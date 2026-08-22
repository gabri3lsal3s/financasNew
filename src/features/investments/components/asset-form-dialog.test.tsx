import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerSensory } from "@/services/sensory";
import { AssetFormDialog } from "./asset-form-dialog";

const createAssetMock = vi.fn();
const updateAssetMock = vi.fn();
const deleteAssetMock = vi.fn();

vi.mock("@/services/sensory", () => ({ triggerSensory: vi.fn() }));

vi.mock("@/state", () => ({
  useCreatePortfolioAsset: () => ({ mutateAsync: createAssetMock, isPending: false }),
  useUpdatePortfolioAsset: () => ({ mutateAsync: updateAssetMock, isPending: false }),
  useDeletePortfolioAsset: () => ({ mutateAsync: deleteAssetMock, isPending: false }),
  useCreatePortfolioContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePortfolioAssets: () => ({ data: [], isLoading: false, isError: false, error: null }),
}));

const existingAsset = {
  id: "a1",
  user_id: "u1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL" as const,
  quantity: 100,
  average_price: 30,
};

describe("AssetFormDialog — feedback de escrita (F15 e F36)", () => {
  beforeEach(() => {
    createAssetMock.mockReset();
    updateAssetMock.mockReset();
    deleteAssetMock.mockReset();
    vi.mocked(triggerSensory).mockClear();
  });

  it("dispara haptic success e áudio de confirmação ao adicionar um ativo", async () => {
    createAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Ticker do ativo"), "petr4");
    await user.click(screen.getByRole("button", { name: "Adicionar à carteira" }));

    expect(createAssetMock).toHaveBeenCalledTimes(1);
    // O ticker é normalizado para maiúsculas antes do envio.
    expect(createAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: "PETR4" }),
    );
    expect(triggerSensory).toHaveBeenCalledWith("success");
  });

  it("não dispara feedback sem ticker preenchido", async () => {
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Adicionar à carteira" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Adicionar à carteira" }));

    expect(createAssetMock).not.toHaveBeenCalled();
    expect(triggerSensory).not.toHaveBeenCalled();
  });

  it("modo edição: salva via update com os dados do ativo (CRUD completo)", async () => {
    updateAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} asset={existingAsset} />);

    // O formulário inicia preenchido com os dados do ativo em edição.
    expect(screen.getByLabelText("Ticker do ativo")).toHaveValue("PETR4");
    await user.clear(screen.getByLabelText("Ticker do ativo"));
    await user.type(screen.getByLabelText("Ticker do ativo"), "petr3");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateAssetMock).toHaveBeenCalledTimes(1);
    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "a1",
      patch: expect.objectContaining({ ticker: "PETR3" }),
    });
    expect(createAssetMock).not.toHaveBeenCalled();
  });

  it("modo edição: exclui o ativo com confirmação (cascata de transações/metas)", async () => {
    deleteAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} asset={existingAsset} />);

    await user.click(screen.getByRole("button", { name: "Excluir ativo" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(deleteAssetMock).toHaveBeenCalledTimes(1);
    expect(deleteAssetMock).toHaveBeenCalledWith("a1");
    expect(triggerSensory).toHaveBeenCalledWith("destructive");
  });

  it("permite alternar para a aba de venda e registrar desinvestimento com PM inalterado", async () => {
    updateAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} asset={existingAsset} />);

    // Clica na aba Venda / Desinvestimento
    const sellTab = screen.getByRole("button", { name: /Venda \/ Desinvestimento/i });
    await user.click(sellTab);

    expect(screen.getByText(/Custódia Disponível para Venda/i)).toBeInTheDocument();
    expect(screen.getByText(/100 cotas @ BRL 30.00/i)).toBeInTheDocument();

    // Clica no atalho rápido "50%"
    await user.click(screen.getByRole("button", { name: "50%" }));
    expect(screen.getByLabelText("Quantidade a vender")).toHaveValue("50");

    // Confirma a venda
    await user.click(screen.getByRole("button", { name: /Confirmar Venda \/ Resgate/i }));

    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "a1",
      patch: {
        quantity: 50,
        average_price: 30, // PM mantido inalterado
      },
    });
    expect(triggerSensory).toHaveBeenCalledWith("destructive");
  });

  it("permite cadastrar saldo de Caixa sem nome e salva com ticker 'CAIXA' por padrão", async () => {
    createAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AssetFormDialog open={true} onOpenChange={vi.fn()} />);

    // Clica no preset "Caixa"
    await user.click(screen.getByRole("button", { name: "Caixa" }));

    // Preenche apenas o valor do saldo em quantidade
    await user.type(screen.getByLabelText("Quantidade ou saldo"), "5000");

    // O botão deve estar habilitado mesmo com o campo de nome vazio
    const submitBtn = screen.getByRole("button", { name: "Adicionar à carteira" });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    expect(createAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "CAIXA",
        asset_class: "Caixa",
        quantity: 5000,
        average_price: 1,
      }),
    );
  });
});
