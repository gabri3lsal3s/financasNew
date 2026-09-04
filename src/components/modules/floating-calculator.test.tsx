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

  it("abre carregando o valor atual do input ativo e permite somar sobre ele", async () => {
    const inject = vi.fn();
    const getCents = vi.fn(() => 15000); // R$ 150,00
    registerCalculatorTarget({ inject, getCents, label: "Valor Original" });

    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    // Badge exibe o campo conectado
    expect(screen.getByText("Campo: Valor Original")).toBeInTheDocument();

    // Display já deve ter aberto com R$ 150,00
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();

    // Soma + 50 =
    await user.click(screen.getByRole("button", { name: "Somar" }));
    await user.click(screen.getByRole("button", { name: "Dígito 5" }));
    await user.click(screen.getByRole("button", { name: "Dígito 0" }));
    await user.click(screen.getByRole("button", { name: "Igual" }));

    // Resultado: R$ 200,00
    expect(screen.getAllByText("R$ 200,00").length).toBeGreaterThan(0);

    // Clica em Usar valor e verifica que injetou 20000 centavos
    await user.click(screen.getByRole("button", { name: "Usar valor" }));
    expect(inject).toHaveBeenCalledWith(20000);
  });

  it("divide em parcelas diretamente a partir do valor carregado do input", async () => {
    const inject = vi.fn();
    const getCents = vi.fn(() => 30000); // R$ 300,00
    registerCalculatorTarget({ inject, getCents });

    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    expect(screen.getByText("Conectado ao campo")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();

    // Divide em 3 parcelas
    await user.click(screen.getByRole("button", { name: "Aumentar parcelas" }));
    await user.click(screen.getByRole("button", { name: "Aumentar parcelas" }));
    await user.click(screen.getByRole("button", { name: "Dividir" }));

    expect(screen.getByText("3 × R$ 100,00 (resto na 1ª)")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();
  });

  it("exibe badge de calculadora livre quando não há alvo conectado", async () => {
    render(<FloatingCalculator />);
    await openCalculator();

    expect(screen.getByText("Calculadora livre")).toBeInTheDocument();
  });

  it("hidrata com valor decimal e injeta string diretamente sem centavos em alvo decimal", async () => {
    const injectDecimal = vi.fn();
    const getDecimalDisplay = vi.fn(() => "270");
    registerCalculatorTarget({
      mode: "decimal",
      injectDecimal,
      getDecimalDisplay,
      label: "Quantidade de cotas",
    });

    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator();

    // Badge com Hash e label correto
    expect(screen.getByText("Campo: Quantidade de cotas")).toBeInTheDocument();

    // Display exibe "270" sem símbolo de R$
    expect(screen.getByText("270")).toBeInTheDocument();
    expect(screen.getByText("Número decimal")).toBeInTheDocument();

    // Multiplica por 2: 270 * 2 = 540
    await user.click(screen.getByRole("button", { name: "Multiplicação" }));
    await user.click(screen.getByRole("button", { name: "Dígito 2" }));
    await user.click(screen.getByRole("button", { name: "Igual" }));

    expect(screen.getByText("540")).toBeInTheDocument();

    // Injeta de volta no campo
    await user.click(screen.getByRole("button", { name: "Usar valor" }));
    expect(injectDecimal).toHaveBeenCalledWith("540");
    expect(screen.queryByText("Calculadora")).not.toBeInTheDocument();
  });
});
