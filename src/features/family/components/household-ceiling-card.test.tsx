import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HouseholdCeilingCard } from "./household-ceiling-card";

describe("HouseholdCeilingCard", () => {
  it("renderiza corretamente quando não há teto mensal configurado", () => {
    render(
      <HouseholdCeilingCard
        monthlyCeilingCents={0}
        totalSpentCents={150000}
        remainingCents={0}
        spentPercentage={0}
      />,
    );

    expect(screen.getByText("Teto da Casa")).toBeInTheDocument();
    expect(screen.getByText("Sem teto definido")).toBeInTheDocument();
    expect(
      screen.getByText("Defina um teto mensal nas configurações para monitorar o limite de consumo familiar."),
    ).toBeInTheDocument();
  });

  it("renderiza com teto configurado dentro do limite", () => {
    render(
      <HouseholdCeilingCard
        monthlyCeilingCents={500000}
        totalSpentCents={250000}
        remainingCents={250000}
        spentPercentage={50}
      />,
    );

    expect(screen.getByText("50% consumido")).toBeInTheDocument();
    expect(screen.getByText(/Restam/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renderiza estado de teto excedido", () => {
    render(
      <HouseholdCeilingCard
        monthlyCeilingCents={400000}
        totalSpentCents={450000}
        remainingCents={-50000}
        spentPercentage={112.5}
      />,
    );

    expect(screen.getByText("Teto excedido")).toBeInTheDocument();
    expect(screen.getByText(/Excedido em/)).toBeInTheDocument();
  });

  it("exibe receita conjunta informada quando disponível", () => {
    render(
      <HouseholdCeilingCard
        monthlyCeilingCents={600000}
        totalSpentCents={300000}
        remainingCents={300000}
        spentPercentage={50}
        totalIncomeCents={800000}
      />,
    );

    expect(screen.getByText("Receita conjunta informada")).toBeInTheDocument();
  });
});
