import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AddPublicTripExpenseDialog } from "./add-public-trip-expense-dialog";
import * as tripsQuery from "@/state/queries/use-trips";
import type { PublicTripMember } from "@/types/trips";

const mockMutateAsync = vi.fn();

vi.mock("@/state/queries/use-trips", async (importOriginal) => {
  const actual = await importOriginal<typeof tripsQuery>();
  return {
    ...actual,
    useSubmitPublicTripExpenseMutation: vi.fn(() => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })),
  };
});

vi.mock("@/services/sensory");

const mockMembers: PublicTripMember[] = [
  {
    id: "m1",
    name: "Gabriel",
    is_host: true,
    has_axis_account: true,
    pix_key: "gabriel@axis.app",
    pix_key_type: "email",
  },
  {
    id: "m2",
    name: "Pedro",
    is_host: false,
    has_axis_account: false,
    pix_key: null,
    pix_key_type: null,
  },
  {
    id: "m3",
    name: "Mariana",
    is_host: false,
    has_axis_account: false,
    pix_key: null,
    pix_key_type: null,
  },
];

function renderDialog(
  props: Partial<React.ComponentProps<typeof AddPublicTripExpenseDialog>> = {}
) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    token: "token123",
    members: mockMembers,
    ...props,
  };

  return render(<AddPublicTripExpenseDialog {...defaultProps} />);
}

describe("AddPublicTripExpenseDialog (Blindagem Anti-Erro / F2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockMutateAsync.mockResolvedValue({ id: "new-expense-1" });
  });

  it("sem identidade ativa: exibe placeholder obrigatório e NÃO assume host ou primeiro membro como fallback", async () => {
    const user = userEvent.setup();
    renderDialog();

    const payerSelect = screen.getByRole("combobox", { name: "Quem pagou" });
    expect(payerSelect).toHaveTextContent("Selecione o pagador (Obrigatório)...");

    // Botão de submissão desabilitado inicialmente
    const submitButton = screen.getByRole("button", { name: "Adicionar Despesa" });
    expect(submitButton).toBeDisabled();

    // Preenche valor e descrição, mas sem pagador
    const amountInput = screen.getByLabelText("Valor Pago");
    fireEvent.change(amountInput, { target: { value: "R$\u00a060,00" } });

    const descriptionInput = screen.getByLabelText("Descrição do Gasto");
    fireEvent.change(descriptionInput, { target: { value: "Gasolina da van" } });

    // Botão ainda DEVE permanecer desabilitado por falta do pagador
    expect(submitButton).toBeDisabled();

    // Seleciona um pagador manualmente
    await user.click(payerSelect);
    const pedroOption = await screen.findByRole("option", { name: "Pedro" });
    await user.click(pedroOption);

    // Agora deve estar habilitado
    expect(payerSelect).toHaveTextContent("Pedro");
    expect(submitButton).toBeEnabled();

    // Clica em submeter
    await user.click(submitButton);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token123",
        paidByMemberId: "m2",
        amountCents: 6000,
        description: "Gasolina da van",
        categoryName: "Alimentação",
        splitType: "equal",
      })
    );
  });

  it("com identidade ativa via prop: pré-seleciona o convidado e habilita submissão com valor e descrição", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    renderDialog({
      defaultPayerId: "m2",
      onOpenChange,
      onSuccess,
    });

    const payerSelect = screen.getByRole("combobox", { name: "Quem pagou" });
    expect(payerSelect).toHaveTextContent("Pedro");

    const submitButton = screen.getByRole("button", { name: "Adicionar Despesa" });
    expect(submitButton).toBeDisabled(); // ainda sem valor/descrição

    fireEvent.change(screen.getByLabelText("Valor Pago"), { target: { value: "R$\u00a090,00" } });
    fireEvent.change(screen.getByLabelText("Descrição do Gasto"), { target: { value: "Jantar peixe" } });

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token123",
        paidByMemberId: "m2",
        amountCents: 9000,
        description: "Jantar peixe",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("com identidade ativa no localStorage: detecta identidade automaticamente sem props", () => {
    window.localStorage.setItem("axis_guest_member_token123", "m3");

    renderDialog();

    const payerSelect = screen.getByRole("combobox", { name: "Quem pagou" });
    expect(payerSelect).toHaveTextContent("Mariana");
  });

  it("permite alterar o pagador manualmente mesmo quando uma identidade já está pré-selecionada", async () => {
    const user = userEvent.setup();
    renderDialog({ activeMemberId: "m2" });

    const payerSelect = screen.getByRole("combobox", { name: "Quem pagou" });
    expect(payerSelect).toHaveTextContent("Pedro");

    // Altera para Gabriel (Organizador)
    await user.click(payerSelect);
    const hostOption = await screen.findByRole("option", { name: /Gabriel/ });
    await user.click(hostOption);

    expect(payerSelect).toHaveTextContent("Gabriel (Organizador)");

    fireEvent.change(screen.getByLabelText("Valor Pago"), { target: { value: "R$\u00a030,00" } });
    fireEvent.change(screen.getByLabelText("Descrição do Gasto"), { target: { value: "Bebidas" } });

    await user.click(screen.getByRole("button", { name: "Adicionar Despesa" }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        paidByMemberId: "m1",
        amountCents: 3000,
        description: "Bebidas",
      })
    );
  });

  it("calcula splits determinísticos preservando centavos no modo Todos igualmente", async () => {
    const user = userEvent.setup();
    renderDialog({ defaultPayerId: "m1" });

    // 10000 centavos / 3 pessoas:
    // base: 3333, sobra: 1 centavo
    // pagador m1 recebe 3334, m2 e m3 recebem 3333
    fireEvent.change(screen.getByLabelText("Valor Pago"), { target: { value: "R$\u00a0100,00" } });
    fireEvent.change(screen.getByLabelText("Descrição do Gasto"), { target: { value: "Supermercado" } });

    await user.click(screen.getByRole("button", { name: "Adicionar Despesa" }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        splitType: "equal",
        splits: [
          { member_id: "m1", share_cents: 3334 },
          { member_id: "m2", share_cents: 3333 },
          { member_id: "m3", share_cents: 3333 },
        ],
      })
    );
  });

  it("permite divisão customizada no modo Apenas alguns desmarcando participantes", async () => {
    const user = userEvent.setup();
    renderDialog({ defaultPayerId: "m1" });

    // Muda para "Apenas alguns"
    const customSplitButton = screen.getByRole("button", { name: /Apenas alguns/ });
    await user.click(customSplitButton);

    // Desmarca Mariana
    const marianaCheckbox = screen.getByRole("checkbox", { name: "Mariana" });
    await user.click(marianaCheckbox);

    fireEvent.change(screen.getByLabelText("Valor Pago"), { target: { value: "R$\u00a0100,00" } });
    fireEvent.change(screen.getByLabelText("Descrição do Gasto"), { target: { value: "Aluguel prancha" } });

    await user.click(screen.getByRole("button", { name: "Adicionar Despesa" }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        splitType: "custom",
        splits: [
          { member_id: "m1", share_cents: 5000 },
          { member_id: "m2", share_cents: 5000 },
        ],
      })
    );
  });

  it("cancela o diálogo ao clicar em Cancelar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
