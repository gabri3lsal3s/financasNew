import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeModal } from "./welcome-modal";
import { hasSeenWelcomeModal, resetDemoTourStorage } from "@/state/demo-mode";

const mockNavigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

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

  it("renderiza o modal aberto por padrão no primeiro acesso com o passo 1 (30 dias de Pro e pilares)", () => {
    render(<WelcomeModal />);

    // Título e subtítulo do passo 1
    expect(screen.getByText("Boas-vindas ao seu novo centro financeiro")).toBeInTheDocument();
    expect(
      screen.getByText(/Acesso Axir Pro desbloqueado por 30 dias completos/i),
    ).toBeInTheDocument();

    // Destaque do período de testes
    expect(screen.getByText("30 Dias de Acesso Pro Total")).toBeInTheDocument();
    expect(screen.getByText("Sem Cartão")).toBeInTheDocument();

    // 3 Pilares com ícones
    expect(screen.getByText("Fluxo & Cartões")).toBeInTheDocument();
    expect(screen.getByText("Captura Inteligente")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio & Metas")).toBeInTheDocument();

    // Categorias essenciais
    expect(
      screen.getByText(/Sua conta já inclui as 11 categorias essenciais organizadas/i),
    ).toBeInTheDocument();

    // Botões de ação do passo 1
    expect(screen.getByRole("button", { name: "Explorar Sozinho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Personalizar Meu Início/i })).toBeInTheDocument();
  });

  it("permite forçar exibição via forceShow mesmo se já visto no storage", () => {
    localStorage.setItem("financas:welcome_modal_seen", "true");
    render(<WelcomeModal forceShow />);
    expect(screen.getByText("Boas-vindas ao seu novo centro financeiro")).toBeInTheDocument();
  });

  it("avança para o passo 2 ao clicar em 'Personalizar Meu Início' e exibe opções de prioridades", async () => {
    const user = userEvent.setup();
    render(<WelcomeModal open={true} />);

    await user.click(screen.getByRole("button", { name: /Personalizar Meu Início/i }));

    expect(screen.getByText("Qual é sua principal prioridade hoje?")).toBeInTheDocument();
    expect(screen.getByText("Controlar cartões e faturas")).toBeInTheDocument();
    expect(screen.getByText("Lançar sem digitação via OCR")).toBeInTheDocument();
    expect(screen.getByText("Equilibrar contas e quitar dívidas")).toBeInTheDocument();
    expect(screen.getByText("Finanças do casal ou família")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/i })).toBeInTheDocument();
  });

  it("seleciona uma prioridade, avança para o passo 3 e inicia a jornada direcionada", async () => {
    const user = userEvent.setup();
    const handleStartReal = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <WelcomeModal
        open={true}
        onOpenChange={handleOpenChange}
        onStartRealAccount={handleStartReal}
      />,
    );

    // Passo 1 -> Passo 2
    await user.click(screen.getByRole("button", { name: /Personalizar Meu Início/i }));

    // Seleciona a prioridade OCR
    const ocrGoal = screen.getByRole("radio", { name: /Lançar sem digitação via OCR/i });
    await user.click(ocrGoal);

    // Passo 2 -> Passo 3
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    expect(screen.getByText("Tudo pronto para transformar suas finanças")).toBeInTheDocument();
    expect(screen.getByText("Foco Escolhido")).toBeInTheDocument();

    // Clica em Começar Agora
    await user.click(screen.getByRole("button", { name: /Começar Agora/i }));

    expect(handleStartReal).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(hasSeenWelcomeModal()).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes?novo=transacao");
  });

  it("seleciona a prioridade de finanças da família e navega para /familia", async () => {
    const user = userEvent.setup();
    const handleStartReal = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <WelcomeModal
        open={true}
        onOpenChange={handleOpenChange}
        onStartRealAccount={handleStartReal}
      />,
    );

    // Passo 1 -> Passo 2
    await user.click(screen.getByRole("button", { name: /Personalizar Meu Início/i }));

    // Seleciona a prioridade Família
    const familyGoal = screen.getByRole("radio", { name: /Finanças do casal ou família/i });
    await user.click(familyGoal);

    // Passo 2 -> Passo 3
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    // Clica em Começar Agora
    await user.click(screen.getByRole("button", { name: /Começar Agora/i }));

    expect(handleStartReal).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(hasSeenWelcomeModal()).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith("/familia");
  });

  it("aciona onStartTour, marca visto no storage e fecha ao clicar em Tour Rápido no passo 3", async () => {
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

    // Passo 1 -> Passo 2 -> Passo 3
    await user.click(screen.getByRole("button", { name: /Personalizar Meu Início/i }));
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    const tourBtn = screen.getByRole("button", { name: /Fazer Tour Rápido \(1 min\)/i });
    await user.click(tourBtn);

    expect(handleStartTour).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(hasSeenWelcomeModal()).toBe(true);
  });

  it("marca visto no storage e fecha ao clicar em 'Explorar Sozinho'", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(<WelcomeModal open={true} onOpenChange={handleOpenChange} />);

    const skipBtn = screen.getByRole("button", { name: "Explorar Sozinho" });
    await user.click(skipBtn);

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

