import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playSound } from "@/services/audio-fx";
import { triggerHaptic } from "@/services/haptics";
import { TransactionListDialog } from "./transaction-list-dialog";

const transactionsMock = vi.fn();
const deleteTxMock = vi.fn();

vi.mock("@/services/haptics", () => ({ triggerHaptic: vi.fn() }));
vi.mock("@/services/audio-fx", () => ({ playSound: vi.fn() }));

vi.mock("@/state", () => ({
  useAssetPosition: (assetId: string | null) => ({
    data: assetId ? transactionsMock() : [],
    isLoading: false,
    error: null,
  }),
  useDeletePortfolioTransaction: () => ({ mutateAsync: deleteTxMock, isPending: false }),
  useCreatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePortfolioTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const asset = {
  id: "a1",
  user_id: "u1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL" as const,
};

const txs = [
  {
    id: "tx1",
    user_id: "u1",
    asset_id: "a1",
    type: "buy" as const,
    date: "2026-03-10",
    quantity: 10,
    price: 42.5,
    total: 425,
  },
  {
    id: "tx2",
    user_id: "u1",
    asset_id: "a1",
    type: "dividend" as const,
    date: "2026-04-05",
    quantity: 0,
    price: 0,
    total: 15,
  },
];

describe("TransactionListDialog — extrato de lançamentos com CRUD", () => {
  beforeEach(() => {
    transactionsMock.mockReset();
    deleteTxMock.mockReset();
    vi.mocked(triggerHaptic).mockClear();
    vi.mocked(playSound).mockClear();
  });

  it("lista os lançamentos do ativo em ordem cronológica decrescente", () => {
    transactionsMock.mockReturnValue(txs);
    render(<TransactionListDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    expect(screen.getByText("Compra")).toBeInTheDocument();
    expect(screen.getByText("Dividendo")).toBeInTheDocument();
    // Mais recente primeiro (04/05 antes de 10/03).
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Dividendo");
  });

  it("mostra estado vazio quando o ativo não tem lançamentos", () => {
    transactionsMock.mockReturnValue([]);
    render(<TransactionListDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    expect(screen.getByText("Sem lançamentos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar transação" })).toBeInTheDocument();
  });

  it("abre o formulário em modo edição ao clicar em editar", async () => {
    transactionsMock.mockReturnValue(txs);
    const user = userEvent.setup();
    render(<TransactionListDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    await user.click(screen.getByRole("button", { name: "Editar Compra" }));

    // O formulário de edição abre preenchido (título do modal em modo edição).
    expect(screen.getByText("Transação · PETR4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("exclui um lançamento com confirmação", async () => {
    transactionsMock.mockReturnValue(txs);
    deleteTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionListDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    await user.click(screen.getByRole("button", { name: "Excluir Compra" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(deleteTxMock).toHaveBeenCalledTimes(1);
    expect(deleteTxMock).toHaveBeenCalledWith("tx1");
    expect(triggerHaptic).toHaveBeenCalledWith("destructive");
  });

  it("falha ao excluir fecha a confirmação (erro via toast do hook)", async () => {
    transactionsMock.mockReturnValue(txs);
    deleteTxMock.mockRejectedValue(new Error("Falha de rede"));
    const user = userEvent.setup();
    render(<TransactionListDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    await user.click(screen.getByRole("button", { name: "Excluir Compra" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    // A confirmação fecha (não fica presa) e a lista permanece com o item.
    await waitFor(() => expect(screen.queryByText("Excluir lançamento?")).not.toBeInTheDocument());
    expect(screen.getByText("Compra")).toBeInTheDocument();
  });

  it("abre o formulário de novo lançamento ao clicar no botão Novo lançamento", async () => {
    transactionsMock.mockReturnValue(txs);
    const user = userEvent.setup();
    render(<TransactionListDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));

    expect(screen.getByText("Transação · PETR4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeInTheDocument();
  });
});
