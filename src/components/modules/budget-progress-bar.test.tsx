import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetProgressBar } from "./budget-progress-bar";

describe("BudgetProgressBar", () => {
  it("calcula o percentual usado e valor restante", () => {
    render(<BudgetProgressBar spentCents={5000} limitCents={10000} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("restante de")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("mostra >100% e valor excedente quando ultrapassa o limite", () => {
    render(<BudgetProgressBar spentCents={12000} limitCents={10000} />);
    expect(screen.getByText(">100%")).toBeInTheDocument();
    expect(screen.getByText("acima do limite")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("trata limite zero sem divisão inválida", () => {
    render(<BudgetProgressBar spentCents={0} limitCents={0} />);
    expect(screen.getByText("Sem limite definido")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
