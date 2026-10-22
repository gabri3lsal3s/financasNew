import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeFeatureModal } from "./welcome-feature-modal";
import { WELCOME_MODAL_STORAGE_KEY } from "./welcome-feature-modal-data";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("WelcomeFeatureModal — Apresentação da Captura Sem Fricção (§6.4)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("não renderiza nada se o usuário já tiver visto e dispensado o modal", () => {
    localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, "true");
    render(<WelcomeFeatureModal />);
    expect(screen.queryByText("A Mágica da Captura Sem Fricção")).not.toBeInTheDocument();
  });

  it("renderiza o modal aberto por padrão no primeiro acesso com o Slide 1", () => {
    render(<WelcomeFeatureModal />);
    expect(screen.getByText("A Mágica da Captura Sem Fricção")).toBeInTheDocument();
    expect(screen.getByText("Notificações Automáticas")).toBeInTheDocument();
    expect(
      screen.getByText(/O app lê compras de cartões e Pix sem você precisar abrir o aplicativo/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pular" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();
  });

  it("permite forçar exibição via forceShow ou open=true mesmo com storage gravado", () => {
    localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, "true");
    render(<WelcomeFeatureModal forceShow />);
    expect(screen.getByText("A Mágica da Captura Sem Fricção")).toBeInTheDocument();
  });

  it("navega entre os slides sequencialmente pelos botões Próximo e Voltar", async () => {
    const user = userEvent.setup();
    render(<WelcomeFeatureModal forceShow />);

    // Slide 1: Notificações
    expect(screen.getByTestId("slide-notifications")).toBeInTheDocument();
    expect(screen.getByText("Notificações Automáticas")).toBeInTheDocument();

    // Avança para Slide 2: Contingência
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    expect(screen.getByTestId("slide-contingency")).toBeInTheDocument();
    expect(screen.getByText("Contingência de Comprovantes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar/i })).toBeInTheDocument();

    // Avança para Slide 3: Mágica Semântica
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    expect(screen.getByTestId("slide-semantic")).toBeInTheDocument();
    expect(screen.getByText("Mágica Semântica Local")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Começar a usar/i })).toBeInTheDocument();

    // Volta para Slide 2
    await user.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByTestId("slide-contingency")).toBeInTheDocument();
  });

  it("permite navegação direta ao clicar nos dots (indicador de progresso)", async () => {
    const user = userEvent.setup();
    render(<WelcomeFeatureModal forceShow />);

    const dot3 = screen.getByRole("tab", { name: /Slide 3/i });
    await user.click(dot3);

    expect(screen.getByTestId("slide-semantic")).toBeInTheDocument();
    expect(screen.getByText("Mágica Semântica Local")).toBeInTheDocument();
  });

  it("suporta navegação fluida por teclado com ArrowRight e ArrowLeft", () => {
    render(<WelcomeFeatureModal forceShow />);

    expect(screen.getByTestId("slide-notifications")).toBeInTheDocument();

    // Pressiona seta direita -> vai para slide 2
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("slide-contingency")).toBeInTheDocument();

    // Pressiona seta direita -> vai para slide 3
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("slide-semantic")).toBeInTheDocument();

    // Pressiona seta esquerda -> volta para slide 2
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByTestId("slide-contingency")).toBeInTheDocument();
  });

  it("ao clicar em Pular, fecha o modal, aciona callbacks e grava no localStorage", async () => {
    const user = userEvent.setup();
    const onDismissMock = vi.fn();
    const onOpenChangeMock = vi.fn();

    render(
      <WelcomeFeatureModal
        onDismiss={onDismissMock}
        onOpenChange={onOpenChangeMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pular" }));

    expect(localStorage.getItem(WELCOME_MODAL_STORAGE_KEY)).toBe("true");
    expect(onDismissMock).toHaveBeenCalledTimes(1);
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("ao avançar até o final e clicar em Começar a usar, fecha e salva dismiss", async () => {
    const user = userEvent.setup();
    const onDismissMock = vi.fn();

    render(<WelcomeFeatureModal onDismiss={onDismissMock} />);

    // Slide 1 -> 2
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    // Slide 2 -> 3
    await user.click(screen.getByRole("button", { name: /Próximo/i }));

    // Conclui no botão final
    await user.click(screen.getByRole("button", { name: /Começar a usar/i }));

    expect(localStorage.getItem(WELCOME_MODAL_STORAGE_KEY)).toBe("true");
    expect(onDismissMock).toHaveBeenCalledTimes(1);
  });

  it("sem violações de acessibilidade no slide inicial", async () => {
    const { container } = render(<WelcomeFeatureModal forceShow />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
