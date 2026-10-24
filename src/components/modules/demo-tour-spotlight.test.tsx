import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoTourSpotlight } from "./demo-tour-spotlight";
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

describe("DemoTourSpotlight — Foco e Apresentação Guiada com Spotlight", () => {
  beforeEach(() => {
    mockPathname = "/";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
  });

  it("não renderiza nada se a demonstração estiver inativa", () => {
    render(<DemoTourSpotlight />);
    expect(
      screen.queryByRole("dialog", { name: /Tour guiado interativo/i }),
    ).not.toBeInTheDocument();
  });

  it("renderiza o spotlight e o card popover quando a demonstração está ativa", () => {
    startDemo("finances");

    render(<DemoTourSpotlight />);

    expect(
      screen.getByRole("dialog", { name: /Tour guiado interativo/i }),
    ).toBeInTheDocument();

    expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();
    expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
    expect(screen.getByText("Visão Geral & Fluxo Consolidado")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /Anterior/i });
    expect(prevBtn).toBeDisabled();

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Encerrar tour demonstrativo/i }),
    ).toBeInTheDocument();
  });

  it("avança para o próximo passo e navega para a rota correspondente ao clicar em Próximo", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handleNext = vi.fn();

    render(<DemoTourSpotlight onNextStep={handleNext} />);

    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    await user.click(nextBtn);

    expect(getDemoSessionState().currentStepIndex).toBe(1);
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes");
    expect(handleNext).toHaveBeenCalledWith(1);
  });

  it("retrocede para o passo anterior ao clicar em Anterior", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handlePrev = vi.fn();

    render(<DemoTourSpotlight onPrevStep={handlePrev} />);

    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    await user.click(nextBtn);
    expect(getDemoSessionState().currentStepIndex).toBe(1);

    const prevBtn = screen.getByRole("button", { name: /Anterior/i });
    expect(prevBtn).not.toBeDisabled();
    await user.click(prevBtn);

    expect(getDemoSessionState().currentStepIndex).toBe(0);
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handlePrev).toHaveBeenCalledWith(0);
  });

  it("encerra a simulação imediatamente ao clicar no botão [X] de fechar", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handleClose = vi.fn();

    render(<DemoTourSpotlight onClose={handleClose} />);

    expect(getDemoSessionState().isDemoActive).toBe(true);

    const closeBtn = screen.getByRole("button", {
      name: /Encerrar tour demonstrativo/i,
    });
    await user.click(closeBtn);

    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("encerra a simulação ao pressionar a tecla Escape", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handleClose = vi.fn();

    render(<DemoTourSpotlight onClose={handleClose} />);

    expect(getDemoSessionState().isDemoActive).toBe(true);

    await user.keyboard("{Escape}");

    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("avança o passo ao pressionar a tecla ArrowRight", async () => {
    const user = userEvent.setup();
    startDemo("finances");

    render(<DemoTourSpotlight />);

    await user.keyboard("{ArrowRight}");

    expect(getDemoSessionState().currentStepIndex).toBe(1);
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes");
  });

  it("conclui a trilha e aciona o hand-off para a conta real no último passo", async () => {
    const user = userEvent.setup();
    startDemo("investments"); // 3 passos (0, 1, 2)

    render(<DemoTourSpotlight />);

    // Avança para o passo 2
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    // Avança para o passo 3 (último)
    await user.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByText("Passo 3 de 3")).toBeInTheDocument();
    const finishBtn = screen.getByRole("button", {
      name: /Começar Conta Real/i,
    });
    expect(finishBtn).toBeInTheDocument();

    await user.click(finishBtn);

    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("investments")).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith("/investments?novo=investimento");
  });
});
