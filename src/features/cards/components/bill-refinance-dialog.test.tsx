import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BillRefinanceDialog } from "./bill-refinance-dialog";

const refinanceMock = vi.fn();

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [{ id: "cat-juros", name: "Juros e Taxas", type: "expense" }],
    isLoading: false,
  }),
  useRefinanceCreditCardBill: () => ({
    mutateAsync: refinanceMock,
    isPending: false,
  }),
}));

describe("BillRefinanceDialog", () => {
  it("renderiza simulação com PercentInput, MoneyText e submete parcelamento de fatura", async () => {
    refinanceMock.mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <BillRefinanceDialog
        cardId="card-1"
        competenceMonth="2026-08"
        remainingBalanceCents={100000}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText(/Ago\. de 2026/i)).toBeInTheDocument();
    const rateInput = screen.getByRole("textbox", { name: /Taxa de juros/i });
    expect(rateInput).toHaveValue("3,50");

    // Valores protegidos com .num (MoneyText)
    expect(document.querySelectorAll(".num").length).toBeGreaterThanOrEqual(4);

    // Seleciona categoria dos juros
    await user.click(screen.getByRole("combobox", { name: "Categoria dos juros" }));
    await user.click(await screen.findByRole("option", { name: "Juros e Taxas" }));

    await user.click(screen.getByRole("button", { name: /Confirmar parcelamento/i }));

    expect(refinanceMock).toHaveBeenCalledTimes(1);
    expect(refinanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: "card-1",
        competenceMonth: "2026-08",
        expenseCategoryId: "cat-juros",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
