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
    expect(screen.getByRole("tab", { name: "Investimentos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ajustes & Suporte" })).toBeInTheDocument();

    // Opções principais
    expect(screen.getByText("Finanças Diárias & Cartões")).toBeInTheDocument();
    expect(screen.getByText("Investimentos & Rebalanceamento")).toBeInTheDocument();

    // Micro-tours específicos
    expect(screen.getByText("Botão Wizard (+) e Lançamento")).toBeInTheDocument();
    expect(screen.getByText("Cartões, Faturas e Limites")).toBeInTheDocument();
    expect(screen.getByText("Categorias e Tetos de Gastos")).toBeInTheDocument();
    expect(screen.getByText("Smart Advisor e Relatórios")).toBeInTheDocument();

    // Botão de pular
    expect(
      screen.getByRole("button", { name: /Pular tour e ir para conta real/i }),
    ).toBeInTheDocument();
  });

  it("exibe badge 'Concluído' nas trilhas que já foram finalizadas", () => {
    markTourCompleted("finances_wizard");

    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getAllByText("3 passos").length).toBeGreaterThan(0);
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

    const wizardBtn = screen.getByText("Botão Wizard (+) e Lançamento").closest("button");
    expect(wizardBtn).not.toBeNull();
    await user.click(wizardBtn!);

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_wizard");
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    const session = getDemoSessionState();
    expect(session.isDemoActive).toBe(true);
    expect(session.activeTrack).toBe("finances_wizard");
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

    expect(mockNavigate).toHaveBeenCalledWith("/investimentos");
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
      screen.getByText(/Leitor de notificações bancárias em tempo real/i),
    ).toBeInTheDocument();

    const nativeBtn = screen.getByText("Bem-vindo ao App Nativo Android").closest("button");
    expect(nativeBtn).not.toBeNull();
    await user.click(nativeBtn!);

    expect(handleSelectTrack).toHaveBeenCalledWith("app_native_apk");
    expect(mockNavigate).toHaveBeenCalledWith("/");
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

  it("não apresenta violações de acessibilidade (axe)", async () => {
    const { container } = render(
      <DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
