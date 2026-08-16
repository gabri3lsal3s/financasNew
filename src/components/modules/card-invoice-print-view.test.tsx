import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardInvoicePrintView } from "./card-invoice-print-view";

const baseProps = {
  cardName: "Nubank",
  competenceMonth: "2026-08",
  competenceLabel: "Agosto de 2026",
  totalBrutoCents: 320000,
  totalPonderadoCents: 300000,
  pagoCents: 100000,
  saldoAbertoCents: 220000,
  saldoPonderadoCents: 200000,
  expenses: [
    {
      date: "2026-08-05",
      description: "Supermercado",
      categoryName: "Alimentação",
      valueCents: 200000,
      reportValueCents: 180000,
      installments: "—",
    },
    {
      date: "2026-08-12",
      description: "Passagem",
      categoryName: "Transporte",
      valueCents: 120000,
      reportValueCents: 120000,
      installments: "2/3",
    },
  ],
};

describe("CardInvoicePrintView (fatura do cartão)", () => {
  it("renderiza cabeçalho, resumo e gastos com valores em centavos", () => {
    render(<CardInvoicePrintView {...baseProps} />);

    expect(screen.getByText("Finanças Pessoais")).toBeInTheDocument();
    expect(screen.getByText("Fatura de cartão de crédito")).toBeInTheDocument();
    expect(screen.getByText(/Nubank · Agosto de 2026/)).toBeInTheDocument();
    expect(screen.getByText("Fatura total (bruto)")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Saldo aberto (bruto)")).toBeInTheDocument();
    // Ponderado aparece quando difere do bruto (KPI + saldo)
    expect(screen.getAllByText("Ponderada:")).toHaveLength(1);
    expect(screen.getAllByText("Ponderado:")).toHaveLength(1);
    // Gastos com datas formatadas e parcelas
    expect(screen.getByText("05/08/2026")).toBeInTheDocument();
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("exibe pagamentos e estornos da competência", () => {
    render(
      <CardInvoicePrintView
        {...baseProps}
        payments={[
          { date: "2026-08-03", note: "Pagamento Nubank", amountCents: 100000, isRefund: false },
          { date: "2026-08-15", note: "Estorno mercado", amountCents: 5000, isRefund: true },
        ]}
      />,
    );

    expect(screen.getByText("Pagamentos e estornos")).toBeInTheDocument();
    expect(screen.getByText("Pagamento Nubank")).toBeInTheDocument();
    expect(screen.getByText("Estorno mercado")).toBeInTheDocument();
    expect(screen.getByText("Estorno")).toBeInTheDocument();
    expect(screen.getByText("Pagamento")).toBeInTheDocument();
  });

  it("mostra estado vazio sem gastos e sem seção de pagamentos", () => {
    render(<CardInvoicePrintView {...baseProps} expenses={[]} payments={[]} />);

    expect(screen.getByText("Nenhum gasto lançado nesta competência.")).toBeInTheDocument();
    expect(screen.queryByText("Pagamentos e estornos")).not.toBeInTheDocument();
  });

  it("não mostra ponderação quando os valores não diferem", () => {
    render(
      <CardInvoicePrintView
        {...baseProps}
        totalBrutoCents={320000}
        totalPonderadoCents={320000}
        saldoAbertoCents={220000}
        saldoPonderadoCents={220000}
      />,
    );

    expect(screen.queryByText("Ponderada:")).not.toBeInTheDocument();
    expect(screen.queryByText("Ponderado:")).not.toBeInTheDocument();
  });

  it("marca o contêiner com a classe print-area", () => {
    const { container } = render(<CardInvoicePrintView {...baseProps} expenses={[]} />);
    expect(container.querySelector(".print-area")).not.toBeNull();
  });
});
