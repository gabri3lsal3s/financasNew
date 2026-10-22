import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardSubscriptionRadar } from "./card-subscription-radar";
import type { CardSubscriptionImpact } from "@/domain/insights";

describe("CardSubscriptionRadar component", () => {
  const normalImpact: CardSubscriptionImpact = {
    cardId: "card-1",
    cardName: "Nubank",
    closingDay: 10,
    nextClosingDate: "2026-08-10",
    daysUntilClosing: 5,
    totalProjectedCents: 6180, // R$ 61,80
    projectedCount: 2,
    items: [
      { key: "sub:netflix", name: "Netflix", amountCents: 3990, typicalDayOfMonth: 8 },
      { key: "sub:spotify", name: "Spotify", amountCents: 2190, typicalDayOfMonth: 9 },
    ],
    totalLimitCents: 500000,
    availableLimitCents: 300000,
    exceedsAvailableLimit: false,
    overflowCents: 0,
    message: "Você possui R$ 61,80 em assinaturas previstas para este cartão antes do fechamento da fatura",
  };

  const compromisedImpact: CardSubscriptionImpact = {
    ...normalImpact,
    availableLimitCents: 2000, // R$ 20,00
    exceedsAvailableLimit: true,
    overflowCents: 4180,
    warningMessage: "Atenção: o total de assinaturas projetadas (R$ 61,80) supera o limite disponível de R$ 20,00 em R$ 41,80.",
  };

  it("não renderiza nada se o total projetado for zero", () => {
    const zeroImpact: CardSubscriptionImpact = {
      ...normalImpact,
      totalProjectedCents: 0,
      projectedCount: 0,
      items: [],
    };

    const { container } = render(<CardSubscriptionRadar impact={zeroImpact} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza o bloco informativo com o valor total e o nome do cartão", () => {
    render(<CardSubscriptionRadar impact={normalImpact} />);

    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText(/Radar de Assinaturas/i)).toBeInTheDocument();
    expect(
      screen.getByText(/em assinaturas previstas para este cartão antes do fechamento da fatura/i),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 61,80")).toBeInTheDocument();
    expect(screen.getByText(/Fecha dia 10/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("exibe o alerta preventivo quando o total supera o limite disponível", () => {
    render(<CardSubscriptionRadar impact={compromisedImpact} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Alerta de Limite Comprometido")).toBeInTheDocument();
    expect(
      screen.getByText(/supera o limite disponível de R\$ 20,00 em R\$ 41,80/i),
    ).toBeInTheDocument();
  });

  it("permite expandir e recolher a lista detalhada de assinaturas", async () => {
    const user = userEvent.setup();
    render(<CardSubscriptionRadar impact={normalImpact} />);

    const toggleButton = screen.getByRole("button", { name: /Ver 2 assinatura\(s\) mapeada\(s\)/i });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Netflix")).not.toBeInTheDocument();

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("R$ 39,90")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("R$ 21,90")).toBeInTheDocument();

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Netflix")).not.toBeInTheDocument();
  });

  it("chama onIgnoreItem ao clicar no botão de descarte/corte de uma assinatura", async () => {
    const user = userEvent.setup();
    const handleIgnore = vi.fn();

    render(<CardSubscriptionRadar impact={normalImpact} onIgnoreItem={handleIgnore} />);

    // Expande a lista
    await user.click(screen.getByRole("button", { name: /Ver 2 assinatura\(s\) mapeada\(s\)/i }));

    const ignoreButtons = screen.getAllByRole("button", { name: /Já cortei ou desconsiderar/i });
    expect(ignoreButtons).toHaveLength(2);

    await user.click(ignoreButtons[0]!);
    expect(handleIgnore).toHaveBeenCalledWith("sub:netflix");
  });
});
