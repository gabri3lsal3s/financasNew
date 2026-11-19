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
import * as calculatorOpenModule from "@/services/calculator-open";

afterEach(() => {
  const target = getCalculatorTarget();
  if (target) unregisterCalculatorTarget(target);
  vi.restoreAllMocks();
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

  it("registra o alvo e chama setCalculatorOpen(true) ao clicar no ícone sem foco prévio", () => {
    const openSpy = vi.spyOn(calculatorOpenModule, "setCalculatorOpen");
    render(
      <NumericInput
        value="25.5"
        onValueChange={vi.fn()}
        aria-label="Cotas FII"
        showCalculatorAction
      />,
    );

    expect(hasActiveTarget()).toBe(false);
    fireEvent.click(screen.getByLabelText("Abrir calculadora"));

    expect(hasActiveTarget()).toBe(true);
    expect(getActiveDecimalDisplay()).toBe("25.5");
    expect(openSpy).toHaveBeenCalledWith(true);
  });

  it("permite digitar vírgula e valores decimais sem que a vírgula seja apagada", () => {
    const handleNumberChange = vi.fn();
    const handleValueChange = vi.fn();

    const { rerender } = render(
      <NumericInput
        value={null}
        onValueChange={handleValueChange}
        onNumberChange={handleNumberChange}
        placeholder="Ex: 5,2500"
      />,
    );

    const input = screen.getByPlaceholderText("Ex: 5,2500") as HTMLInputElement;
    fireEvent.focus(input);

    // Digita '5'
    fireEvent.change(input, { target: { value: "5" } });
    expect(input.value).toBe("5");
    expect(handleNumberChange).toHaveBeenCalledWith(5);

    // Simula re-render do componente pai com o novo estado numérico
    rerender(
      <NumericInput
        value={5}
        onValueChange={handleValueChange}
        onNumberChange={handleNumberChange}
        placeholder="Ex: 5,2500"
      />,
    );
    expect(input.value).toBe("5");

    // Digita a vírgula ',' -> "5,"
    fireEvent.change(input, { target: { value: "5," } });
    expect(input.value).toBe("5,");
    expect(handleNumberChange).toHaveBeenCalledWith(5);

    // Simula re-render do pai com value={5} (pois 5, ainda é 5 numericamente)
    rerender(
      <NumericInput
        value={5}
        onValueChange={handleValueChange}
        onNumberChange={handleNumberChange}
        placeholder="Ex: 5,2500"
      />,
    );
    // A VÍRGULA DEVE PERMANECER NO INPUT!
    expect(input.value).toBe("5,");

    // Digita '2' -> "5,2"
    fireEvent.change(input, { target: { value: "5,2" } });
    expect(input.value).toBe("5,2");
    expect(handleNumberChange).toHaveBeenCalledWith(5.2);

    rerender(
      <NumericInput
        value={5.2}
        onValueChange={handleValueChange}
        onNumberChange={handleNumberChange}
        placeholder="Ex: 5,2500"
      />,
    );
    expect(input.value).toBe("5,2");

    // Digita '500' -> "5,2500"
    fireEvent.change(input, { target: { value: "5,2500" } });
    expect(input.value).toBe("5,2500");
    expect(handleNumberChange).toHaveBeenCalledWith(5.25);

    rerender(
      <NumericInput
        value={5.25}
        onValueChange={handleValueChange}
        onNumberChange={handleNumberChange}
        placeholder="Ex: 5,2500"
      />,
    );
    // Zeros à direita preservados enquanto o usuário digita
    expect(input.value).toBe("5,2500");
  });

  it("formata valor numérico prop para exibição amigável pt-BR com vírgula", () => {
    render(<NumericInput value={5.25} onValueChange={vi.fn()} placeholder="Ex: 5,2500" />);
    const input = screen.getByPlaceholderText("Ex: 5,2500") as HTMLInputElement;
    expect(input.value).toBe("5,25");
  });

  it("respeita maxDecimals limitando as casas decimais", () => {
    const handleValueChange = vi.fn();
    render(
      <NumericInput
        value={null}
        onValueChange={handleValueChange}
        maxDecimals={2}
        placeholder="Ex: 22,5"
      />,
    );

    const input = screen.getByPlaceholderText("Ex: 22,5") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "22,555" } });
    expect(input.value).toBe("22,55");
    expect(handleValueChange).toHaveBeenCalledWith("22,55");
  });

  it("normaliza vírgula solta ao perder foco (onBlur)", () => {
    const handleBlur = vi.fn();
    render(<NumericInput value={null} onBlur={handleBlur} placeholder="Ex: 5,2500" />);

    const input = screen.getByPlaceholderText("Ex: 5,2500") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5," } });
    expect(input.value).toBe("5,");

    fireEvent.blur(input);
    expect(input.value).toBe("5");
    expect(handleBlur).toHaveBeenCalled();
  });

  it("sincroniza display quando o valor prop muda externamente para outro número", () => {
    const { rerender } = render(<NumericInput value={5.25} placeholder="Ex: 5,2500" />);
    const input = screen.getByPlaceholderText("Ex: 5,2500") as HTMLInputElement;
    expect(input.value).toBe("5,25");

    rerender(<NumericInput value={6.1} placeholder="Ex: 5,2500" />);
    expect(input.value).toBe("6,1");

    rerender(<NumericInput value={null} placeholder="Ex: 5,2500" />);
    expect(input.value).toBe("");
  });
});
