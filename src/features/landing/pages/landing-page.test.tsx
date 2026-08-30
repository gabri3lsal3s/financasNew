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

  it("renderiza a seção Hero Editorial com headline e métricas de caixa real", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /O controle financeiro que você queria/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sessão Protegida/i)).toBeInTheDocument();
    expect(screen.getAllByText("Caixa Real Disponível").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ritmo Diário/i).length).toBeGreaterThan(0);
  });

  it("renderiza as histórias editoriais do produto (Caixa Real, Cartões e Aportes)", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Projetado para transformar o modo como você cuida do seu patrimônio/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/O fim da ilusão de saldo e da ansiedade de fim de mês/i)).toBeInTheDocument();
    expect(screen.getByText(/Nunca mais seja pego de surpresa por parcelas esquecidas/i)).toBeInTheDocument();
    expect(screen.getByText(/Alocação matemática de aportes e blindagem contra impostos/i)).toBeInTheDocument();
  });

  it("renderiza a vitrine de investimentos com os 6 cards de inteligência fiscal", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Inteligência de Investimentos e Gestão Fiscal de Nível Bancário/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Motor de Rebalanceamento de Aportes")).toBeInTheDocument();
    expect(screen.getByText("Radar de Otimização Fiscal de IR")).toBeInTheDocument();
    expect(screen.getByText("Monitor e Apuração de DARF")).toBeInTheDocument();
    expect(screen.getByText("Dossiês & Exportação Excel (.xlsx)")).toBeInTheDocument();
  });

  it("permite interagir com o Simulador de Carteira com Allocation Donut e recalcular valores", async () => {
    const user = userEvent.setup();
    renderLanding();

    expect(screen.getByText("Simulador de Carteira & Aportes Inteligentes")).toBeInTheDocument();
    expect(screen.getByText("Composição da Carteira")).toBeInTheDocument();

    const aporte6k = screen.getByRole("button", { name: "R$ 6k" });
    await user.click(aporte6k);

    expect(screen.getByText(/Direcionamento Recomendado para R\$ 6.000/i)).toBeInTheDocument();

    const globalStrategy = screen.getByRole("button", { name: "Global" });
    await user.click(globalStrategy);

    expect(screen.getAllByText("Ativos Globais / Dólar")[0]).toBeInTheDocument();
  });

  it("renderiza a tabela de preços com alternador Mensal/Anual", async () => {
    const user = userEvent.setup();
    renderLanding();

    expect(screen.getByText("Teste de 30 Dias")).toBeInTheDocument();
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

  it("permite abrir e fechar o modal de Termos de Serviço e LGPD pelo rodapé", async () => {
    const user = userEvent.setup();
    renderLanding();

    const termosButton = screen.getByRole("button", { name: "Termos de Serviço" });
    await user.click(termosButton);

    expect(
      screen.getByText("Termos de Serviço & Privacidade (LGPD)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Isolamento Criptográfico e Row Level Security/i),
    ).toBeInTheDocument();

    const fecharButton = screen.getByRole("button", { name: "Entendido" });
    await user.click(fecharButton);
  });

  it("renderiza a barra micro-métrica de leitura e o botão de voltar ao topo", () => {
    renderLanding();

    const progressBar = screen.getByRole("progressbar", {
      name: /Progresso de leitura da página/i,
    });
    expect(progressBar).toBeInTheDocument();

    const backToTopButton = screen.getByRole("button", {
      name: /Voltar ao topo da página/i,
    });
    expect(backToTopButton).toBeInTheDocument();
  });
});

