import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformsTriptychCard } from "./platforms-triptych-card";

describe("PlatformsTriptychCard", () => {
  it("renderiza o título padrão e os 3 formatos do Tripé", () => {
    render(<PlatformsTriptychCard activePlatform="web_desktop" />);

    expect(screen.getByText("O Tripé de Plataformas: Web, PWA e Android Pro")).toBeInTheDocument();
    expect(screen.getByText("Web Desktop")).toBeInTheDocument();
    expect(screen.getByText("Mobile PWA")).toBeInTheDocument();
    expect(screen.getByText("Android Pro Nativo")).toBeInTheDocument();
  });

  it("destaca Web Desktop quando for a plataforma ativa", () => {
    const { container } = render(<PlatformsTriptychCard activePlatform="web_desktop" />);

    const webCard = container.querySelector('[data-platform="web_desktop"]');
    const mobileCard = container.querySelector('[data-platform="mobile_pwa"]');
    const androidCard = container.querySelector('[data-platform="android_pro"]');

    expect(webCard).toHaveAttribute("data-active", "true");
    expect(mobileCard).toHaveAttribute("data-active", "false");
    expect(androidCard).toHaveAttribute("data-active", "false");

    expect(screen.getByText("Em uso")).toBeInTheDocument();
    expect(webCard).toContainElement(screen.getByText("Em uso"));
  });

  it("destaca Mobile PWA quando for a plataforma ativa", () => {
    const { container } = render(<PlatformsTriptychCard activePlatform="mobile_pwa" />);

    const mobileCard = container.querySelector('[data-platform="mobile_pwa"]');
    expect(mobileCard).toHaveAttribute("data-active", "true");
    expect(mobileCard).toContainElement(screen.getByText("Em uso"));
  });

  it("destaca Android Pro Nativo quando for a plataforma ativa", () => {
    const { container } = render(<PlatformsTriptychCard activePlatform="android_pro" />);

    const androidCard = container.querySelector('[data-platform="android_pro"]');
    expect(androidCard).toHaveAttribute("data-active", "true");
    expect(androidCard).toContainElement(screen.getByText("Em uso"));
  });

  it("permite customização de título e subtítulo", () => {
    render(
      <PlatformsTriptychCard
        title="O Tripé de Plataformas do Axir"
        subtitle="Acesso simultâneo aos 3 formatos sem custo extra."
      />,
    );

    expect(screen.getByText("O Tripé de Plataformas do Axir")).toBeInTheDocument();
    expect(screen.getByText("Acesso simultâneo aos 3 formatos sem custo extra.")).toBeInTheDocument();
  });
});
