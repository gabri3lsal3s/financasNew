import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./money-input";
import {
  getActiveTargetCents,
  getCalculatorTarget,
  injectCalculatedValue,
  unregisterCalculatorTarget,
} from "@/services/calculator-bridge";
import { isCalculatorOpen, setCalculatorOpen } from "@/services/calculator-open";

afterEach(() => {
  setCalculatorOpen(false);
  const target = getCalculatorTarget();
  if (target) unregisterCalculatorTarget(target);
});

describe("MoneyInput (padrão Nubank)", () => {
  it("exibe R$ 0,00 por padrão", () => {
    render(<MoneyInput aria-label="Valor" />);
    const input = screen.getByLabelText("Valor") as HTMLInputElement;
    expect(input).toHaveValue("R$\u00a00,00");
  });

  it("digitar move os dígitos para os centavos e notifica em centavos", () => {
    const onCentsChange = vi.fn();
    render(<MoneyInput aria-label="Valor" onCentsChange={onCentsChange} />);
    const input = screen.getByLabelText("Valor") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "R$\u00a015,00" } });
    expect(onCentsChange).toHaveBeenLastCalledWith(1500);

    fireEvent.change(input, { target: { value: "R$\u00a01,50" } });
    expect(onCentsChange).toHaveBeenLastCalledWith(150);
  });

  it("reflete o valor controlado (cents) na formatação exibida", () => {
    render(<MoneyInput cents={1500} aria-label="Valor" />);
    const input = screen.getByLabelText("Valor") as HTMLInputElement;
    expect(input).toHaveValue("R$\u00a015,00");
  });

  it("registra o campo no MOUNT (FAB aparece ao abrir o modal) e desregistra no unmount", () => {
    const { unmount } = render(<MoneyInput aria-label="Valor" />);

    // Sem foco: já registrado — o FAB aparece assim que o modal abre.
    expect(getCalculatorTarget()).not.toBeNull();

    // O foco re-registra o alvo (continua ativo).
    const input = screen.getByLabelText("Valor") as HTMLInputElement;
    fireEvent.focus(input);
    expect(getCalculatorTarget()).not.toBeNull();

    // Fecha o modal → o campo desmonta → o alvo da calculadora é limpo,
    // fazendo o FAB desaparecer.
    unmount();
    expect(getCalculatorTarget()).toBeNull();
  });

  it("expõe o valor em centavos para a calculadora e atualiza via injectCalculatedValue", () => {
    render(<MoneyInput cents={25000} aria-label="Valor da Conta" />);
    const input = screen.getByLabelText("Valor da Conta") as HTMLInputElement;
    fireEvent.focus(input);

    expect(getActiveTargetCents()).toBe(25000);

    // Injeta um novo valor calculado pela calculadora
    act(() => {
      injectCalculatedValue(32000);
    });
    expect(input).toHaveValue("R$\u00a0320,00");
    expect(getActiveTargetCents()).toBe(32000);
  });

  it("renderiza botão de ação da calculadora quando showCalculatorAction for true", async () => {
    const user = userEvent.setup();
    render(<MoneyInput cents={1000} aria-label="Valor com Botão" showCalculatorAction />);

    const button = screen.getByRole("button", { name: "Abrir calculadora para este campo" });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(isCalculatorOpen()).toBe(true);
    expect(getActiveTargetCents()).toBe(1000);
  });

  it("suporta moeda USD com formatação em dólar e placeholder correto", () => {
    render(<MoneyInput aria-label="Preço em Dólar" currency="USD" cents={6520} />);
    const input = screen.getByLabelText("Preço em Dólar") as HTMLInputElement;
    expect(input).toHaveValue("US$\u00a065,20");
    expect(input).toHaveAttribute("placeholder", "US$ 0,00");
  });

  it("suporta moeda USD zerada exibindo US$ 0,00", () => {
    render(<MoneyInput aria-label="Preço em Dólar Zerado" currency="USD" cents={0} />);
    const input = screen.getByLabelText("Preço em Dólar Zerado") as HTMLInputElement;
    expect(input).toHaveValue("US$\u00a00,00");
  });
});
