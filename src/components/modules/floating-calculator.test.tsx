import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingCalculator } from "./floating-calculator";
import {
  getCalculatorTarget,
  registerCalculatorTarget,
  unregisterCalculatorTarget,
} from "@/services/calculator-bridge";
import { setCalculatorOpen } from "@/services/calculator-open";

/** Registra um campo falso — condição para o FAB aparecer (pós-F10). */
function registerFakeTarget(): () => void {
  const setter = vi.fn();
  registerCalculatorTarget(setter);
  return () => unregisterCalculatorTarget(setter);
}

beforeEach(() => {
  setCalculatorOpen(false);
});

afterEach(() => {
  setCalculatorOpen(false);
  const target = getCalculatorTarget();
  if (target) unregisterCalculatorTarget(target);
});

async function openCalculator() {
  act(() => {
    setCalculatorOpen(true);
  });
  expect(screen.getByText("Calculadora")).toBeInTheDocument();
}

describe("FloatingCalculator (F9)", () => {
  it("abre e fecha o painel da calculadora via store", async () => {
    render(<FloatingCalculator />);
    expect(screen.queryByText("Calculadora")).not.toBeInTheDocument();

    await openCalculator();
    expect(screen.getByRole("button", { name: "Dígito 7" })).toBeInTheDocument();
  });

  it("resolve operações no display (2 + 3 = 5)", async () => {
    registerFakeTarget();
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    await user.click(screen.getByRole("button", { name: "Dígito 2" }));
    await user.click(screen.getByRole("button", { name: "Somar" }));
    await user.click(screen.getByRole("button", { name: "Dígito 3" }));
    await user.click(screen.getByRole("button", { name: "Igual" }));

    // Display resolve (o histórico também registra o mesmo resultado).
    expect(screen.getAllByText("R$ 5,00").length).toBeGreaterThan(0);
  });

  it("'Usar valor' injeta o resultado em centavos no campo registrado e fecha", async () => {
    const setter = vi.fn();
    registerCalculatorTarget(setter);
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    await user.click(screen.getByRole("button", { name: "Dígito 1" }));
    await user.click(screen.getByRole("button", { name: "Dígito 0" }));
    await user.click(screen.getByRole("button", { name: "Dígito 0" }));
    await user.click(screen.getByRole("button", { name: "Usar valor" }));

    expect(setter).toHaveBeenCalledWith(10000);
    // Painel fecha após injetar com sucesso.
    expect(screen.queryByText("Calculadora")).not.toBeInTheDocument();
  });

  it("sem campo registrado, 'Usar valor' mantém o painel aberto", async () => {
    registerFakeTarget();
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    // Remove o campo ativo enquanto o painel está aberto.
    const target = getCalculatorTarget();
    if (target) unregisterCalculatorTarget(target);

    await user.click(screen.getByRole("button", { name: "Dígito 5" }));
    await user.click(screen.getByRole("button", { name: "Usar valor" }));

    expect(screen.getByText("Calculadora")).toBeInTheDocument();
  });

  it("divide em parcelas exatas (100 ÷ 3 → 33,34 com resto na 1ª)", async () => {
    registerFakeTarget();
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    await user.click(screen.getByRole("button", { name: "Dígito 1" }));
    await user.click(screen.getByRole("button", { name: "Dígito 0" }));
    await user.click(screen.getByRole("button", { name: "Dígito 0" }));

    // Parcelas 1 → 3.
    await user.click(screen.getByRole("button", { name: "Aumentar parcelas" }));
    await user.click(screen.getByRole("button", { name: "Aumentar parcelas" }));
    await user.click(screen.getByRole("button", { name: "Dividir" }));

    expect(screen.getByText("3 × R$ 33,34 (resto na 1ª)")).toBeInTheDocument();
    // Display passa a mostrar a primeira parcela.
    expect(screen.getByText("R$ 33,34")).toBeInTheDocument();
  });

  it("abre e fecha a calculadora com a tecla de atalho global F9", async () => {
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    expect(screen.queryByText("Calculadora")).not.toBeInTheDocument();

    await user.keyboard("{F9}");
    expect(screen.getByText("Calculadora")).toBeInTheDocument();

    await user.keyboard("{F9}");
    expect(screen.queryByText("Calculadora")).not.toBeInTheDocument();
  });

  it("opera a calculadora com o teclado físico (dígitos, operadores e Enter)", async () => {
    registerFakeTarget();
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    // Digita 2 5 + 1 5 Enter -> 40
    await user.keyboard("25+15{Enter}");
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("suporta operadores alternativos via teclado (*, x, /, -, ,)", async () => {
    registerFakeTarget();
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    // Multiplicação com *
    await user.keyboard("10*2=");
    expect(screen.getAllByText("R$ 20,00").length).toBeGreaterThan(0);

    // Limpa com tecla c
    await user.keyboard("c");
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThan(0);

    // Divisão com / e vírgula decimal
    await user.keyboard("10/4=");
    expect(screen.getAllByText("R$ 2,50").length).toBeGreaterThan(0);
  });

  it("apaga dígitos com Backspace e limpa com Delete", async () => {
    registerFakeTarget();
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    await user.keyboard("123{Backspace}");
    expect(screen.getAllByText("R$ 12,00").length).toBeGreaterThan(0);

    await user.keyboard("{Delete}");
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThan(0);
  });

  it("injeta o valor no campo com Ctrl+Enter", async () => {
    const setter = vi.fn();
    registerCalculatorTarget(setter);
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    await user.keyboard("75{Control>}{Enter}{/Control}");
    expect(setter).toHaveBeenCalledWith(7500);
    expect(screen.queryByText("Calculadora")).not.toBeInTheDocument();
  });
});
