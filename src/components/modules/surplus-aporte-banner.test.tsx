import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SurplusAporteBanner } from "./surplus-aporte-banner";

const navigateMock = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

describe("SurplusAporteBanner (§F50)", () => {
  it("renderiza o banner com a sobra disponível quando surplusCents > 0", () => {
    render(<SurplusAporteBanner surplusCents={150000} />);

    expect(screen.getByText("Capacidade de Aporte Estimada")).toBeInTheDocument();
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Simular Aporte/i })).toBeInTheDocument();
  });

  it("navega para /carteira?tab=aporte&valor=150000 ao clicar em Simular Aporte", () => {
    render(<SurplusAporteBanner surplusCents={150000} />);

    const button = screen.getByRole("button", { name: /Simular Aporte/i });
    fireEvent.click(button);

    expect(navigateMock).toHaveBeenCalledWith("/carteira?tab=aporte&valor=150000");
  });

  it("não renderiza nada quando surplusCents <= 0", () => {
    const { container } = render(<SurplusAporteBanner surplusCents={0} />);
    expect(container.firstChild).toBeNull();
  });
});
