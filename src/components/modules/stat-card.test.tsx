import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendingUp } from "lucide-react";
import { StatCard } from "./stat-card";

describe("StatCard", () => {
  it("renderiza título, valor formatado e ícone", () => {
    render(
      <StatCard
        title="Patrimônio Total"
        value={1500000} // R$ 15.000,00
        icon={TrendingUp}
      />,
    );

    expect(screen.getByText("Patrimônio Total")).toBeInTheDocument();
  });

  it("aplica classe reduzida de auto-fit para valores com 7+ dígitos", () => {
    const { container } = render(
      <StatCard
        title="Investimento Elevado"
        value={50000000} // R$ 500.000,00 (>= 10.000.000 centavos)
      />,
    );

    const valueEl = container.querySelector(".text-xl");
    expect(valueEl).not.toBeNull();
  });

  it("exibe badge de tendência positiva e negativa com cor semântica", () => {
    const { rerender } = render(
      <StatCard
        title="Rendimento"
        value={10000}
        trend={{ value: 8.5, label: "vs mês anterior" }}
      />,
    );

    expect(screen.getByText("+8.5%")).toBeInTheDocument();
    expect(screen.getByText("vs mês anterior")).toBeInTheDocument();

    rerender(
      <StatCard
        title="Rendimento"
        value={10000}
        trend={{ value: -4.2 }}
      />,
    );

    expect(screen.getByText("-4.2%")).toBeInTheDocument();
  });
});
