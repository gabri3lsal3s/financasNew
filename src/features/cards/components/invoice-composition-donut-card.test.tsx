import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Expense } from "@/types";
import { InvoiceCompositionDonutCard } from "./invoice-composition-donut-card";

describe("InvoiceCompositionDonutCard", () => {
  it("não renderiza nada se a fatura não tem despesas (total zero)", () => {
    const { container } = render(
      <InvoiceCompositionDonutCard
        competenceMonth="2026-08"
        expenses={[]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada se a fatura só tem consumo normal (sem encargos cadastrados)", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        user_id: "u1",
        value: 200,
        date: "2026-08-10",
        category_id: "cat-1",
        payment_method: "credit_card",
        card_id: "card-1",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 200,
        description: "Supermercado",
        charge_kind: "regular",
        created_at: "2026-08-10T12:00:00Z",
      },
    ];

    const { container } = render(
      <InvoiceCompositionDonutCard
        competenceMonth="2026-08"
        expenses={expenses}
      />,
    );

    // Conforme requisito: se não houver encargos cadastrados, o card não deve aparecer
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza card colapsado por padrão com os valores resumidos quando há encargos", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        user_id: "u1",
        value: 500,
        date: "2026-08-10",
        category_id: "cat-1",
        payment_method: "credit_card",
        card_id: "card-1",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 500,
        description: "Compras Diversas",
        charge_kind: "regular",
        created_at: "2026-08-10T12:00:00Z",
      },
      {
        id: "e2",
        user_id: "u1",
        value: 65,
        date: "2026-08-15",
        category_id: "cat-fin",
        payment_method: "credit_card",
        card_id: "card-1",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 65,
        description: "Juros de Mora",
        charge_kind: "interest",
        created_at: "2026-08-15T12:00:00Z",
      },
      {
        id: "e3",
        user_id: "u1",
        value: 20,
        date: "2026-08-15",
        category_id: "cat-fin",
        payment_method: "credit_card",
        card_id: "card-1",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 20,
        description: "Multa por Atraso",
        charge_kind: "fine",
        created_at: "2026-08-15T12:00:00Z",
      },
    ];

    render(
      <InvoiceCompositionDonutCard
        competenceMonth="2026-08"
        expenses={expenses}
      />,
    );

    // O card está presente
    expect(screen.getByTestId("invoice-composition-donut-card")).toBeInTheDocument();
    expect(screen.getByText("Composição de Encargos da Fatura")).toBeInTheDocument();
    expect(screen.getAllByText(/encargos/i).length).toBeGreaterThanOrEqual(1);

    // Valores resumidos visíveis no cabeçalho
    expect(screen.getByText("Encargos:")).toBeInTheDocument();
    expect(screen.getByText("Total com encargos:")).toBeInTheDocument();

    // Por padrão está colapsado, portanto os detalhes internos não estão no documento
    expect(screen.queryByText("Juros de Mora / Rotativo")).not.toBeInTheDocument();
    expect(screen.queryByText("Multa por Atraso")).not.toBeInTheDocument();
  });

  it("expande os detalhes ao clicar no botão de alternância", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        user_id: "u1",
        value: 500,
        date: "2026-08-10",
        category_id: "cat-1",
        payment_method: "credit_card",
        card_id: "card-1",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 500,
        description: "Compras Diversas",
        charge_kind: "regular",
        created_at: "2026-08-10T12:00:00Z",
      },
      {
        id: "e2",
        user_id: "u1",
        value: 65,
        date: "2026-08-15",
        category_id: "cat-fin",
        payment_method: "credit_card",
        card_id: "card-1",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 65,
        description: "Juros de Mora",
        charge_kind: "interest",
        created_at: "2026-08-15T12:00:00Z",
      },
    ];

    render(
      <InvoiceCompositionDonutCard
        competenceMonth="2026-08"
        expenses={expenses}
      />,
    );

    const toggleButton = screen.getByRole("button", { name: /detalhes/i });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Clica para expandir
    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Juros de Mora / Rotativo")).toBeInTheDocument();
    expect(screen.getByText("Consumo Direto")).toBeInTheDocument();
  });
});
