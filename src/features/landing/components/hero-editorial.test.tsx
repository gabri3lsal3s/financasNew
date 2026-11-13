import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { HeroEditorial } from "./hero-editorial";

describe("HeroEditorial", () => {
  const renderHero = () => {
    return render(
      <MemoryRouter>
        <HeroEditorial />
      </MemoryRouter>,
    );
  };

  it("renderiza o badge principal e as tags/pílulas de destaque no topo", () => {
    renderHero();

    expect(
      screen.getByText("Controle Financeiro Real · Faturas, Cobranças e Aportes sem Planilhas"),
    ).toBeInTheDocument();

    const pillRacha = screen.getByTestId("hero-pill-racha");
    const pillFamilia = screen.getByTestId("hero-pill-family");

    expect(pillRacha).toBeInTheDocument();
    expect(pillRacha).toHaveTextContent("Racha com Pix");
    expect(pillRacha).toHaveAttribute("href", "#financas-compartilhadas");

    expect(pillFamilia).toBeInTheDocument();
    expect(pillFamilia).toHaveTextContent("Modo Família");
    expect(pillFamilia).toHaveAttribute("href", "#financas-compartilhadas");
  });

  it("permite rolar suavemente até o elemento ao clicar nas pílulas de destaque", async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();

    // Mock de elemento no DOM
    const mockTarget = document.createElement("div");
    mockTarget.id = "financas-compartilhadas";
    mockTarget.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(mockTarget);

    renderHero();

    await user.click(screen.getByTestId("hero-pill-racha"));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

    scrollIntoViewMock.mockClear();
    await user.click(screen.getByTestId("hero-pill-family"));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

    document.body.removeChild(mockTarget);
  });

  it("renderiza os dados de métricas simuladas no mockup (Caixa Real, Ritmo Diário e Aporte)", () => {
    renderHero();

    expect(screen.getByText("Caixa Real Disponível")).toBeInTheDocument();
    expect(screen.getByText("R$ 6.240,00")).toBeInTheDocument();

    expect(screen.getByText("Ritmo Diário")).toBeInTheDocument();
    expect(screen.getByText("R$ 148,00")).toBeInTheDocument();

    expect(screen.getByText("Aporte Calibrado do Mês")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
  });

  it("renderiza o botão principal de CTA direcionando para degustação gratuita (30 dias)", () => {
    renderHero();

    const ctaButton = screen.getByRole("link", { name: /Começar 30 Dias Grátis/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute("href", "/cadastro");
  });
});
