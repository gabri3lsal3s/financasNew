import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumericInput } from "./numeric-input";
import {
  getActiveDecimalDisplay,
  getActiveTargetLabel,
  getCalculatorTarget,
  hasActiveTarget,
  injectDecimalValue,
  unregisterCalculatorTarget,
} from "@/services/calculator-bridge";

afterEach(() => {
  const target = getCalculatorTarget();
  if (target) unregisterCalculatorTarget(target);
});

describe("NumericInput", () => {
  it("renderiza o valor inicial e emite onValueChange ao digitar", () => {
    const handleChange = vi.fn();
    render(<NumericInput value="270" onValueChange={handleChange} placeholder="100" />);

    const input = screen.getByPlaceholderText("100") as HTMLInputElement;
    expect(input.value).toBe("270");

    fireEvent.change(input, { target: { value: "285.5" } });
    expect(handleChange).toHaveBeenCalledWith("285.5");
  });

  it("registra alvo no calculator-bridge ao receber foco e desregistra no unmount", () => {
    const handleChange = vi.fn();
    const { unmount } = render(
      <NumericInput
        value="150"
        onValueChange={handleChange}
        aria-label="Quantidade de cotas"
      />,
    );

    const input = screen.getByLabelText("Quantidade de cotas");
    fireEvent.focus(input);

    expect(hasActiveTarget()).toBe(true);
    expect(getActiveDecimalDisplay()).toBe("150");
    expect(getActiveTargetLabel()).toBe("Quantidade de cotas");

    unmount();
    expect(hasActiveTarget()).toBe(false);
  });

  it("permite injeção de display da calculadora no campo", () => {
    const handleChange = vi.fn();
    render(
      <NumericInput
        value="10"
        onValueChange={handleChange}
        aria-label="Qtd Ativo"
      />,
    );

    const input = screen.getByLabelText("Qtd Ativo");
    fireEvent.focus(input);

    const success = injectDecimalValue("42.75");
    expect(success).toBe(true);
    expect(handleChange).toHaveBeenCalledWith("42.75");
  });

  it("renderiza botão de ação da calculadora quando showCalculatorAction é true", () => {
    const handleOpen = vi.fn();
    render(
      <NumericInput
        value="100"
        onValueChange={vi.fn()}
        showCalculatorAction
        onCalculatorOpen={handleOpen}
      />,
    );

    const btn = screen.getByLabelText("Abrir calculadora");
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });
});
