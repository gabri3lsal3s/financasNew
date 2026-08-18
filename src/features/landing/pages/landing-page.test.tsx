import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/app/theme-provider";
import { LandingPage } from "@/features/landing";

describe("LandingPage", () => {
  const renderLanding = () => {
    return render(
      <ThemeProvider>
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      </ThemeProvider>,
    );
  };

  it("renderiza o cabeçalho com o logo e CTAs de navegação", () => {
    renderLanding();
    expect(screen.getAllByText("Guia Financeiro").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Começar grátis/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Entrar/i }).length).toBeGreaterThan(0);
  });

  it("renderiza a seção Hero com o título principal e showcase", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /O controle financeiro que você queria/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sessão Protegida")).toBeInTheDocument();
  });

  it("renderiza a seção de recursos com os pilares de produto", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /Tudo o que você precisa para assumir o controle/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cartões & Faturas Sem Surpresas")).toBeInTheDocument();
    expect(screen.getByText("Rebalanceamento Inteligente de Carteira")).toBeInTheDocument();
    expect(screen.getAllByText("Simulador de Independência FIRE").length).toBeGreaterThan(0);
  });

  it("permite interagir com o Simulador FIRE e recalcular valores", async () => {
    const user = userEvent.setup();
    renderLanding();

    const aporteButton = screen.getByRole("button", { name: "R$ 3.0k" });
    await user.click(aporteButton);

    expect(screen.getByText("Regra 4% FIRE")).toBeInTheDocument();
    expect(screen.getByText("Renda Passiva Mensal Vitalícia (FIRE):")).toBeInTheDocument();
  });

  it("renderiza a tabela de preços com alternador Mensal/Anual", async () => {
    const user = userEvent.setup();
    renderLanding();

    expect(screen.getByText("Plano Gratuito")).toBeInTheDocument();
    expect(screen.getByText("Plano Pro")).toBeInTheDocument();

    const mensalToggle = screen.getByRole("button", { name: "Mensal" });
    await user.click(mensalToggle);

    expect(screen.getByText("R$ 19,90")).toBeInTheDocument();
  });

  it("permite expandir e fechar dúvidas no FAQ", async () => {
    const user = userEvent.setup();
    renderLanding();

    const faqButton = screen.getByRole("button", {
      name: /Como funciona o rebalanceamento de carteira de investimentos/i,
    });
    await user.click(faqButton);

    expect(
      screen.getByText(/Você define suas metas percentuais ideais para cada classe/i),
    ).toBeInTheDocument();
  });
});
