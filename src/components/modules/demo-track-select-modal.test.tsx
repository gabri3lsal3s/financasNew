import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoTrackSelectModal } from "./demo-track-select-modal";
import * as platformModule from "@/services/native/platform";
import {
  getDemoSessionState,
  markTourCompleted,
  resetDemoSession,
  resetDemoTourStorage,
} from "@/state/demo-mode";

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

describe("DemoTrackSelectModal — Hub de Aprendizado & Micro-Tours (§3.4)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
  });

  it("renderiza o modal aberto com os cabeçalhos, abas e visão geral", () => {
    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Escolha sua Trilha de Demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(/Explore os recursos do aplicativo com dados simulados em memória/i),
    ).toBeInTheDocument();

    // Abas de navegação
    expect(screen.getByRole("tab", { name: "Finanças" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Finanças Compartilhadas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Investimentos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ajustes & Suporte" })).toBeInTheDocument();

    // Opções principais
    expect(screen.getByText("Finanças Diárias & Cartões")).toBeInTheDocument();
    expect(screen.getByText("Investimentos & Rebalanceamento")).toBeInTheDocument();

    // Micro-tours específicos
    expect(screen.getByText("Lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Cartões, Faturas e Limites")).toBeInTheDocument();
    expect(screen.getByText("Categorias e Tetos de Gastos")).toBeInTheDocument();
    expect(screen.getByText("Smart Advisor e Relatórios")).toBeInTheDocument();

    // Botão de pular
    expect(
      screen.getByRole("button", { name: /Pular tour e ir para conta real/i }),
    ).toBeInTheDocument();
  });

  it("não exibe badge 'Concluído' nem contagem de passos nas trilhas que já foram finalizadas", () => {
    markTourCompleted("finances_wizard");

    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Concluído")).not.toBeInTheDocument();
    expect(screen.queryByText("3 passos")).not.toBeInTheDocument();
  });

  it("inicia a trilha de finanças geral ao clicar no card de finanças", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    const financesBtn = screen.getByText("Finanças Diárias & Cartões").closest("button");
    expect(financesBtn).not.toBeNull();
    await user.click(financesBtn!);

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances");
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("finances");
  });

  it("inicia o micro-tour do Wizard (+) com foco na rota inicial ao selecionar o micro-tour", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    const wizardBtn = screen.getByText("Lançamentos").closest("button");
    expect(wizardBtn).not.toBeNull();
    await user.click(wizardBtn!);

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_wizard");
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("finances_wizard");
  });

  it("inicia o micro-tour de contas e dívidas navegando para '/dividas?type=payable' e fecha o modal", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    const debtsBtn = screen.getByText("Contas, Dívidas e Contratos").closest("button");
    expect(debtsBtn).not.toBeNull();
    await user.click(debtsBtn!);

    expect(mockNavigate).toHaveBeenCalledWith("/dividas?type=payable");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_debts");
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("finances_debts");
  });

  it("inicia a trilha de investimentos geral, navega para '/investimentos' e fecha o modal", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    const investmentsBtn = screen
      .getByText("Investimentos & Rebalanceamento")
      .closest("button");
    expect(investmentsBtn).not.toBeNull();
    await user.click(investmentsBtn!);

    expect(mockNavigate).toHaveBeenCalledWith("/investments");
    expect(handleSelectTrack).toHaveBeenCalledWith("investments");
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("investments");
  });

  it("inicia o micro-tour de metas de alocação de investimentos navegando para '/investments?tab=metas'", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    const targetsBtn = screen.getByText("Metas por Classe e Ativo").closest("button");
    expect(targetsBtn).not.toBeNull();
    await user.click(targetsBtn!);

    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=metas");
    expect(handleSelectTrack).toHaveBeenCalledWith("investments_targets");
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("investments_targets");
  });

  it("renderiza o Card de Boas-Vindas do APK Nativo em destaque caso isNativePlatform() retorne true", async () => {
    const user = userEvent.setup();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={vi.fn()}
        onSelectTrack={handleSelectTrack}
      />,
    );

    expect(screen.getByText("Bem-vindo ao App Nativo Android")).toBeInTheDocument();
    expect(screen.getByText("Exclusivo APK")).toBeInTheDocument();
    expect(
      screen.getByText(/biometria física de hardware, escudo anti-print e atualizações diretas/i),
    ).toBeInTheDocument();

    const nativeBtn = screen.getByText("Bem-vindo ao App Nativo Android").closest("button");
    expect(nativeBtn).not.toBeNull();
    await user.click(nativeBtn!);

    expect(handleSelectTrack).toHaveBeenCalledWith("app_native_apk");
    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=devices");
  });

  it("não renderiza o Card do APK Nativo quando isNativePlatform() for false", () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);

    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Bem-vindo ao App Nativo Android")).not.toBeInTheDocument();
    expect(screen.queryByText("Exclusivo APK")).not.toBeInTheDocument();
  });

  it("aciona onSkipToReal e fecha o modal ao clicar em pular tour", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSkipToReal = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSkipToReal={handleSkipToReal}
      />,
    );

    const skipBtn = screen.getByRole("button", {
      name: /Pular tour e ir para conta real/i,
    });
    await user.click(skipBtn);

    expect(handleSkipToReal).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(false);
  });

  it("renderiza o grupo de Finanças Compartilhadas sem badge de destaque e seus micro-tours", async () => {
    const user = userEvent.setup();
    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    // Aba sem o badge de destaque
    const sharedTab = screen.getByRole("tab", { name: "Finanças Compartilhadas" });
    expect(sharedTab).toBeInTheDocument();
    expect(sharedTab).not.toHaveTextContent("Destaque");

    // Alterna para a aba de Finanças Compartilhadas
    await user.click(sharedTab);

    // Card principal da trilha consolidada
    expect(screen.getByText("Finanças Compartilhadas & Modo Família")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Jornada completa de finanças colaborativas, divisão de despesas via Pix, termômetro de metas e orçamento familiar unificado.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("4 passos")).not.toBeInTheDocument();

    // Micro-tours específicos de finanças compartilhadas
    expect(screen.getByText("Racha de Despesas com Pix")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Divisão inteligente de contas e eventos com amigos, cobrança por Pix e recibos automáticos via WhatsApp.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Modo Família Multi-Contas")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Gestão orçamentária para casais e famílias com cartões independentes, teto conjunto e equilíbrio sem atrito.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Metas Coletivas & Vaquinha Pix")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Vaquinha colaborativa com termômetro em tempo real, chave Pix para arrecadação e prestação de contas pública.",
      ),
    ).toBeInTheDocument();
  });

  it("inicia a trilha de Finanças Compartilhadas geral, navega para '/' e fecha o modal", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    const sharedTab = screen.getByRole("tab", { name: "Finanças Compartilhadas" });
    await user.click(sharedTab);

    const sharedTrackBtn = screen
      .getByText("Finanças Compartilhadas & Modo Família")
      .closest("button");
    expect(sharedTrackBtn).not.toBeNull();
    await user.click(sharedTrackBtn!);

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handleSelectTrack).toHaveBeenCalledWith("shared_finances");
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("shared_finances");
  });

  it("inicia os micro-tours compartilhados nas rotas corretas (racha, família, metas)", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    const { unmount } = render(
      <DemoTrackSelectModal
        open={true}
        defaultTab="shared"
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    // 1. Racha de Despesas -> "/transacoes?novo=despesa&passo=3&racha=1&valor=48000&descricao=Churrasco+de+Confraternizacao"
    const splitBtn = screen.getByText("Racha de Despesas com Pix").closest("button");
    expect(splitBtn).not.toBeNull();
    await user.click(splitBtn!);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/transacoes?novo=despesa&passo=3&racha=1&valor=48000&descricao=Churrasco+de+Confraternizacao",
    );
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_split");

    unmount();
    resetDemoSession();
    mockNavigate.mockClear();
    handleSelectTrack.mockClear();

    // 2. Modo Família -> "/familia"
    const { unmount: unmountFamily } = render(
      <DemoTrackSelectModal
        open={true}
        defaultTab="shared"
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );
    const familyBtn = screen.getByText("Modo Família Multi-Contas").closest("button");
    expect(familyBtn).not.toBeNull();
    await user.click(familyBtn!);
    expect(mockNavigate).toHaveBeenCalledWith("/familia");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_family");

    unmountFamily();
    resetDemoSession();
    mockNavigate.mockClear();
    handleSelectTrack.mockClear();

    // 3. Metas Coletivas -> "/orcamentos?tab=goals"
    render(
      <DemoTrackSelectModal
        open={true}
        defaultTab="shared"
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );
    const goalsBtn = screen.getByText("Metas Coletivas & Vaquinha Pix").closest("button");
    expect(goalsBtn).not.toBeNull();
    await user.click(goalsBtn!);
    expect(mockNavigate).toHaveBeenCalledWith("/orcamentos?tab=goals");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_goals");
  });

  it("não exibe badge 'Concluído' nas trilhas compartilhadas finalizadas", () => {
    markTourCompleted("shared_finances");
    markTourCompleted("finances_split");

    render(<DemoTrackSelectModal open={true} defaultTab="shared" onOpenChange={vi.fn()} />);

    // Não deve encontrar badges de Concluído na aba compartilhada
    expect(screen.queryByText("Concluído")).not.toBeInTheDocument();
  });

  it("não apresenta violações de acessibilidade (axe)", async () => {
    const { container } = render(
      <DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
