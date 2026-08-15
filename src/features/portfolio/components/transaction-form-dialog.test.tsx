import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playSound } from "@/services/audio-fx";
import { triggerHaptic } from "@/services/haptics";
import { TransactionFormDialog } from "./transaction-form-dialog";

const createTxMock = vi.fn();
const updateTxMock = vi.fn();
const deleteTxMock = vi.fn();

vi.mock("@/services/haptics", () => ({ triggerHaptic: vi.fn() }));
vi.mock("@/services/audio-fx", () => ({ playSound: vi.fn() }));

vi.mock("@/state", () => ({
  useCreatePortfolioTransaction: () => ({ mutateAsync: createTxMock, isPending: false }),
  useUpdatePortfolioTransaction: () => ({ mutateAsync: updateTxMock, isPending: false }),
  useDeletePortfolioTransaction: () => ({ mutateAsync: deleteTxMock, isPending: false }),
}));

const asset = {
  id: "a1",
  user_id: "u1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL" as const,
};

const existingTx = {
  id: "tx1",
  user_id: "u1",
  asset_id: "a1",
  type: "buy" as const,
  date: "2026-03-10",
  quantity: 10,
  price: 42.5,
  total: 425,
};

describe("TransactionFormDialog — feedback de escrita (F15)", () => {
  beforeEach(() => {
    createTxMock.mockReset();
    updateTxMock.mockReset();
    deleteTxMock.mockReset();
    vi.mocked(triggerHaptic).mockClear();
    vi.mocked(playSound).mockClear();
  });

  it("dispara haptic success e áudio de confirmação ao registrar uma compra", async () => {
    createTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    await user.type(screen.getByLabelText("Quantidade"), "10");
    await user.type(screen.getByLabelText("Preço unitário"), "42,50");
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    expect(createTxMock).toHaveBeenCalledTimes(1);
    expect(triggerHaptic).toHaveBeenCalledWith("success");
    expect(playSound).toHaveBeenCalledWith("success", expect.any(Boolean));
  });

  it("não dispara feedback quando o formulário está inválido", () => {
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    // Quantidade e preço zerados → botão desabilitado.
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();
  });

  it("modo edição: salva via update com os dados da transação (CRUD completo)", async () => {
    updateTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} transaction={existingTx} />);

    // O formulário inicia preenchido com os dados da transação em edição.
    expect(screen.getByLabelText("Quantidade")).toHaveValue(10);
    await user.clear(screen.getByLabelText("Quantidade"));
    await user.type(screen.getByLabelText("Quantidade"), "15");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(updateTxMock).toHaveBeenCalledTimes(1);
    expect(updateTxMock).toHaveBeenCalledWith({
      id: "tx1",
      patch: expect.objectContaining({ quantity: 15, asset_id: "a1" }),
    });
    expect(createTxMock).not.toHaveBeenCalled();
  });

  it("modo edição: exclui o lançamento com confirmação", async () => {
    deleteTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} transaction={existingTx} />);

    await user.click(screen.getByRole("button", { name: "Excluir lançamento" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(deleteTxMock).toHaveBeenCalledTimes(1);
    expect(deleteTxMock).toHaveBeenCalledWith("tx1");
  });
});
