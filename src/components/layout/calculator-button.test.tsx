import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CalculatorButton } from "./calculator-button";
import { FloatingCalculator } from "@/components/modules/floating-calculator";
import { setCalculatorOpen } from "@/services/calculator-open";

afterEach(() => {
  setCalculatorOpen(false);
});

describe("CalculatorButton — atalho da calculadora no header (pós-F10)", () => {
  beforeEach(() => {
    setCalculatorOpen(false);
  });

  it("é um botão de ícone discreto com title acessível", () => {
    render(
      <header>
        <CalculatorButton />
      </header>,
    );

    const button = within(screen.getByRole("banner")).getByRole("button", { name: "Abrir calculadora" });
    expect(button).toHaveAttribute("title", "Calculadora");
  });

  it("abre o painel da calculadora flutuante ao clicar", async () => {
    const user = userEvent.setup();
    render(
      <>
        <header>
          <CalculatorButton />
        </header>
        <FloatingCalculator />
      </>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const button = within(screen.getByRole("banner")).getByRole("button", { name: "Abrir calculadora" });
    await user.click(button);

    expect(screen.getByRole("dialog")).toHaveTextContent("Calculadora");
  });

  it("o estado vive no store compartilhado (botão e FAB abrem o mesmo painel)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <header>
        <CalculatorButton />
      </header>,
    );
    const button = within(screen.getByRole("banner")).getByRole("button", { name: "Abrir calculadora" });
    await user.click(button);
    unmount();

    // O estado persiste no store — o FloatingCalculator abre ao montar.
    render(<FloatingCalculator />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Calculadora");
  });
});
