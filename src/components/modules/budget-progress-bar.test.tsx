import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetProgressBar } from "./budget-progress-bar";

describe("BudgetProgressBar", () => {
  it("calcula o percentual usado", () => {
    render(<BudgetProgressBar spentCents={5000} limitCents={10000} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("mostra o percentual acima de 100% quando ultrapassa o limite", () => {
    render(<BudgetProgressBar spentCents={12000} limitCents={10000} />);
    expect(screen.getByText("120%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("trata limite zero sem divisão inválida", () => {
    render(<BudgetProgressBar spentCents={0} limitCents={0} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
