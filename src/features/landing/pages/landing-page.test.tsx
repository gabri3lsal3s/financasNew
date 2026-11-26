import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
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
    expect(screen.getAllByText(/Axir/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Criar conta grátis/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^Assinar Pro$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Entrar/i }).length).toBeGreaterThan(0);
    const logoLink = screen.getByRole("link", { name: /Axir/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("exibe botão explícito de voltar quando renderizado em subpáginas de vendas ou planos (/vendas, /planos, /precos)", () => {
    renderLanding("/vendas");
    expect(
      screen.getByRole("button", { name: /Voltar para a página anterior/i }),
    ).toBeInTheDocument();
  });

  it("renderiza a seção Hero Editorial de ponta a ponta com painel interativo", async () => {
    const user = userEvent.setup();
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Do gasto do dia a dia aos seus investimentos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Vida pessoal, negócio \(MEI\/PJ\) e investimentos com IA integrada/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/30 dias grátis sem cartão de crédito/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Caixa Real Disponível").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ritmo Diário/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aporte Calibrado do Mês").length).toBeGreaterThan(0);

    // Interação de Escudo de Privacidade e Memória de Cálculo no Hero
    await user.click(screen.getByRole("button", { name: /Escudo de Privacidade/i }));
    expect(screen.getByRole("button", { name: /Escudo ativo/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /Memória de cálculo/i }));
    expect(screen.getByTestId("hero-calculation-memory")).toBeInTheDocument();
  });

  it("renderiza o ecossistema unificado de 8 nós e permite saltar diretamente para o palco de dores", async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /Um único aplicativo no lugar de 8 controles espalhados/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gasto Diário & Caixa Real")).toBeInTheDocument();
    expect(screen.getByText("Cartões & Parcelas (até 60x)")).toBeInTheDocument();
    expect(screen.getByText("Contas a Pagar & a Receber")).toBeInTheDocument();
    expect(screen.getByText("Racha de Parcelas & Viagens")).toBeInTheDocument();
    expect(screen.getByText("Finanças da Família")).toBeInTheDocument();
    expect(screen.getByText("Investimentos, Preço Teto & Relatórios")).toBeInTheDocument();
    expect(screen.getByText("Modo Negócio (MEI, PJ & Autônomos)")).toBeInTheDocument();
    expect(screen.getByText("Micro-IA Financeira Integrada")).toBeInTheDocument();

    // Clica no nó de Racha de Parcelas & Viagens -> ativa o card compartilhado
    await user.click(
      screen.getByRole("button", { name: /Racha de Parcelas & Viagens/i }),
    );
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(await screen.findByTestId("card-racha", {}, { timeout: 5000 })).toBeVisible();
  });

  it("permite interagir com o palco de Finanças Compartilhadas & Pix após selecionar Casal & Amigos", async () => {
    const user = userEvent.setup();
    renderLanding();

    const sharedTabs = screen.getAllByRole("tab", { name: /Casal & Amigos/i });
    await user.click(sharedTabs[0]!);

    expect(await screen.findByTestId("card-racha", {}, { timeout: 5000 })).toBeVisible();
    expect(screen.getByText("Churrasco de Confraternização")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar Pix/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cobrar no WhatsApp/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Copiar Pix/i }));
    expect(screen.getByText("Pix Copiado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cobrar no WhatsApp/i }));
    expect(screen.getByText("Lembrete Enviado")).toBeInTheDocument();

    const vaquinhaTab = screen.getByRole("tab", { name: /Vaquinha Coletiva/i });
    await user.click(vaquinhaTab);

    expect(screen.getByTestId("card-vaquinha")).toBeVisible();
    expect(screen.getByText("Viagem de Fim de Ano em Família")).toBeInTheDocument();
    const copyPixBtn = screen.getAllByRole("button", { name: /Copiar Chave Pix/i })[0]!;
    await user.click(copyPixBtn);
    expect(screen.getByText("Chave Pix Copiada")).toBeInTheDocument();

    const familiaTab = screen.getByRole("tab", { name: /Modo Família|Família/i });
    await user.click(familiaTab);

    expect(screen.getByTestId("card-familia")).toBeVisible();
    expect(screen.getByText("Gestão do Lar · Família Silva")).toBeInTheDocument();
    expect(screen.getByText("Divisão 50% / 50%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Liquidar Acerto Pix/i }));
    expect(screen.getByText("Acerto Quitado")).toBeInTheDocument();
  });

  it("renderiza as 3 abas de Profundidade sob Demanda sem promessas futuras de Imposto de Renda", async () => {
    const user = userEvent.setup();
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: /Simples no primeiro minuto\. Profundo quando você quiser evoluir/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("deep-dive-investments")).toBeInTheDocument();
    expect(screen.getByTestId("valuation-interactive-preview")).toBeInTheDocument();

    // Aba de Relatórios & Memória de Cálculo
    await user.click(screen.getByRole("tab", { name: /Relatórios/i }));
    expect(await screen.findByTestId("deep-dive-reports")).toBeInTheDocument();
    expect(
      screen.getByText("Zero Caixa Preta — Memória de Cálculo em 12 Módulos"),
    ).toBeInTheDocument();

    // Aba de Radar Preventivo & Privacidade
    await user.click(screen.getByRole("tab", { name: /Radar Preventivo & Privacidade/i }));
    expect(await screen.findByTestId("deep-dive-security")).toBeInTheDocument();

    // Garantia estrita de honestidade: zero promessas de IRPF na Landing Page
    expect(
      screen.queryByText(/IRPF|Imposto de Renda|Facilitador de IRPF|Radar Fiscal/i),
    ).not.toBeInTheDocument();
  });

  it("permite interagir com o Simulador de Carteira com Allocation Donut e recalcular valores", async () => {
    const user = userEvent.setup();
    renderLanding();

    expect(screen.getByText("Simulador de Carteira & Aportes Inteligentes")).toBeInTheDocument();
    expect(await screen.findByText("Composição da Carteira")).toBeInTheDocument();

    const aporte6k = screen.getByRole("button", { name: "R$ 6k" });
    await user.click(aporte6k);

    expect(screen.getByText(/Seu próximo aporte de R\$ 6.000/i)).toBeInTheDocument();

    const globalStrategy = screen.getByRole("button", { name: "Global" });
    await user.click(globalStrategy);

    expect(screen.getAllByText("Ativos Globais / Dólar")[0]).toBeInTheDocument();
  });

  it("expande o comparativo por plataforma, alterna planos Mensal/Anual e abre FAQ", async () => {
    const user = userEvent.setup();
    renderLanding();

    await user.click(
      screen.getByRole("button", { name: /Ver comparativo detalhado por plataforma/i }),
    );
    expect(
      screen.getByText("Compartilhar comprovantes de qualquer banco direto no app"),
    ).toBeInTheDocument();

    expect(screen.getByText("Teste de 30 Dias")).toBeInTheDocument();
    expect(screen.getByText("Plano Pro")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mensal" }));
    expect(screen.getByText("R$ 19,99")).toBeInTheDocument();

    const faqButton = screen.getByRole("button", {
      name: /Ainda não invisto na Bolsa\. O Axir também serve para mim/i,
    });
    await user.click(faqButton);

    expect(
      screen.getByText(/Você pode começar organizando apenas o gasto do dia a dia/i),
    ).toBeInTheDocument();
  });

  it("permite abrir e fechar os modais de Termos de Serviço e LGPD pelo rodapé", async () => {
    const user = userEvent.setup();
    renderLanding();

    const termosButton = screen.getByRole("button", { name: "Termos de Serviço" });
    await user.click(termosButton);

    expect(
      await screen.findByText("Termos de Serviço & Privacidade (LGPD)", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Transparência, Teste Gratuito e Cancelamento/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Isolamento Criptográfico e Row Level Security/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entendido" }));

    const privacyButton = screen.getByRole("button", { name: "Privacidade (LGPD)" });
    await user.click(privacyButton);

    expect(
      await screen.findByText(/Privacidade Absoluta e Conformidade com a LGPD/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Termos de Serviço" }));
    expect(
      screen.getByText(/Transparência, Teste Gratuito e Cancelamento/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entendido" }));
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

  it("omite o botão BackToTop no navegador Samsung Internet fora do modo standalone", () => {
    const originalUa = navigator.userAgent;

    try {
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
        configurable: true,
      });
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderLanding();

      expect(
        screen.queryByRole("button", { name: /Voltar ao topo da página/i }),
      ).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
      vi.restoreAllMocks();
    }
  });

  it("mantém o botão BackToTop quando acessado via Samsung Internet em modo PWA standalone", () => {
    const originalUa = navigator.userAgent;

    try {
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
        configurable: true,
      });
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderLanding();

      expect(
        screen.getByRole("button", { name: /Voltar ao topo da página/i }),
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
      vi.restoreAllMocks();
    }
  });
});
