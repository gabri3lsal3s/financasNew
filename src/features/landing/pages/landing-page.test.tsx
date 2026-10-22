import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/app/theme-provider";
import { LandingPage } from "@/features/landing";

describe("LandingPage", () => {
  const renderLanding = (initialPath = "/") => {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <LandingPage />
        </MemoryRouter>
      </ThemeProvider>,
    );
  };

  it("renderiza o cabeçalho com o logo e CTAs de navegação", () => {
    renderLanding();
    expect(screen.getAllByText(/ÁXIS|AXIS/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Criar conta grátis/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^Assinar Pro$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Entrar/i }).length).toBeGreaterThan(0);
    // Usuário deslogado na landing: o logo aponta para /landing para não chutar o visitante para /entrar
    const logoLink = screen.getByRole("link", { name: /ÁXIS|AXIS/i });
    expect(logoLink).toHaveAttribute("href", "/landing");
  });

  it("exibe botão explícito de voltar quando renderizado em subpáginas de vendas ou planos (/vendas, /planos, /precos)", () => {
    renderLanding("/vendas");
    expect(screen.getByRole("button", { name: /Voltar para a página anterior/i })).toBeInTheDocument();
  });

  it("renderiza a seção Hero Editorial com headline e métricas de caixa real", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /Suas finanças em constante rotação/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/30 Dias de Teste sem Compromisso/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Caixa Real Disponível").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ritmo Diário/i).length).toBeGreaterThan(0);
  });

  it("renderiza as histórias editoriais do produto (Caixa Real, Cartões e Aportes)", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Três eixos coordenados para sustentação e expansão do seu patrimônio/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Eixo 1 · Liquidez & Caixa Real/i)).toBeInTheDocument();
    expect(screen.getByText(/Eixo 2 · Linha Temporal & Cartões/i)).toBeInTheDocument();
    expect(screen.getByText(/Eixo 3 · Vetor Patrimonial & Aportes/i)).toBeInTheDocument();
    expect(screen.getByText(/O fim da ilusão de saldo e da ansiedade de fim de mês/i)).toBeInTheDocument();
    expect(screen.getByText(/Nunca mais seja pego de surpresa por parcelas esquecidas/i)).toBeInTheDocument();
    expect(screen.getByText(/Alocação matemática de aportes e blindagem contra impostos/i)).toBeInTheDocument();
  });

  it("renderiza o bloco de narrativa editorial 'Captura Invisível com Inteligência Local' com os caminhos 1, 2 e mágica semântica (Fase 6 — Tarefa 6.1)", () => {
    renderLanding();

    expect(screen.getByText("Captura Invisível com Inteligência Local")).toBeInTheDocument();
    expect(screen.getByText(/Caminho 1 \(Estrela\): Leitura Automática de Notificações/i)).toBeInTheDocument();
    expect(screen.getByText(/Caminho 2 \(Garantia\): Compartilhamento Direto de Comprovantes/i)).toBeInTheDocument();
    expect(screen.getByText(/Mágica Semântica: Memória Ativa de CNPJs e Comerciantes/i)).toBeInTheDocument();
    expect(screen.getByText("Zero Senhas Bancárias")).toBeInTheDocument();
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
      screen.getByText(/Transparência, Teste Gratuito e Cancelamento/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Isolamento Criptográfico e Row Level Security/i),
    ).toBeInTheDocument();

    const fecharButton = screen.getByRole("button", { name: "Entendido" });
    await user.click(fecharButton);
  });

  it("permite abrir o modal diretamente na aba de Privacidade (LGPD) e alternar abas", async () => {
    const user = userEvent.setup();
    renderLanding();

    const privacyButton = screen.getByRole("button", { name: "Privacidade (LGPD)" });
    await user.click(privacyButton);

    expect(
      screen.getByText("Termos de Serviço & Privacidade (LGPD)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Privacidade Absoluta e Conformidade com a LGPD/i),
    ).toBeInTheDocument();

    // Alterna para Termos de Serviço dentro do modal
    const termosTab = screen.getByRole("tab", { name: "Termos de Serviço" });
    await user.click(termosTab);

    expect(
      screen.getByText(/Transparência, Teste Gratuito e Cancelamento/i),
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

