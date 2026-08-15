import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

function renderTooltip(side?: "top" | "bottom") {
  return render(
    <Tooltip content="Abrir calculadora" side={side}>
      <Button type="button" aria-label="Calculadora">
        Calc
      </Button>
    </Tooltip>,
  );
}

describe("Tooltip (F25)", () => {
  it("vincula o tooltip ao trigger via aria-describedby", () => {
    renderTooltip();
    const button = screen.getByRole("button", { name: "Calculadora" });
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(screen.getByRole("tooltip")).toHaveAttribute("id", describedBy!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Abrir calculadora");
  });

  it("torna o tooltip visível no hover e no foco por teclado", () => {
    renderTooltip();
    const button = screen.getByRole("button", { name: "Calculadora" });
    const tooltip = screen.getByRole("tooltip");

    // Inicialmente oculto (opacity-0 via classe) e sem pointer events.
    expect(tooltip).toHaveClass("opacity-0");

    fireEvent.mouseEnter(button);
    expect(tooltip).toHaveClass("group-hover:opacity-100");

    fireEvent.focus(button);
    expect(tooltip).toHaveClass("group-focus-within:opacity-100");
  });

  it("não intercepta cliques (pointer-events-none)", () => {
    renderTooltip();
    expect(screen.getByRole("tooltip")).toHaveClass("pointer-events-none");
  });

  it("sem violações de acessibilidade (axe)", async () => {
    const { container } = renderTooltip();
    expect(await axe(container)).toHaveNoViolations();
  });
});
