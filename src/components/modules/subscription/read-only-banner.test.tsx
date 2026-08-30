import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ReadOnlyBanner } from "./read-only-banner";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("ReadOnlyBanner component", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });
  it("deve renderizar a mensagem de dados preservados e botão de ativação", () => {
    render(
      <MemoryRouter>
        <ReadOnlyBanner />
      </MemoryRouter>,
    );

    expect(screen.getByText("Modo Somente-Leitura Ativo")).toBeInTheDocument();
    expect(screen.getByText(/Seus dados e relatórios estão 100% seguros/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ativar Plano Pro/i })).toBeInTheDocument();
  });

  it("deve navegar para /assinatura ao clicar no botão CTA padrão", () => {
    render(
      <MemoryRouter>
        <ReadOnlyBanner />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Ativar Plano Pro/i });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/assinatura");
  });

  it("deve chamar callback onActivatePro se fornecido", () => {
    const customCallback = vi.fn();
    render(
      <MemoryRouter>
        <ReadOnlyBanner onActivatePro={customCallback} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Ativar Plano Pro/i });
    fireEvent.click(button);

    expect(customCallback).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
