import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreditCardWallet } from "./credit-card-wallet";
import type { CreditCard } from "@/types";

const mockCards: CreditCard[] = [
  {
    id: "card-1",
    user_id: "user-1",
    name: "Nomad Global",
    brand: "Visa",
    credit_limit: 5000,
    color: "#232323",
    closing_day: 8,
    due_day: 15,
    is_active: true,
  },
  {
    id: "card-2",
    user_id: "user-1",
    name: "Rico Investimentos",
    brand: "Visa",
    credit_limit: 10000,
    color: "#FF4500",
    closing_day: 10,
    due_day: 20,
    is_active: true,
  },
];

describe("CreditCardWallet — Carrossel e Navegação Responsiva", () => {
  it("renderiza a carteira com o cartão selecionado e os chips dos cartões", () => {
    const onSelectCard = vi.fn();

    render(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-1"
        onSelectCard={onSelectCard}
        usedLimitMap={{ "card-1": 139900 }}
      />,
    );

    expect(screen.getByText("Sua Carteira")).toBeInTheDocument();
    expect(screen.getByText("(1/2)")).toBeInTheDocument();
    expect(screen.getAllByText("Nomad Global").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Rico Investimentos" })).toBeInTheDocument();
  });

  it("oculta as setas laterais no mobile (classe hidden sm:flex)", () => {
    render(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-1"
        onSelectCard={vi.fn()}
      />,
    );

    const prevButton = screen.getByRole("button", { name: "Cartão anterior" });
    const nextButton = screen.getByRole("button", { name: "Próximo cartão" });

    expect(prevButton).toHaveClass("hidden", "sm:flex");
    expect(nextButton).toHaveClass("hidden", "sm:flex");
  });

  it("permite alternar de cartão clicando diretamente no chip correspondente", () => {
    const onSelectCard = vi.fn();

    render(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-1"
        onSelectCard={onSelectCard}
      />,
    );

    const ricoChip = screen.getByRole("button", { name: "Rico Investimentos" });
    fireEvent.click(ricoChip);

    expect(onSelectCard).toHaveBeenCalledWith("card-2");
  });

  it("suporta navegação por swipe touch no mobile", () => {
    const onSelectCard = vi.fn();

    const { container } = render(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-1"
        onSelectCard={onSelectCard}
      />,
    );

    const walletContainer = container.firstElementChild as HTMLElement;

    // Simula swipe para a esquerda (próximo cartão)
    fireEvent.touchStart(walletContainer, {
      touches: [{ clientX: 200 }],
    });
    fireEvent.touchEnd(walletContainer, {
      changedTouches: [{ clientX: 100 }],
    });

    expect(onSelectCard).toHaveBeenCalledWith("card-2");
  });

  it("aplica classe de animação direcional animate-card-slide-left ao avançar", () => {
    const { rerender, container } = render(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-1"
        onSelectCard={vi.fn()}
      />,
    );

    const nextButton = screen.getByRole("button", { name: "Próximo cartão" });
    fireEvent.click(nextButton);

    rerender(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-2"
        onSelectCard={vi.fn()}
      />,
    );

    const animatedWrapper = container.querySelector(".animate-card-slide-left");
    expect(animatedWrapper).toBeInTheDocument();
  });

  it("aplica classe de animação direcional animate-card-slide-right ao retroceder", () => {
    const { rerender, container } = render(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-2"
        onSelectCard={vi.fn()}
      />,
    );

    const prevButton = screen.getByRole("button", { name: "Cartão anterior" });
    fireEvent.click(prevButton);

    rerender(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-1"
        onSelectCard={vi.fn()}
      />,
    );

    const animatedWrapper = container.querySelector(".animate-card-slide-right");
    expect(animatedWrapper).toBeInTheDocument();
  });

  it("exibe badge de Principal no cartão selecionado quando for o cartão principal", () => {
    render(
      <CreditCardWallet
        cards={mockCards}
        selectedCardId="card-1"
        primaryCardId="card-1"
        onSelectCard={vi.fn()}
      />,
    );

    expect(screen.getByText("Principal")).toBeInTheDocument();
  });
});

