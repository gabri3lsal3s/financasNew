import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioMappingStep } from "./portfolio-mapping-step";
import type { PortfolioColumnMapping, RawPortfolioRow } from "@/domain/portfolio";

describe("PortfolioMappingStep — Fase 35 & 36", () => {
  const initialMapping: PortfolioColumnMapping = {
    mode: "movements",
    dateColIndex: 0,
    tickerColIndex: 1,
    typeColIndex: 2,
    qtyColIndex: 3,
    priceColIndex: 4,
    totalColIndex: 5,
    hasHeader: true,
    delimiter: ";",
  };

  const rows: RawPortfolioRow[] = [
    {
      rowIndex: 0,
      cells: ["Data", "Código", "Operação", "Quantidade", "Preço", "Total"],
      rawText: "Data;Código;Operação;Quantidade;Preço;Total",
    },
    {
      rowIndex: 1,
      cells: ["15/08/2026", "PETR4", "Compra", "100", "38,50", "3850,00"],
      rawText: "15/08/2026;PETR4;Compra;100;38,50;3850,00",
    },
  ];

  it("renderiza a tabela de prévia e seletores de coluna", () => {
    render(
      <PortfolioMappingStep
        rows={rows}
        initialMapping={initialMapping}
        onConfirmMapping={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/Linhas identificadas/i)).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("Coluna de Data")).toBeInTheDocument();
    expect(screen.getByText("Coluna de Código / Ticker")).toBeInTheDocument();
    expect(screen.getByText("Coluna de Tipo / Movimentação")).toBeInTheDocument();
    expect(screen.getByText("Coluna de Quantidade / Cotas")).toBeInTheDocument();
    expect(screen.getByText("Coluna de Preço Unitário")).toBeInTheDocument();
    expect(screen.getByText("Coluna de Valor Total")).toBeInTheDocument();
  });

  it("chama onConfirmMapping com o mapeamento ajustado ao clicar em Avançar", () => {
    const handleConfirm = vi.fn();
    render(
      <PortfolioMappingStep
        rows={rows}
        initialMapping={initialMapping}
        onConfirmMapping={handleConfirm}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Avançar para conferência/i }));
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        dateColIndex: 0,
        tickerColIndex: 1,
        typeColIndex: 2,
        qtyColIndex: 3,
        priceColIndex: 4,
        totalColIndex: 5,
        hasHeader: true,
      }),
    );
  });

  it("chama onBack ao clicar em Voltar", () => {
    const handleBack = vi.fn();
    render(
      <PortfolioMappingStep
        rows={rows}
        initialMapping={initialMapping}
        onConfirmMapping={vi.fn()}
        onBack={handleBack}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(handleBack).toHaveBeenCalled();
  });
});
