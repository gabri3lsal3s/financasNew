import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashFormDialog } from "./cash-form-dialog";

const mockCreateAsset = vi.fn();
const mockUpdateAsset = vi.fn();
const mockDeleteAsset = vi.fn();

vi.mock("@/state", () => ({
  useCreatePortfolioAsset: () => ({
    mutateAsync: mockCreateAsset,
    isPending: false,
  }),
  useUpdatePortfolioAsset: () => ({
    mutateAsync: mockUpdateAsset,
    isPending: false,
  }),
  useDeletePortfolioAsset: () => ({
    mutateAsync: mockDeleteAsset,
    isPending: false,
  }),
  usePortfolioAssets: () => ({
    data: [],
    isLoading: false,
  }),
  useCreatePortfolioTransaction: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "tx1" }),
    isPending: false,
  }),
  useCreatePortfolioContribution: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "cb1" }),
    isPending: false,
  }),
}));

describe("CashFormDialog", () => {
  it("renderiza o formulário de cadastro de Caixa sem input de ticker/classe e salva como CAIXA", async () => {
    mockCreateAsset.mockResolvedValue({ id: "c1" });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<CashFormDialog open={true} onOpenChange={onOpenChange} asset={null} />);

    expect(screen.getByText("Cadastrar Saldo em Caixa")).toBeInTheDocument();
    expect(screen.getByText("Ativo Único de Caixa")).toBeInTheDocument();

    // Não há input de ticker/nome editável
    expect(screen.queryByLabelText("Ticker do ativo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Classe do ativo")).not.toBeInTheDocument();

    // Campo de saldo
    const moneyInput = screen.getByLabelText("Saldo disponível em caixa");
    expect(moneyInput).toBeInTheDocument();

    // Digita saldo 1000,00 (100000 centavos)
    await user.clear(moneyInput);
    await user.type(moneyInput, "100000");

    // Submete
    await user.click(screen.getByRole("button", { name: /Cadastrar caixa/i }));

    expect(mockCreateAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "CAIXA",
        asset_class: "Caixa",
        currency: "BRL",
        average_price: 1,
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renderiza o formulário de edição quando o ativo de caixa é informado", async () => {
    mockUpdateAsset.mockResolvedValue({ id: "c1" });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const existingCash = {
      id: "c1",
      user_id: "u1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      quantity: 5000,
      average_price: 1,
      currency: "BRL" as const,
      notes: "Reserva de emergência",
    };

    render(<CashFormDialog open={true} onOpenChange={onOpenChange} asset={existingCash} />);

    expect(screen.getByText("Editar Saldo em Caixa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atualizar saldo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir caixa/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Atualizar saldo/i }));

    expect(mockUpdateAsset).toHaveBeenCalledWith({
      id: "c1",
      patch: expect.objectContaining({
        ticker: "CAIXA",
        asset_class: "Caixa",
      }),
    });
  });
});
