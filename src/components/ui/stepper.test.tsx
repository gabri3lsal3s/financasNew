import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stepper } from "./stepper";

describe("Stepper", () => {
  it("renderiza os passos com o atual marcado", () => {
    render(<Stepper steps={["Valor", "Categoria", "Revisão"]} current={2} />);

    expect(screen.getByText("Valor")).toBeInTheDocument();
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Revisão")).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveAttribute("aria-current", "step");
  });
});
