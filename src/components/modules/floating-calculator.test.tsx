import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingCalculator } from "./floating-calculator";
import { registerCalculatorTarget, unregisterCalculatorTarget, getCalculatorTarget } from "@/services/calculator-bridge";

afterEach(() => {
  const target = getCalculatorTarget();
  if (target) unregisterCalculatorTarget(target);
});

async function openCalculator(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Abrir calculadora" }));
  expect(screen.getByText("Calculadora")).toBeInTheDocument();
}

describe("FloatingCalculator (F9)", () => {
  it("o FAB abre o painel da calculadora", async () => {
    const user = userEvent.setup();
    render(<FloatingCalculator />);

    await openCalculator(user);
    expect(screen.getByRole("button", { name: "Dígito 7" })).toBeInTheDocument();
  });

  it("resolve operações no display (2 + 3 = 5)", async () => {
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator(user);

    await user.click(screen.getByRole("button", { name: "Dígito 2" }));
    await user.click(screen.getByRole("button", { name: "Somar" }));
    await user.click(screen.getByRole("button", { name: "Dígito 3" }));
    await user.click(screen.getByRole("button", { name: "Igual" }));

    expect(screen.getByText("R$ 5,00")).toBeInTheDocument();
  });

  it("'Usar valor' injeta o resultado em centavos no campo registrado e fecha", async () => {
    const setter = vi.fn();
    registerCalculatorTarget(setter);
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator(user);

    await user.click(screen.getByRole("button", { name: "Dígito 1" }));
    await user.click(screen.getByRole("button", { name: "Dígito 0" }));
    await user.click(screen.getByRole("button", { name: "Dígito 0" }));
    await user.click(screen.getByRole("button", { name: "Usar valor" }));

    expect(setter).toHaveBeenCalledWith(10000);
    // Painel fecha após injetar com sucesso.
    expect(screen.queryByText("Calculadora")).not.toBeInTheDocument();
  });

  it("sem campo registrado, 'Usar valor' mantém o painel aberto", async () => {
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator(user);

    await user.click(screen.getByRole("button", { name: "Dígito 5" }));
    await user.click(screen.getByRole("button", { name: "Usar valor" }));

    expect(screen.getByText("Calculadora")).toBeInTheDocument();
  });

  it("divide em parcelas exatas (100 ÷ 3 → 33,34 com resto na 1ª)", async () => {
    const user = userEvent.setup();
    render(<FloatingCalculator />);
    await openCalculator(user);

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
});
