import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionRow } from "./transaction-row";

describe("TransactionRow", () => {
  it("exibe título, subtítulo e valor formatado com sinal de despesa", () => {
    render(
      <TransactionRow
        title="Supermercado"
        subtitle="Mercado Central"
        date="13/08"
        amountCents={150000}
        kind="expense"
        icon="mercado"
      />,
    );
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("13/08 · Mercado Central")).toBeInTheDocument();
    expect(screen.getByText("−R$ 1.500,00")).toBeInTheDocument();
  });

  it("usa sinal positivo para renda", () => {
    render(<TransactionRow title="Salário" amountCents={350000} kind="income" icon="salario" />);
    expect(screen.getByText("+R$ 3.500,00")).toBeInTheDocument();
  });

  it("chama onClick ao clicar quando fornecido", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<TransactionRow title="Aluguel" amountCents={120000} kind="expense" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: /aluguel/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("exibe valor real e valor ponderado no relatório quando reportWeight < 1", () => {
    render(
      <TransactionRow
        title="Jantar Compartilhado"
        amountCents={20000}
        reportWeight={0.5}
        kind="expense"
      />,
    );
    expect(screen.getByText("−R$ 200,00")).toBeInTheDocument();
    expect(screen.getByText("Relat.:")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();
    expect(screen.getByText("50% rateio")).toBeInTheDocument();
  });

  it("renderiza badge '0% reembolso' quando reportWeight é 0", () => {
    render(
      <TransactionRow
        title="Despesa Corporativa Reembolsável"
        amountCents={15000}
        reportWeight={0}
        kind="expense"
      />,
    );
    expect(screen.getByText("0% reembolso")).toBeInTheDocument();
    expect(screen.getByText("Relat.:")).toBeInTheDocument();
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("não renderiza badge de rateio quando reportWeight é 1 ou omitido", () => {
    render(
      <TransactionRow
        title="Farmácia"
        amountCents={5000}
        reportWeight={1}
        kind="expense"
      />,
    );
    expect(screen.queryByText(/rateio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reembolso/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Relat.:")).not.toBeInTheDocument();
  });

  it("renderiza badge derivado a partir de weightedAmountCents", () => {
    render(
      <TransactionRow
        title="Compra em Conjunto"
        amountCents={10000}
        weightedAmountCents={7500}
        kind="expense"
      />,
    );
    expect(screen.getByText("75% rateio")).toBeInTheDocument();
    expect(screen.getByText("Relat.:")).toBeInTheDocument();
    expect(screen.getByText("R$ 75,00")).toBeInTheDocument();
  });
});
