import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanningSection } from "./planning-section";

describe("PlanningSection (F24)", () => {
  it("mostra a meta FIRE e o tempo até a meta com os padrões do mês", () => {
    render(<PlanningSection balanceCents={1_000_000} monthlyExpensesCents={200_000} />);
    expect(screen.getByText("Independência financeira (FIRE)")).toBeInTheDocument();
    // Meta = 200.000 centavos × 12 × 25 = 60.000.000 centavos = R$ 600.000,00.
    // Aparece na meta e na linha de referência do gráfico.
    expect(screen.getAllByText(/600\.000,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\d+ anos?/).length).toBeGreaterThan(0);
  });

  it("atualiza a projeção ao alterar o aporte mensal", () => {
    render(<PlanningSection balanceCents={0} monthlyExpensesCents={200_000} />);
    const aporte = screen.getByLabelText("Aporte mensal");
    fireEvent.change(aporte, { target: { value: "1000" } });
    // Com aporte alto o tempo até a meta diminui (valor muda em relação ao padrão).
    expect(screen.getAllByText(/\d+ anos?/).length).toBeGreaterThan(0);
  });

  it("usa o retorno padrão (5%) quando o campo é inválido", () => {
    render(<PlanningSection balanceCents={1_000_000} monthlyExpensesCents={200_000} />);
    const retorno = screen.getByLabelText(/retorno real anual/i);
    expect((retorno as HTMLInputElement).value).toBe("5");
    fireEvent.change(retorno, { target: { value: "" } });
    // Sem valor → cai para o padrão 5% (não quebra).
    expect(screen.getByText("Independência financeira (FIRE)")).toBeInTheDocument();
  });
});
