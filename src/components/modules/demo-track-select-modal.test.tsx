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

describe("DemoTrackSelectModal — Hub Simplificado de Tours (§3.4)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
  });

  it("renderiza as 3 jornadas principais visíveis e recolhe os micro-tours específicos em Accordion", async () => {
    const user = userEvent.setup();
    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Escolha sua Trilha de Demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(/Explore os recursos do aplicativo com dados simulados em memória/i),
    ).toBeInTheDocument();

    // 3 Jornadas Principais diretamente visíveis
    expect(screen.getByText("Dia a dia, Cartões & Contas")).toBeInTheDocument();
    expect(screen.getByText("Família, Viagens & Racha Pix")).toBeInTheDocument();
    expect(screen.getByText("Investimentos, Preço Teto & Relatórios")).toBeInTheDocument();

    // Micro-tours iniciam recolhidos dentro do Accordion
    const accordionTrigger = screen.getByRole("button", {
      name: /Explorar por recurso específico/i,
    });
    expect(accordionTrigger).toBeInTheDocument();
    expect(accordionTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(accordionTrigger);
    expect(accordionTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Lançamento Rápido (+)")).toBeVisible();
    expect(screen.getByText("Cartões, Faturas e Limites")).toBeVisible();
    expect(screen.getByText("Racha de Despesas com Pix")).toBeVisible();
    expect(screen.getByText("Metas por Classe e Ativo")).toBeVisible();

    expect(
      screen.getByRole("button", { name: /Pular tour e ir para conta real/i }),
    ).toBeInTheDocument();
  });

  it("não exibe badge 'Concluído' nem contagem solta nas trilhas já finalizadas", () => {
    markTourCompleted("finances_wizard");

    render(<DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Concluído")).not.toBeInTheDocument();
  });

  it("inicia cada uma das 3 jornadas principais ao clicar no respectivo card", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectTrack = vi.fn();

    const { rerender } = render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    await user.click(screen.getByText("Dia a dia, Cartões & Contas").closest("button")!);
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances");
    expect(getDemoSessionState().activeTrack).toBe("finances");

    resetDemoSession();
    mockNavigate.mockClear();
    rerender(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    await user.click(screen.getByText("Família, Viagens & Racha Pix").closest("button")!);
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handleSelectTrack).toHaveBeenCalledWith("shared_finances");
    expect(getDemoSessionState().activeTrack).toBe("shared_finances");

    resetDemoSession();
    mockNavigate.mockClear();
    rerender(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={handleOpenChange}
        onSelectTrack={handleSelectTrack}
      />,
    );

    await user.click(screen.getByText("Investimentos, Preço Teto & Relatórios").closest("button")!);
    expect(mockNavigate).toHaveBeenCalledWith("/investments");
    expect(handleSelectTrack).toHaveBeenCalledWith("investments");
    expect(getDemoSessionState().activeTrack).toBe("investments");
  });

  it("permite abrir o Accordion e iniciar micro-tours específicos nas rotas corretas", async () => {
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

    await user.click(screen.getByRole("button", { name: /Explorar por recurso específico/i }));
    await user.click(screen.getByText("Contas, Dívidas e Contratos").closest("button")!);

    expect(mockNavigate).toHaveBeenCalledWith("/dividas?type=payable");
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_debts");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(getDemoSessionState().activeTrack).toBe("finances_debts");
  });

  it("inicia micro-tours compartilhados e de metas de investimentos ao expandir o Accordion", async () => {
    const user = userEvent.setup();
    const handleSelectTrack = vi.fn();

    render(
      <DemoTrackSelectModal
        open={true}
        onOpenChange={vi.fn()}
        onSelectTrack={handleSelectTrack}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Explorar por recurso específico/i }));
    await user.click(screen.getByText("Racha de Despesas com Pix").closest("button")!);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/transacoes?novo=despesa&passo=3&racha=1&valor=48000&descricao=Churrasco+de+Confraternizacao",
    );
    expect(handleSelectTrack).toHaveBeenCalledWith("finances_split");
  });

  it("renderiza o Card do APK Nativo em destaque caso isNativePlatform() retorne true", async () => {
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

    await user.click(screen.getByText("Bem-vindo ao App Nativo Android").closest("button")!);
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

    await user.click(
      screen.getByRole("button", { name: /Pular tour e ir para conta real/i }),
    );

    expect(handleSkipToReal).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(getDemoSessionState().isDemoActive).toBe(false);
  });

  it("não apresenta violações de acessibilidade (axe)", async () => {
    const { container } = render(
      <DemoTrackSelectModal open={true} onOpenChange={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
