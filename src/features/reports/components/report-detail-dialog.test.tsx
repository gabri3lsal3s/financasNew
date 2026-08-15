import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReportDetailDialog } from "./report-detail-dialog";
import type { Category, Expense } from "@/types";

// Web Share indisponível no jsdom — o botão ainda renderiza e é clicável.


const mockCategories: Category[] = [
  { id: "c1", user_id: "u1", name: "Alimentação", icon: "utensils", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "c2", user_id: "u1", name: "Transporte", icon: "car", color: null, type: "expense", is_reserved: false, is_active: true },
];

const mockExpenses: Expense[] = [
  {
    id: "e1",
    user_id: "u1",
    date: "2026-08-01",
    category_id: "c1",
    value: 120,
    report_weight: 1,
    base_amount: 120,
    description: "Supermercado",
    payment_method: "pix",
    card_id: null,
    bill_competence: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "e2",
    user_id: "u1",
    date: "2026-08-05",
    category_id: "c1",
    value: 80,
    report_weight: 0.5,
    base_amount: 80,
    description: "Restaurante",
    payment_method: "credit_card",
    card_id: null,
    bill_competence: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    created_at: "2026-08-05T10:00:00Z",
  },
];

describe("ReportDetailDialog", () => {
  it("renderiza o título, período e lista de despesas com valores nominais e ponderados", () => {
    render(
      <ReportDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Despesas — Alimentação"
        subtitle="Agosto de 2026"
        expenses={mockExpenses}
        categories={mockCategories}
      />,
    );

    expect(screen.getByText("Despesas — Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compartilhar resumo/i })).toBeInTheDocument();
    expect(screen.getByText("2 despesas")).toBeInTheDocument();
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("Restaurante")).toBeInTheDocument();
  });

  it("permite clicar em uma despesa para selecioná-la", async () => {
    const user = userEvent.setup();
    const onSelectExpense = vi.fn();
    render(
      <ReportDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Despesas — Alimentação"
        expenses={mockExpenses}
        categories={mockCategories}
        onSelectExpense={onSelectExpense}
      />,
    );

    await user.click(screen.getByText("Supermercado"));
    expect(onSelectExpense).toHaveBeenCalledWith(mockExpenses[0]);
  });

  it("exibe mensagem vazia se não houver despesas", () => {
    render(
      <ReportDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Despesas — Outros"
        expenses={[]}
        categories={mockCategories}
      />,
    );

    expect(screen.getByText("Nenhuma despesa")).toBeInTheDocument();
  });
});
