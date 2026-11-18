import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoanFormDialog } from "./loan-form-dialog";

const createLoanMock = vi.fn();

vi.mock("@/state", () => ({
  useCreateLoanContract: () => ({
    mutateAsync: createLoanMock,
    isPending: false,
  }),
}));

describe("LoanFormDialog", () => {
  it("envia interestRateMonthly em pontos percentuais diretos sem divisão por 100 e usa PercentInput", async () => {
    createLoanMock.mockResolvedValueOnce({ id: "loan-new" });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<LoanFormDialog open={true} onOpenChange={onOpenChange} />);

    const rateInput = screen.getByRole("textbox", { name: "Taxa de juros (% a.m.)" });
    expect(rateInput).toHaveValue("1,80");

    const nameInput = screen.getByLabelText(/Nome do contrato/i);
    await user.type(nameInput, "Empréstimo Teste");

    await user.click(screen.getByRole("button", { name: "Salvar contrato" }));

    expect(createLoanMock).toHaveBeenCalledTimes(1);
    expect(createLoanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Empréstimo Teste",
        interestRateMonthly: 1.8,
        principalAmount: 5000,
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("reseta o estado ao fechar e reabrir o modal", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LoanFormDialog open={true} onOpenChange={vi.fn()} />);

    const nameInput = screen.getByLabelText(/Nome do contrato/i);
    await user.type(nameInput, "Rascunho temporário");
    expect(nameInput).toHaveValue("Rascunho temporário");

    rerender(<LoanFormDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<LoanFormDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText(/Nome do contrato/i)).toHaveValue("");
  });
});
