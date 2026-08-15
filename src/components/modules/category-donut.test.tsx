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

  it("renderiza cores customizadas e ícones quando fornecidos", () => {
    const { container } = render(
      <CategoryDonut
        slices={[
          { label: "Moradia", valueCents: 50000, color: "#e11d48", icon: "moradia" },
          { label: "Alimentação", valueCents: 30000, color: "#10b981", icon: "mercado" },
        ]}
      />,
    );

    const arcs = container.querySelectorAll<SVGCircleElement>("circle[stroke-dasharray]");
    expect(arcs[0]?.style.stroke).toMatch(/(#e11d48|rgb\(225,\s*29,\s*72\))/);
    expect(arcs[1]?.style.stroke).toMatch(/(#10b981|rgb\(16,\s*185,\s*129\))/);
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
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
