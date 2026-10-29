import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeModal } from "./welcome-modal";
import { hasSeenWelcomeModal, resetDemoTourStorage } from "@/state/demo-mode";

describe("WelcomeModal — Acolhimento e Escolha de Partida (§3.1)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoTourStorage();
    vi.clearAllMocks();
  });

  it("não renderiza nada se o usuário já tiver visualizado o modal anteriormente", () => {
    localStorage.setItem("financas:welcome_modal_seen", "true");
    render(<WelcomeModal />);
    expect(
      screen.queryByText("Boas-vindas ao seu novo centro financeiro"),
    ).not.toBeInTheDocument();
  });

  it("renderiza o modal aberto por padrão no primeiro acesso com os 3 pilares explicativos", () => {
    render(<WelcomeModal />);

    // Título e subtítulo
    expect(screen.getByText("Boas-vindas ao seu novo centro financeiro")).toBeInTheDocument();
    expect(
      screen.getByText(/Sua plataforma unificada para controle de fluxo diário/i),
    ).toBeInTheDocument();

    // 3 Pilares da plataforma
    expect(screen.getByText("Controle de Fluxo Diário")).toBeInTheDocument();
    expect(screen.getByText("Cartões Inteligentes")).toBeInTheDocument();
    expect(screen.getByText("Carteira & Rebalanceamento")).toBeInTheDocument();

    // Aviso de categorias essenciais prontas
    expect(
      screen.getByText(/Sua conta já inclui as 11 categorias essenciais organizadas/i),
    ).toBeInTheDocument();

    // Nota da simulação
    expect(
      screen.getByText(/Experimente todos os recursos com dados simulados em memória/i),
    ).toBeInTheDocument();

    // Botões de ação
    expect(
      screen.getByRole("button", { name: /Fazer Tour Rápido \(2 min\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Configurar Minha Conta Agora/i }),
    ).toBeInTheDocument();
  });

  it("permite forçar exibição via forceShow mesmo se já visto no storage", () => {
    localStorage.setItem("financas:welcome_modal_seen", "true");
    render(<WelcomeModal forceShow />);
    expect(screen.getByText("Boas-vindas ao seu novo centro financeiro")).toBeInTheDocument();
  });

  it("aciona onStartTour, marca visto no storage e fecha ao clicar no botão primário", async () => {
    const user = userEvent.setup();
    const handleStartTour = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <WelcomeModal
        open={true}
        onOpenChange={handleOpenChange}
        onStartTour={handleStartTour}
      />,
    );

    const tourBtn = screen.getByRole("button", { name: /Fazer Tour Rápido \(2 min\)/i });
    await user.click(tourBtn);

    expect(handleStartTour).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(hasSeenWelcomeModal()).toBe(true);
  });

  it("aciona onStartRealAccount, marca visto no storage e fecha ao clicar no botão secundário", async () => {
    const user = userEvent.setup();
    const handleStartRealAccount = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <WelcomeModal
        open={true}
        onOpenChange={handleOpenChange}
        onStartRealAccount={handleStartRealAccount}
      />,
    );

    const realBtn = screen.getByRole("button", { name: /Configurar Minha Conta Agora/i });
    await user.click(realBtn);

    expect(handleStartRealAccount).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(hasSeenWelcomeModal()).toBe(true);
  });

  it("marca visto no storage ao fechar pelo botão X", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(<WelcomeModal open={true} onOpenChange={handleOpenChange} />);

    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    await user.click(closeBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(hasSeenWelcomeModal()).toBe(true);
  });

  it("não apresenta violações básicas de acessibilidade (axe)", async () => {
    const { container } = render(<WelcomeModal open={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
