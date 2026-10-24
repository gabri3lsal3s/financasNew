import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoTrackSelectModal } from "./demo-track-select-modal";
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

describe("DemoTrackSelectModal — Seleção de Trilha do Tour (§3.2)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
  });

  it("renderiza o modal aberto com os cabeçalhos e as 2 opções de trilha", () => {
    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Escolha sua Trilha de Demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(/Explore os recursos do aplicativo com dados simulados em memória/i),
    ).toBeInTheDocument();

    // Opção 1: Finanças
    expect(screen.getByText("Finanças Diárias & Cartões")).toBeInTheDocument();
    expect(
      screen.getByText(/Explore entradas, saídas, faturas automáticas e limites de gastos/i),
    ).toBeInTheDocument();
    expect(screen.getByText("4 passos")).toBeInTheDocument();

    // Opção 2: Investimentos
    expect(screen.getByText("Investimentos & Rebalanceamento")).toBeInTheDocument();
    expect(
      screen.getByText(/Conheça a visão patrimonial, alocação de classes e motor de aportes/i),
    ).toBeInTheDocument();
    expect(screen.getByText("3 passos")).toBeInTheDocument();

    // Botão de pular
    expect(
      screen.getByRole("button", { name: /Pular tour e ir para conta real/i }),
    ).toBeInTheDocument();
  });

  it("exibe badge 'Concluído' nas trilhas que já foram finalizadas", () => {
    markTourCompleted("finances");

    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByText("3 passos")).toBeInTheDocument();
  });

  it("inicia a trilha de finanças, navega para '/' e fecha o modal ao selecionar finanças", async () => {
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

  it("inicia a trilha de investimentos, navega para '/investimentos' e fecha o modal ao selecionar investimentos", async () => {
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
