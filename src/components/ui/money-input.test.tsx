import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./money-input";
import { getCalculatorTarget, unregisterCalculatorTarget } from "@/services/calculator-bridge";

afterEach(() => {
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
});
