import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalculatorValuationTab } from "./calculator-valuation-tab";

describe("CalculatorValuationTab — aba de valuation rápido na calculadora flutuante", () => {
  it("renderiza o formulário Bazin por padrão e calcula o preço teto", () => {
    render(<CalculatorValuationTab />);

    expect(screen.getByText("Calculadora de Valuation & Preço Teto")).toBeInTheDocument();
    expect(screen.getByLabelText(/Provento por Ação \(DPA\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Yield Mínimo Desejado/i)).toBeInTheDocument();

    // 3.00 / 0.06 = 50.00
    expect(screen.getByText(/Preço Teto Décio Bazin/i)).toBeInTheDocument();
    expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
  });

  it("permite alternar para o modelo Graham e atualiza o cálculo", async () => {
    const user = userEvent.setup();
    render(<CalculatorValuationTab />);

    const grahamTab = screen.getByRole("tab", { name: "Graham" });
    await user.click(grahamTab);

    expect(screen.getByLabelText(/LPA \(Lucro\/Ação\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/VPA \(Patrimonial\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Margem Seg\. \(%\)/i)).toBeInTheDocument();

    // sqrt(22.5 * 5 * 30) = sqrt(3375) = 58.094... intrinsic = 58.09 * (1 - 0.2) = 46.47
    expect(screen.getByText(/Preço Teto Benjamin Graham/i)).toBeInTheDocument();
    expect(screen.getByText("R$ 46,47")).toBeInTheDocument();
  });

  it("permite alternar para FIIs e calcular por P/VP Alvo", async () => {
    const user = userEvent.setup();
    render(<CalculatorValuationTab />);

    const fiiPvpTab = screen.getByRole("tab", { name: "FII P/VP" });
    await user.click(fiiPvpTab);

    expect(screen.getByLabelText(/Valor Patrimonial por Cota \(VP\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/P\/VP Alvo/i)).toBeInTheDocument();

    // 100 * 1.00 = 100.00
    expect(screen.getByText(/Preço Teto FII por P\/VP Alvo/i)).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();
  });

  it("chama onInjectValue ao clicar no botão quando fornecido", async () => {
    const user = userEvent.setup();
    const handleInject = vi.fn();
    render(<CalculatorValuationTab onInjectValue={handleInject} />);

    const injectButton = screen.getByRole("button", { name: /Usar valor no campo/i });
    await user.click(injectButton);

    expect(handleInject).toHaveBeenCalledWith("50.00");
  });
});
