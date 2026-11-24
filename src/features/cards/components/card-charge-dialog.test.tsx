import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardChargeDialog } from "./card-charge-dialog";

const createExpenseMock = vi.fn();
const updateCustomSettingsMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [{ id: "cat-juros", name: "Juros e Encargos", type: "expense" }],
    isLoading: false,
  }),
  useUserPreferences: () => ({
    data: { custom_settings: { preferredChargeCategoryId: "cat-juros" } },
  }),
  useUpdateCustomSettings: () => ({
    mutateAsync: updateCustomSettingsMock,
    isPending: false,
  }),
  useCreateExpense: () => ({
    mutateAsync: createExpenseMock,
    isPending: false,
  }),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("CardChargeDialog", () => {
  it("não renderiza quando open=false", () => {
    const { container } = render(
      <CardChargeDialog
        cardId="card-1"
        competenceMonth="2026-08"
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza campos e lança encargo com sucesso", async () => {
    createExpenseMock.mockResolvedValueOnce("exp-123");
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CardChargeDialog
        cardId="card-1"
        competenceMonth="2026-08"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText(/Lançar encargo no cartão/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ago\. de 2026/i).length).toBeGreaterThanOrEqual(1);

    const amountInput = screen.getByRole("textbox", { name: /Valor do encargo/i });
    fireEvent.change(amountInput, { target: { value: "45,50" } });

    const submitBtn = screen.getByRole("button", { name: /Confirmar encargo/i });
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    expect(createExpenseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 45.5,
        paymentMethod: "credit_card",
        cardId: "card-1",
        categoryId: "cat-juros",
        chargeKind: "interest",
        installments: [
          expect.objectContaining({
            value: 45.5,
            billCompetence: "2026-08",
          }),
        ],
      }),
    );
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
