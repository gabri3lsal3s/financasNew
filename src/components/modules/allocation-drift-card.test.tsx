import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AllocationDriftCard } from "./allocation-drift-card";
import type { AllocationDriftAnalysis } from "@/domain/portfolio";

const navigateMock = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

describe("AllocationDriftCard (§F52)", () => {
  const unbalancedAnalysis: AllocationDriftAnalysis = {
    hasTargets: true,
    totalPortfolioCents: 1000000,
    tolerancePercent: 5,
    isBalanced: false,
    maxDriftPercent: 20,
    underweightItems: [
      {
        id: "fiis",
        name: "FIIs",
        currentValueCents: 200000,
        currentPercent: 20,
        targetPercent: 40,
        diffPercent: -20,
        diffCents: -200000,
        status: "underweight",
        recommendedAporteCents: 200000,
      },
    ],
    overweightItems: [],
    items: [],
  };

  it("renderiza o card com aviso de desvio e botão de simulação", () => {
    render(<AllocationDriftCard analysis={unbalancedAnalysis} />);

    expect(screen.getByText("Desvio de Alocação Detectado")).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Simular Rebalanceamento/i });
    fireEvent.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/carteira?tab=aporte");
  });

  it("renderiza estado balanceado quando não há desvios", () => {
    render(
      <AllocationDriftCard
        analysis={{
          ...unbalancedAnalysis,
          isBalanced: true,
          underweightItems: [],
          overweightItems: [],
        }}
      />,
    );

    expect(screen.getByText("Carteira Balanceada")).toBeInTheDocument();
    expect(screen.getByText("Em conformidade")).toBeInTheDocument();
  });

  it("não renderiza nada quando não há metas configuradas", () => {
    const { container } = render(
      <AllocationDriftCard
        analysis={{
          ...unbalancedAnalysis,
          hasTargets: false,
        }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
