import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmergencyThermometer } from "./emergency-thermometer";

describe("EmergencyThermometer", () => {
  it("renderiza os 3 marcos de reserva com valores corretos", () => {
    render(
      <EmergencyThermometer
        liquidReserveCents={1_200_000} // R$ 12.000
        monthlyExpensesCents={200_000} // R$ 2.000
        monthlySavingsVelocityCents={100_000}
        referenceMonth="2026-08"
      />,
    );

    expect(screen.getByText("Reserva de Emergência & Autonomia")).toBeInTheDocument();
    expect(screen.getByText(/Cobertura atual:/i)).toBeInTheDocument();
    expect(screen.getAllByText("6 meses").length).toBeGreaterThan(0);
    expect(screen.getByText("Adequado")).toBeInTheDocument();

    expect(screen.getByText("3 Meses")).toBeInTheDocument();
    expect(screen.getByText("6 Meses")).toBeInTheDocument();
    expect(screen.getByText("12 Meses")).toBeInTheDocument();
  });

  it("permite abrir o painel de ajustes de premissas e resetar", () => {
    render(
      <EmergencyThermometer
        liquidReserveCents={500_000}
        monthlyExpensesCents={200_000}
        monthlySavingsVelocityCents={50_000}
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: /Ajustar simulação/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Premissas de Cálculo")).toBeInTheDocument();
    expect(screen.getByLabelText("Saldo atual da reserva")).toBeInTheDocument();
    expect(screen.getByLabelText("Custo de vida mensal")).toBeInTheDocument();
    expect(screen.getByLabelText("Aporte mensal para reserva")).toBeInTheDocument();
  });
});
