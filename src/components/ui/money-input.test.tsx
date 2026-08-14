import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./money-input";

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
});
