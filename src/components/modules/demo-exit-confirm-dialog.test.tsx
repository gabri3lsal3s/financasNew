import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoExitConfirmDialog } from "./demo-exit-confirm-dialog";
import {
  getDemoSessionState,
  hasCompletedDemoTour,
  resetDemoSession,
  resetDemoTourStorage,
  startDemo,
} from "@/state/demo-mode";

const mockNavigate = vi.fn();
let mockPathname = "/";
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

describe("DemoExitConfirmDialog — Interceptação de Ação Real (§3.4)", () => {
  beforeEach(() => {
    mockPathname = "/";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
  });

  it("renderiza o diálogo quando aberto com título, descrição padrão e nota orientativa", () => {
    render(<DemoExitConfirmDialog open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByText("Sair da simulação e cadastrar dado real?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Você está no modo de demonstração. Deseja sair da simulação e registrar seu primeiro lançamento real agora?",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar Explorando" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar (Cadastrar Dado Real)" }),
    ).toBeInTheDocument();
  });

  it("permite customização de textos e rótulos", () => {
    render(
      <DemoExitConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Cadastrar cartão real?"
        description="Deseja sair do tour e adicionar seu cartão agora?"
        confirmLabel="Criar Cartão"
        cancelLabel="Voltar"
      />,
    );

    expect(screen.getByText("Cadastrar cartão real?")).toBeInTheDocument();
    expect(
      screen.getByText("Deseja sair do tour e adicionar seu cartão agora?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar Cartão" })).toBeInTheDocument();
  });

  it("chama onCancel e fecha sem desativar a simulação ao clicar em cancelar", async () => {
    startDemo("finances");
    const user = userEvent.setup();
    const handleCancel = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <DemoExitConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        onCancel={handleCancel}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: "Continuar Explorando" });
    await user.click(cancelBtn);

    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(getDemoSessionState().isDemoActive).toBe(true);
  });

  it("encerra o modo demo, marca trilha como concluída, fecha e chama onConfirm ao confirmar", async () => {
    startDemo("finances");
    const user = userEvent.setup();
    const handleConfirm = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <DemoExitConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
      />,
    );

    const confirmBtn = screen.getByRole("button", {
      name: "Confirmar (Cadastrar Dado Real)",
    });
    await user.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("finances")).toBe(true);
  });

  it("navega para o hand-off contextual ao confirmar sem onConfirm customizado", async () => {
    startDemo("finances");
    mockPathname = "/cartoes";
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <DemoExitConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
      />,
    );

    const confirmBtn = screen.getByRole("button", {
      name: "Confirmar (Cadastrar Dado Real)",
    });
    await user.click(confirmBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/cartoes?novo=cartao");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("finances")).toBe(true);
  });

  it("não apresenta violações de acessibilidade (axe)", async () => {
    const { container } = render(
      <DemoExitConfirmDialog open={true} onOpenChange={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
