import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SnowballActionCard } from "./snowball-action-card";
import type { ReinvestmentOpportunity } from "@/domain/portfolio";

describe("SnowballActionCard (§F50)", () => {
  const mockOpportunities: ReinvestmentOpportunity[] = [
    {
      assetId: "a1",
      ticker: "MXRF11",
      currentPrice: 10.5,
      monthDividends: 52.5,
      purchasableShares: 5,
      totalReinvestmentValue: 52.5,
      leftoverDividends: 0.0,
    },
  ];

  it("renderiza o card com as oportunidades da bola de neve", () => {
    const onReinvest = vi.fn();
    render(
      <SnowballActionCard
        opportunities={mockOpportunities}
        onReinvest={onReinvest}
      />,
    );

    expect(screen.getByText("Efeito Bola de Neve em Ação")).toBeInTheDocument();
    expect(screen.getByText("MXRF11")).toBeInTheDocument();
    expect(screen.getByText("+5 cotas")).toBeInTheDocument();
    expect(screen.getByText("R$ 52,50")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Reinvestir Provento/i });
    fireEvent.click(button);
    expect(onReinvest).toHaveBeenCalledWith(mockOpportunities[0]);
  });

  it("não renderiza nada quando opportunities é vazio", () => {
    const { container } = render(
      <SnowballActionCard opportunities={[]} onReinvest={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
