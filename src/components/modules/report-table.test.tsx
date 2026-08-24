import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportTable } from "./report-table";

describe("ReportTable component", () => {
  it("renderiza tabela simples quando não há métricas duplas", () => {
    render(
      <ReportTable
        title="Por Categoria"
        totalCents={100000}
        rows={[
          { key: "c1", label: "Alimentação", valueCents: 60000, percent: 60 },
          { key: "c2", label: "Transporte", valueCents: 40000, percent: 40 },
        ]}
      />,
    );

    expect(screen.getByText("Por Categoria")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("renderiza Valor Bruto como coluna principal e Ponderado como coluna de consulta", () => {
    render(
      <ReportTable
        title="Por Categoria"
        totalBrutoCents={100000}
        totalPonderadoCents={75000}
        totalCents={100000}
        rows={[
          {
            key: "c1",
            label: "Alimentação",
            brutoCents: 60000,
            ponderadoCents: 45000,
            valueCents: 60000,
            percent: 60,
          },
          {
            key: "c2",
            label: "Transporte",
            brutoCents: 40000,
            ponderadoCents: 30000,
            valueCents: 40000,
            percent: 40,
          },
        ]}
      />,
    );

    expect(screen.getByText("Valor Bruto")).toBeInTheDocument();
    expect(screen.getByText("Ponderado")).toBeInTheDocument();
    expect(screen.getByText("Bruto:")).toBeInTheDocument();
    expect(screen.getByText("Ponderado:")).toBeInTheDocument();
  });
});
