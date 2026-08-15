import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FireProjectionChart } from "./fire-projection-chart";

const series = [
  { year: 0, capitalCents: 0, reached: false },
  { year: 1, capitalCents: 126_000, reached: false },
  { year: 2, capitalCents: 252_000, reached: false },
  { year: 3, capitalCents: 378_000, reached: false },
  { year: 4, capitalCents: 504_000, reached: false },
  { year: 5, capitalCents: 630_000, reached: true },
];

describe("FireProjectionChart (F24)", () => {
  it("renderiza o gráfico acessível com a meta e o valor final", () => {
    render(<FireProjectionChart series={series} targetCents={600_000} />);
    const chart = screen.getByRole("img");
    // formatCentsAsBRL usa NBSP após o R$ — \s cobre espaço normal e NBSP.
    expect(chart).toHaveAccessibleName(/meta fire de R\$\s*6\.000,00/i);
    expect(chart).toHaveAccessibleName(/valor final projetado: R\$\s*6\.300,00/i);
    expect(screen.getByText("5 anos")).toBeInTheDocument();
  });

  it("lidam com série vazia sem quebrar", () => {
    render(<FireProjectionChart series={[]} targetCents={1000} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
