import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiGrid } from "./kpi-grid";

describe("KpiGrid — Grid Canônico de Métricas Financeiras (§4 Regra 10)", () => {
  it("renderiza os filhos em grid responsivo", () => {
    render(
      <KpiGrid columns={3}>
        <div data-testid="kpi-1">KPI 1</div>
        <div data-testid="kpi-2">KPI 2</div>
        <div data-testid="kpi-3">KPI 3</div>
      </KpiGrid>,
    );

    expect(screen.getByTestId("kpi-1")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-2")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-3")).toBeInTheDocument();
  });
});
