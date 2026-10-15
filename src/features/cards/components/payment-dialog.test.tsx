import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PaymentDialog } from "./payment-dialog";

const paymentMutateAsync = vi.fn();
const refundMutateAsync = vi.fn();

vi.mock("@/state", () => ({
  useCreateCardPayment: () => ({
    mutateAsync: paymentMutateAsync,
    isPending: false,
  }),
  useCreateRefund: () => ({
    mutateAsync: refundMutateAsync,
    isPending: false,
  }),
  useRefinanceCardBill: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("PaymentDialog — Preenchimento automático e tratamento de faturas", () => {
  it("carrega automaticamente o valor integral pendente em modo pagamento", () => {
    render(
      <PaymentDialog
        cardId="c1"
        competenceMonth="2026-08"
        mode="payment"
        open={true}
        onOpenChange={vi.fn()}
        openBalanceCents={18950}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Valor do pagamento" });
    expect(input).toHaveValue("R$\u00a0189,50");
    expect(screen.getByText("Valor integral pré-preenchido")).toBeInTheDocument();
  });

  it("permite registrar o pagamento do valor integral diretamente sem redigitar", async () => {
    paymentMutateAsync.mockResolvedValueOnce("p1");
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <PaymentDialog
        cardId="c1"
        competenceMonth="2026-08"
        mode="payment"
        open={true}
        onOpenChange={onOpenChange}
        openBalanceCents={15000}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: "Confirmar pagamento" });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    expect(paymentMutateAsync).toHaveBeenCalledWith({
      cardId: "c1",
      competenceMonth: "2026-08",
      amount: 150,
      date: expect.any(String),
      note: null,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("permite editar o valor para pagamento parcial e restaurar o total", async () => {
    paymentMutateAsync.mockResolvedValueOnce("p1");
    const user = userEvent.setup();

    render(
      <PaymentDialog
        cardId="c1"
        competenceMonth="2026-08"
        mode="payment"
        open={true}
        onOpenChange={vi.fn()}
        openBalanceCents={20000}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Valor do pagamento" });
    expect(input).toHaveValue("R$\u00a0200,00");

    // Edita para pagamento parcial (R$ 80,00)
    await user.clear(input);
    await user.type(input, "8000");
    expect(input).toHaveValue("R$\u00a080,00");

    // Botão de restaurar total aparece quando valor difere do total pendente
    const restoreBtn = screen.getByRole("button", { name: "Restaurar total" });
    expect(restoreBtn).toBeInTheDocument();

    await user.click(restoreBtn);
    expect(input).toHaveValue("R$\u00a0200,00");
  });

  it("trata fatura zerada ou quitada exibindo aviso e desabilitando envio com valor zero", () => {
    render(
      <PaymentDialog
        cardId="c1"
        competenceMonth="2026-08"
        mode="payment"
        open={true}
        onOpenChange={vi.fn()}
        openBalanceCents={0}
      />,
    );

    expect(
      screen.getByText("Esta fatura não possui saldo pendente no momento ou já foi quitada."),
    ).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "Valor do pagamento" });
    expect(input).toHaveValue("R$\u00a00,00");

    const submitBtn = screen.getByRole("button", { name: "Confirmar pagamento" });
    expect(submitBtn).toBeDisabled();
  });

  it("em modo estorno não pré-popula o saldo da fatura e inicia zerado", () => {
    render(
      <PaymentDialog
        cardId="c1"
        competenceMonth="2026-08"
        mode="refund"
        open={true}
        onOpenChange={vi.fn()}
        openBalanceCents={50000}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Valor do estorno" });
    expect(input).toHaveValue("R$\u00a00,00");
    expect(screen.queryByText(/Total pendente/i)).not.toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Confirmar estorno" });
    expect(submitBtn).toBeDisabled();
  });
});
