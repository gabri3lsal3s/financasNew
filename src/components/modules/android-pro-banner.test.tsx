import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AndroidProBanner } from "./android-pro-banner";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("AndroidProBanner", () => {
  it("renderiza título, badge e texto informativo", () => {
    const handleDismiss = vi.fn();
    render(
      <MemoryRouter>
        <AndroidProBanner onDismiss={handleDismiss} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Experimente a Leitura Automática de Gastos")).toBeInTheDocument();
    expect(screen.getByText("App Android Pro")).toBeInTheDocument();
    expect(screen.getByText(/Detecta compras no cartão/i)).toBeInTheDocument();
  });

  it("chama onDismiss ao clicar no botão de fechar", () => {
    const handleDismiss = vi.fn();
    render(
      <MemoryRouter>
        <AndroidProBanner onDismiss={handleDismiss} />
      </MemoryRouter>,
    );

    const closeBtn = screen.getByLabelText("Dispensar sugestão por 7 dias");
    fireEvent.click(closeBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("redireciona para /configuracoes?tab=devices ao clicar em Baixar App Pro", () => {
    const handleDismiss = vi.fn();
    render(
      <MemoryRouter>
        <AndroidProBanner onDismiss={handleDismiss} />
      </MemoryRouter>,
    );

    const actionBtn = screen.getByRole("button", { name: /Baixar App Pro/i });
    fireEvent.click(actionBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=devices");
  });
});
