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

  it("todas as linhas usam a mesma superfície (bg-surface) — receitas e despesas iguais", () => {
    const { container } = render(
      <>
        <TransactionRow title="Salário" amountCents={1000} kind="income" />
        <TransactionRow title="Aluguel" amountCents={1000} kind="expense" />
      </>,
    );
    const rows = Array.from(container.querySelectorAll(".rounded-xl.bg-surface"));
    expect(rows).toHaveLength(2);
  });
});
