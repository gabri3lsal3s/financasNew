import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmergencyFundGauge } from "./emergency-fund-gauge";

describe("EmergencyFundGauge (F24)", () => {
  it("exibe os meses de reserva e o rótulo da faixa", () => {
    render(<EmergencyFundGauge months={6} health="adequado" />);
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Adequado")).toBeInTheDocument();
  });

  it("formata frações com vírgula pt-BR", () => {
    render(<EmergencyFundGauge months={2.5} health="baixo" />);
    expect(screen.getByText("2,5")).toBeInTheDocument();
  });

  it("sem despesa de referência mostra travessão e saudável", () => {
    render(<EmergencyFundGauge months={null} health="saudavel" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Saudável")).toBeInTheDocument();
  });

  it("expõe aria-label acessível", () => {
    render(<EmergencyFundGauge months={6} health="adequado" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/6 meses de reserva/i);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Adequado/);
  });
});
