import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EquationBreakdownPopover } from "./equation-breakdown-popover";

describe("EquationBreakdownPopover — Explicabilidade Matemática Ativa (Regra 33)", () => {
  const defaultItems = [
    { label: "Saldo Atual em Conta", cents: 500000, sign: "+" as const, tone: "positive" as const },
    { label: "A Receber Previsto", cents: 50000, sign: "+" as const, tone: "positive" as const },
    { label: "Obrigações e Faturas do Ciclo", cents: 200000, sign: "-" as const, tone: "negative" as const },
  ];

  it("renderiza o gatilho padrão de informação quando não há children", () => {
    render(
      <EquationBreakdownPopover
        title="Saldo Livre Real (Safe-to-Spend)"
        items={defaultItems}
        totalLabel="Saldo Livre Real"
        totalCents={350000}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Ver fórmula e explicabilidade de Saldo Livre Real (Safe-to-Spend)" }),
    ).toBeInTheDocument();
  });

  it("abre o popover e exibe a fórmula, as parcelas da equação e o total resultante", async () => {
    const user = userEvent.setup();
    render(
      <EquationBreakdownPopover
        title="Saldo Livre Real"
        description="Valor disponível sem comprometer contas pendentes"
        formula="Saldo em Conta + Recebíveis − Obrigações"
        items={defaultItems}
        totalLabel="Saldo Livre Real"
        totalCents={350000}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Ver fórmula/i });
    await user.click(trigger);

    expect(screen.getByTestId("equation-breakdown-popover")).toBeInTheDocument();
    expect(screen.getAllByText("Saldo Livre Real").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Transparência")).toBeInTheDocument();
    expect(screen.getByText("Valor disponível sem comprometer contas pendentes")).toBeInTheDocument();
    expect(screen.getByText("Saldo em Conta + Recebíveis − Obrigações")).toBeInTheDocument();

    expect(screen.getByText("Saldo Atual em Conta")).toBeInTheDocument();
    expect(screen.getByText("A Receber Previsto")).toBeInTheDocument();
    expect(screen.getByText("Obrigações e Faturas do Ciclo")).toBeInTheDocument();

    expect(screen.getAllByText("+").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("=")).toBeInTheDocument();
  });
});
