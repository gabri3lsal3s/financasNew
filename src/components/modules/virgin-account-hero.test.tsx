import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VirginAccountHero } from "./virgin-account-hero";

const navigateMock = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

describe("VirginAccountHero", () => {
  it("renderiza o título acolhedor, as 3 portas de entrada e o botão de demonstração", () => {
    render(<VirginAccountHero />);

    expect(screen.getByText("Bem-vindo ao seu novo centro financeiro")).toBeInTheDocument();
    expect(screen.getByText("Informar Saldo Inicial")).toBeInTheDocument();
    expect(screen.getByText("Adicionar Cartão de Crédito")).toBeInTheDocument();
    expect(screen.getByText("Lançar Despesa ou Receita")).toBeInTheDocument();
    expect(screen.getByText("Explorar Conta Demonstrativa")).toBeInTheDocument();
  });

  it("chama onCalibrate ao clicar em Calibrar Saldo", async () => {
    const user = userEvent.setup();
    const handleCalibrate = vi.fn();
    render(<VirginAccountHero onCalibrate={handleCalibrate} />);

    await user.click(screen.getByText("Calibrar Saldo"));
    expect(handleCalibrate).toHaveBeenCalledTimes(1);
  });

  it("chama onOpenNewTransaction ao clicar em Fazer Lançamento", async () => {
    const user = userEvent.setup();
    const handleNewTx = vi.fn();
    render(<VirginAccountHero onOpenNewTransaction={handleNewTx} />);

    await user.click(screen.getByText("Fazer Lançamento"));
    expect(handleNewTx).toHaveBeenCalledTimes(1);
  });

  it("navega para as rotas corretas ao clicar nas opções", async () => {
    const user = userEvent.setup();
    render(<VirginAccountHero />);

    await user.click(screen.getByText("Cadastrar Cartão"));
    expect(navigateMock).toHaveBeenCalledWith("/cartoes");
  });

  it("chama onOpenDemo ao clicar no botão de demonstração", async () => {
    const user = userEvent.setup();
    const handleOpenDemo = vi.fn();
    render(<VirginAccountHero onOpenDemo={handleOpenDemo} />);

    await user.click(screen.getByText("Explorar Conta Demonstrativa"));
    expect(handleOpenDemo).toHaveBeenCalledTimes(1);
  });
});
