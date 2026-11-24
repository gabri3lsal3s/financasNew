import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardInvoiceChargesFeed } from "./card-invoice-charges-feed";
import type { CreditCard, Expense } from "@/types";

const mockCard: CreditCard = {
  id: "card-1",
  user_id: "user-1",
  name: "Nubank",
  color: "#8A05BE",
  closing_day: 1,
  due_day: 10,
  credit_limit: 10000,
  is_active: true,
  brand: "mastercard",
  last_four_digits: "1234",
};

const mockCharge: Expense = {
  id: "exp-charge-1",
  user_id: "user-1",
  value: 45.5,
  date: "2026-08-12",
  category_id: "cat-charges",
  payment_method: "credit_card",
  card_id: "card-1",
  installments_total: 1,
  installment_number: 1,
  installment_group_id: null,
  bill_competence: "2026-08",
  report_weight: 1,
  base_amount: 45.5,
  description: "Juros de atraso",
  charge_kind: "interest",
  created_at: "2026-08-12T12:00:00Z",
};

describe("CardInvoiceChargesFeed", () => {
  it("renderiza empty state quando não há encargos", () => {
    render(
      <CardInvoiceChargesFeed
        charges={[]}
        selectedCard={mockCard}
        onOpenCharge={vi.fn()}
        renderInvoiceRow={() => null}
      />,
    );

    expect(screen.getByText("Nenhum encargo nesta fatura")).toBeInTheDocument();
    expect(screen.getByText("Fatura sem juros, multas, IOF ou tarifas adicionais.")).toBeInTheDocument();
  });

  it("renderiza lista de encargos e aciona onOpenCharge no botão", async () => {
    const user = userEvent.setup();
    const onOpenCharge = vi.fn();

    render(
      <CardInvoiceChargesFeed
        charges={[mockCharge]}
        selectedCard={mockCard}
        onOpenCharge={onOpenCharge}
        renderInvoiceRow={(expense) => (
          <div key={expense.id} data-testid="charge-row">
            {expense.description}
          </div>
        )}
      />,
    );

    expect(screen.getByTestId("charge-row")).toHaveTextContent("Juros de atraso");
    expect(screen.getAllByText("1 item").length).toBeGreaterThanOrEqual(1);

    const addBtn = screen.getByRole("button", { name: /lançar encargo/i });
    await user.click(addBtn);
    expect(onOpenCharge).toHaveBeenCalledTimes(1);
  });
});
