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

  it("renderiza a pílula única de posicionamento global e a headline de ponta a ponta", () => {
    renderHero();

    expect(
      screen.getByText(
        "Toda sua vida financeira em um só lugar · sem planilhas e sem senhas bancárias",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /Do gasto do dia a dia aos seus investimentos/i,
      }),
    ).toBeInTheDocument();
  });

  it("permite rolar suavemente até o ecossistema ao clicar em Ver como tudo se conecta", async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();

    const mockTarget = document.createElement("div");
    mockTarget.id = "ecossistema";
    mockTarget.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(mockTarget);

    renderHero();

    await user.click(screen.getByRole("button", { name: /Ver como tudo se conecta/i }));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

    document.body.removeChild(mockTarget);
  });

  it("permite ativar o Escudo de Privacidade e expandir a Memória de Cálculo no painel", async () => {
    const user = userEvent.setup();
    renderHero();

    const privacyBtn = screen.getByRole("button", { name: /Escudo de Privacidade/i });
    expect(privacyBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(privacyBtn);
    expect(screen.getByRole("button", { name: /Escudo ativo/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const memoryBtn = screen.getByRole("button", { name: /Memória de cálculo/i });
    expect(memoryBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("hero-calculation-memory")).not.toBeInTheDocument();

    await user.click(memoryBtn);
    expect(memoryBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("hero-calculation-memory")).toBeInTheDocument();
    expect(
      screen.getByText(/Memória de Cálculo · Caixa Real Disponível/i),
    ).toBeInTheDocument();
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
