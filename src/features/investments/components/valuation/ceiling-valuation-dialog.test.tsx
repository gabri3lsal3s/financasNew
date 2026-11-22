import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CeilingValuationDialog } from "./ceiling-valuation-dialog";

describe("CeilingValuationDialog", () => {
  it("renderiza o modal com as abas de Bazin, Graham, Gordon e Manual para Ações", () => {
    render(
      <CeilingValuationDialog
        open={true}
        onOpenChange={vi.fn()}
        ticker="PETR4"
        assetClass="Ações"
        currentPrice={38.5}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Calculadora de Preço Teto & Valuation")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Décio Bazin" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Graham" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Gordon" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Manual" })).toBeInTheDocument();
  });

  it("calcula o preço teto Bazin em tempo real e permite aplicar", () => {
    const handleApply = vi.fn();
    render(
      <CeilingValuationDialog
        open={true}
        onOpenChange={vi.fn()}
        ticker="BBAS3"
        assetClass="Ações"
        currentPrice={28.0}
        onApply={handleApply}
        onClose={vi.fn()}
      />,
    );

    // Preenche DPA = 2.40 (Yield padrão 6%)
    const dpaInput = screen.getByLabelText(/Proventos Anuais por Ação/);
    fireEvent.change(dpaInput, { target: { value: "2,40" } });

    // Preço teto esperado: 2.40 / 0.06 = R$ 40,00
    expect(screen.getByText(/^Teto:\s*R\$\s*40,00/)).toBeInTheDocument();

    // Botão aplicar teto habilitado
    const applyBtn = screen.getByRole("button", { name: /Aplicar Teto: R\$\s*40,00/ });
    expect(applyBtn).toBeEnabled();

    fireEvent.click(applyBtn);
    expect(handleApply).toHaveBeenCalledWith({
      price: 40,
      method: "bazin",
      metadata: expect.objectContaining({
        selectedMethod: "bazin",
        models: expect.objectContaining({
          bazin: expect.objectContaining({ price: 40 }),
        }),
      }),
    });
  });

  it("renderiza apenas abas de FII e Manual para Fundos Imobiliários", () => {
    render(
      <CeilingValuationDialog
        open={true}
        onOpenChange={vi.fn()}
        ticker="HGLG11"
        assetClass="FIIs"
        currentPrice={160.0}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Métodos de FII" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Manual" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Graham" })).not.toBeInTheDocument();
  });
});
