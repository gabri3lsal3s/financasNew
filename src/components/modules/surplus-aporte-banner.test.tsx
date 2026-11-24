import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SurplusAporteBanner } from "./surplus-aporte-banner";

const navigateMock = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

describe("SurplusAporteBanner (§F50 / Fase 3)", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("renderiza o banner com a sobra disponível no modo portfolio_aporte", () => {
    render(<SurplusAporteBanner surplusCents={150000} />);

    expect(screen.getByText("Capacidade de Aporte Estimada")).toBeInTheDocument();
    expect(document.body.textContent?.replace(/\u00a0/g, " ")).toContain("1.500,00");
    expect(screen.getByRole("button", { name: /Simular Aporte/i })).toBeInTheDocument();
  });

  it("navega para /investments?tab=aporte&valor=150000 ao clicar em Simular Aporte", () => {
    render(<SurplusAporteBanner surplusCents={150000} />);

    const button = screen.getByRole("button", { name: /Simular Aporte/i });
    fireEvent.click(button);

    expect(navigateMock).toHaveBeenCalledWith("/investments?tab=aporte&valor=150000");
  });

  it("prioriza Reserva de Emergência quando allocationIntent = emergency_fund e navega para /insights?aba=projection", () => {
    render(
      <SurplusAporteBanner
        surplusCents={100000}
        allocationIntent="emergency_fund"
        emergencyMonthsCovered={2}
        emergencyTargetMonths={6}
      />,
    );

    expect(screen.getByText("Reforçar Reserva de Emergência")).toBeInTheDocument();
    expect(screen.getByText("2,0m / 6m")).toBeInTheDocument();
    expect(document.body.textContent?.replace(/\u00a0/g, " ")).toContain("1.000,00");

    const button = screen.getByRole("button", { name: /Ver Reserva/i });
    fireEvent.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/insights?aba=projection");
  });

  it("não renderiza nada quando surplusCents <= 0", () => {
    const { container } = render(<SurplusAporteBanner surplusCents={0} />);
    expect(container.firstChild).toBeNull();
  });
});
