import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InternalTransferDialog } from "./internal-transfer-dialog";

const mutateAsyncMock = vi.fn().mockResolvedValue({
  transfer_pair_id: "pair-1",
  expense_id: "exp-1",
  income_id: "inc-1",
  transfer_kind: "card_reimbursement",
  amount: 450,
});

vi.mock("@/hooks/use-mutation-guard", () => ({
  useMutationGuard: () => ({
    guardAction: (fn: () => void) => fn(),
    upgradeModal: null,
    isReadOnlyMode: false,
  }),
}));

vi.mock("@/state", () => ({
  useCreateInternalTransferPair: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe("InternalTransferDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe fluxo de PJ para PF por padrão em Pró-labore", () => {
    render(
      <InternalTransferDialog
        open
        onOpenChange={vi.fn()}
        defaultKind="pro_labore"
        defaultAmountCents={250000}
      />,
    );

    expect(screen.getByText(/Saída: Caixa Meu Negócio \(PJ\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Entrada: Caixa Pessoal \(PF\)/i)).toBeInTheDocument();
  });

  it("inverte direção visual quando defaultKind é capital_injection (PF para PJ)", () => {
    render(
      <InternalTransferDialog
        open
        onOpenChange={vi.fn()}
        defaultKind="capital_injection"
        defaultAmountCents={100000}
      />,
    );

    expect(screen.getByText(/Saída: Caixa Pessoal \(PF\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Entrada: Caixa Meu Negócio \(PJ\)/i)).toBeInTheDocument();
  });

  it("envia transferência pareada via RPC ao confirmar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <InternalTransferDialog
        open
        onOpenChange={onOpenChange}
        defaultKind="card_reimbursement"
        defaultAmountCents={45000}
        defaultDate="2026-10-15"
        defaultDescription="Reembolso fatura cartão PF"
        sourceRef="[REIMBURSEMENT]card-1:2026-10"
        onSuccess={onSuccess}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Confirmar transferência/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        transferKind: "card_reimbursement",
        amount: 450,
        date: "2026-10-15",
        description: "Reembolso fatura cartão PF",
        sourceRef: "[REIMBURSEMENT]card-1:2026-10",
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("não envia transferência quando valor é zero", () => {
    render(
      <InternalTransferDialog
        open
        onOpenChange={vi.fn()}
        defaultKind="pro_labore"
        defaultAmountCents={0}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Confirmar transferência/i });
    expect(submitBtn).toBeDisabled();
    fireEvent.click(submitBtn);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("exibe explicação didática da finalidade e o switch de movimentação de caixa (Melhoria 3)", () => {
    render(
      <InternalTransferDialog
        open
        onOpenChange={vi.fn()}
        defaultKind="capital_injection"
        defaultAmountCents={100000}
      />,
    );

    expect(screen.getByText(/Aporte de Capital: transfere recursos próprios/)).toBeInTheDocument();
    expect(screen.getByLabelText("Movimentar saldo do caixa")).toBeInTheDocument();
    expect(screen.getByText(/Movimentação pareada atômica/)).toBeInTheDocument();
  });
});
