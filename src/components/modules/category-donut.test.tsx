import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { CategoryDonut } from "./category-donut";

describe("CategoryDonut (F8)", () => {
  it("renderiza o anel com fatias e a legenda com percentual e valor", () => {
    const { container } = render(
      <CategoryDonut
        slices={[
          { label: "Moradia", valueCents: 50000 },
          { label: "Alimentação", valueCents: 30000 },
        ]}
      />,
    );

    const arcs = container.querySelectorAll("circle[stroke-dasharray]");
    expect(arcs).toHaveLength(2);
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    // 50.000 / 80.000 = 63% · 30.000 / 80.000 = 38%
    expect(screen.getByText("63%")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(screen.getByText("R$ 500,00")).toBeInTheDocument();
    // Centro com o total.
    expect(screen.getByText("R$ 800,00")).toBeInTheDocument();
  });

  it("empty state sem fatias ou total zero", () => {
    render(<CategoryDonut slices={[]} />);
    expect(screen.getByText("Sem despesas")).toBeInTheDocument();

    render(<CategoryDonut slices={[{ label: "X", valueCents: 0 }]} />);
    expect(screen.getAllByText("Sem despesas").length).toBeGreaterThan(0);
  });

  it("sem violações de acessibilidade (axe)", async () => {
    const { container } = render(
      <CategoryDonut
        slices={[
          { label: "Moradia", valueCents: 50000 },
          { label: "Alimentação", valueCents: 30000 },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
