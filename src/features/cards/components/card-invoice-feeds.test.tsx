import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardInvoiceExpensesFeed } from "./card-invoice-expenses-feed";
import { CardInvoicePaymentsFeed } from "./card-invoice-payments-feed";
import type { CardPayment, CreditCard, Expense } from "@/types";

const mockCard: CreditCard = {
  id: "card-1",
  user_id: "user-1",
  name: "Nubank Ultravioleta",
  color: "#8A05BE",
  closing_day: 1,
  due_day: 10,
  credit_limit: 10000,
  is_active: true,
  brand: "mastercard",
  last_four_digits: "1234",
};

const mockExpense: Expense = {
  id: "exp-1",
  user_id: "user-1",
  value: 150,
  date: "2026-08-05",
  category_id: "cat-1",
  payment_method: "credit_card",
  card_id: "card-1",
  installments_total: 1,
  installment_number: 1,
  installment_group_id: null,
  bill_competence: "2026-08",
  report_weight: 1,
  base_amount: 150,
  description: "Compra Teste",
  created_at: "2026-08-05T12:00:00Z",
};

const mockPayment: CardPayment = {
  id: "pay-1",
  user_id: "user-1",
  card_id: "card-1",
  competence_month: "2026-08",
  date: "2026-08-09",
  amount: 500,
  note: "Pagamento adiantado",
  is_refund: false,
};

describe("Card Invoice Feeds", () => {
  it("renders CardInvoiceExpensesFeed with action buttons and empty state", async () => {
    const onOpenImport = vi.fn();
    const onOpenPrint = vi.fn();
    const onExportCsv = vi.fn();

    render(
      <CardInvoiceExpensesFeed
        monthLabelStr="Agosto de 2026"
        competenceExpenses={[]}
        installments={[]}
        regular={[]}
        selectedCard={mockCard}
        onOpenImport={onOpenImport}
        onOpenPrint={onOpenPrint}
        onExportCsv={onExportCsv}
        renderInvoiceRow={() => null}
      />
    );

    expect(screen.getByText(/Despesas · Agosto de 2026/i)).toBeInTheDocument();
    expect(screen.getByText("Sem despesas nesta fatura")).toBeInTheDocument();

    const user = userEvent.setup();
    const importBtn = screen.getByRole("button", { name: /Importar/i });
    await user.click(importBtn);
    expect(onOpenImport).toHaveBeenCalled();
  });

  it("renders CardInvoiceExpensesFeed with regular and installment lists", () => {
    render(
      <CardInvoiceExpensesFeed
        monthLabelStr="Agosto de 2026"
        competenceExpenses={[mockExpense]}
        installments={[]}
        regular={[mockExpense]}
        selectedCard={mockCard}
        onOpenImport={vi.fn()}
        onOpenPrint={vi.fn()}
        onExportCsv={vi.fn()}
        renderInvoiceRow={(e) => <div key={e.id}>{e.description}</div>}
      />
    );

    expect(screen.getByText("Compra Teste")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma compra parcelada nesta fatura.")).toBeInTheDocument();
  });

  it("renders CardInvoicePaymentsFeed with payments and delete trigger", async () => {
    const onDeletePayment = vi.fn();

    render(
      <CardInvoicePaymentsFeed
        competencePayments={[mockPayment]}
        onDeletePayment={onDeletePayment}
      />
    );

    expect(screen.getByText("Pagamentos e estornos")).toBeInTheDocument();
    expect(screen.getByText("Pagamento adiantado")).toBeInTheDocument();

    const user = userEvent.setup();
    const deleteBtn = screen.getByRole("button", { name: /Excluir pagamento/i });
    await user.click(deleteBtn);
    expect(onDeletePayment).toHaveBeenCalledWith(mockPayment);
  });
});
