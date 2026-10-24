import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoTourBar } from "./demo-tour-bar";
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

describe("DemoTourBar — Barra Superior do Tour (§3.3)", () => {
  beforeEach(() => {
    mockPathname = "/";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
  });

  it("não renderiza nada se a demonstração estiver inativa", () => {
    render(<DemoTourBar />);
    expect(
      screen.queryByRole("region", { name: /Barra guiada do modo de demonstração/i }),
    ).not.toBeInTheDocument();
  });

  it("renderiza a barra com título, indicador de passo e botões quando a simulação estiver ativa", () => {
    startDemo("finances");

    render(<DemoTourBar />);

    expect(
      screen.getByRole("region", { name: /Barra guiada do modo de demonstração/i }),
    ).toBeInTheDocument();

    expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();
    expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
    expect(screen.getByText("Visão Geral & Fluxo Consolidado")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /Anterior/i });
    expect(prevBtn).toBeDisabled();

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Trocar Trilha/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Começar Minha Conta Real/i }),
    ).toBeInTheDocument();
  });

  it("avança para o próximo passo e navega para a rota correspondente ao clicar em Próximo", async () => {
    startDemo("finances");
    const user = userEvent.setup();
    const handleNext = vi.fn();

    render(<DemoTourBar onNextStep={handleNext} />);

    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    await user.click(nextBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/transacoes");
    expect(handleNext).toHaveBeenCalledWith(1);
    expect(getDemoSessionState().currentStepIndex).toBe(1);
  });

  it("retrocede para o passo anterior ao clicar em Anterior", async () => {
    startDemo("finances");
    const user = userEvent.setup();
    const handlePrev = vi.fn();

    render(<DemoTourBar onPrevStep={handlePrev} />);

    // Avança para o passo 2
    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    await user.click(nextBtn);
    expect(getDemoSessionState().currentStepIndex).toBe(1);

    // Retrocede para o passo 1
    const prevBtn = screen.getByRole("button", { name: /Anterior/i });
    expect(prevBtn).not.toBeDisabled();
    await user.click(prevBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handlePrev).toHaveBeenCalledWith(0);
    expect(getDemoSessionState().currentStepIndex).toBe(0);
  });

  it("encerra o modo demo e marca como concluído ao clicar em Começar Minha Conta Real", async () => {
    startDemo("finances");
    const user = userEvent.setup();
    const handleStartReal = vi.fn();

    render(<DemoTourBar onStartRealAccount={handleStartReal} />);

    const realBtn = screen.getByRole("button", { name: /Começar Minha Conta Real/i });
    await user.click(realBtn);

    expect(handleStartReal).toHaveBeenCalledTimes(1);
    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("finances")).toBe(true);
  });

  it("aciona callback customizado de troca de trilha quando fornecido", async () => {
    startDemo("finances");
    const user = userEvent.setup();
    const handleChangeTrack = vi.fn();

    render(<DemoTourBar onChangeTrack={handleChangeTrack} />);

    const changeBtn = screen.getByRole("button", { name: /Trocar Trilha/i });
    await user.click(changeBtn);

    expect(handleChangeTrack).toHaveBeenCalledTimes(1);
  });

  it("redireciona para /cartoes?novo=cartao ao iniciar conta real na tela de cartões", async () => {
    startDemo("finances");
    mockPathname = "/cartoes";
    const user = userEvent.setup();

    render(<DemoTourBar />);

    const realBtn = screen.getByRole("button", { name: /Começar Minha Conta Real/i });
    await user.click(realBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/cartoes?novo=cartao");
    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("finances")).toBe(true);
  });

  it("redireciona para /?novo=despesa ao iniciar conta real no dashboard", async () => {
    startDemo("finances");
    mockPathname = "/";
    const user = userEvent.setup();

    render(<DemoTourBar />);

    const realBtn = screen.getByRole("button", { name: /Começar Minha Conta Real/i });
    await user.click(realBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/?novo=despesa");
    expect(getDemoSessionState().isDemoActive).toBe(false);
  });

  it("redireciona para /investments?novo=investimento ao iniciar conta real na trilha de investimentos", async () => {
    startDemo("investments");
    mockPathname = "/investimentos";
    const user = userEvent.setup();

    render(<DemoTourBar />);

    const realBtn = screen.getByRole("button", { name: /Começar Minha Conta Real/i });
    await user.click(realBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/investments?novo=investimento");
    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("investments")).toBe(true);
  });

  it("não apresenta violações de acessibilidade (axe)", async () => {
    startDemo("finances");
    const { container } = render(<DemoTourBar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
