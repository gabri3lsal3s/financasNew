import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VirginAccountHero } from "./virgin-account-hero";

const navigateMock = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

describe("VirginAccountHero — Assistente Inline Fase 1", () => {
  it("renderiza saudação personalizada, seletor de foco e ações iniciais", () => {
    render(<VirginAccountHero userName="Gabriel Sales" />);

    expect(screen.getByText(/Olá, Gabriel — bem-vindo ao seu centro financeiro/i)).toBeInTheDocument();
    expect(screen.getByText("Informar Saldo Inicial")).toBeInTheDocument();
    expect(screen.getByText("Lançar Despesa ou Receita")).toBeInTheDocument();
    expect(screen.getByText("Adicionar Cartão de Crédito")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fazer Tour Rápido/i })).toBeInTheDocument();
  });

  it("permite dispensar o guia ao clicar em Explorar sozinho", async () => {
    const user = userEvent.setup();
    const handleDismiss = vi.fn();
    render(<VirginAccountHero onDismiss={handleDismiss} />);

    await user.click(screen.getByRole("button", { name: /Explorar sozinho/i }));
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("reordena prioridades e inicia a trilha correta ao trocar o foco para Investimentos", async () => {
    const user = userEvent.setup();
    const handleSelectFocus = vi.fn();
    const handleQuickTour = vi.fn();
    render(
      <VirginAccountHero
        onSelectFocus={handleSelectFocus}
        onStartQuickTour={handleQuickTour}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Investimentos & Metas/i }));
    expect(handleSelectFocus).toHaveBeenCalledWith("investments");
    expect(screen.getByText("Cadastrar Primeiro Ativo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Fazer Tour Rápido/i }));
    expect(handleQuickTour).toHaveBeenCalledWith("investments");
  });

  it("chama onCalibrate e onOpenNewTransaction nos botões de ação", async () => {
    const user = userEvent.setup();
    const handleCalibrate = vi.fn();
    const handleNewTx = vi.fn();
    render(
      <VirginAccountHero onCalibrate={handleCalibrate} onOpenNewTransaction={handleNewTx} />,
    );

    await user.click(screen.getByText("Calibrar Saldo"));
    expect(handleCalibrate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("Fazer Lançamento"));
    expect(handleNewTx).toHaveBeenCalledTimes(1);
  });

  it("navega para /cartoes e abre trilhas no botão secundário", async () => {
    const user = userEvent.setup();
    const handleOpenDemo = vi.fn();
    render(<VirginAccountHero onOpenDemo={handleOpenDemo} />);

    await user.click(screen.getByText("Cadastrar Cartão"));
    expect(navigateMock).toHaveBeenCalledWith("/cartoes");

    await user.click(screen.getByRole("button", { name: /Ver todas as trilhas/i }));
    expect(handleOpenDemo).toHaveBeenCalledTimes(1);
  });

  it("permite alternar múltiplas vezes entre pílulas de foco mesmo quando selectedFocus inicial foi informado", async () => {
    const user = userEvent.setup();
    render(<VirginAccountHero selectedFocus="cards" />);

    expect(screen.getByText("Adicionar Cartão de Crédito")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Investimentos & Metas/i }));
    expect(screen.getByText("Cadastrar Primeiro Ativo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Família & Amigos/i }));
    expect(screen.getByText("Espaço Família ou Viagem")).toBeInTheDocument();
  });
});
