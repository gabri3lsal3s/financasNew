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
    expect(screen.getByText(/Relat\.:\s*R\$\s*100,00/)).toBeInTheDocument();
  });
});
