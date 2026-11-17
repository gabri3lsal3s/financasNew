import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
  it("renderiza a logo oficial e o indicador de carregamento sem o texto Axir", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    // O wordmark textual foi removido em prol do minimalismo puro
    expect(screen.queryByText("Axir")).not.toBeInTheDocument();
    // A logo oficial monograma está presente via imagem acessível
    expect(screen.getByRole("img", { name: "Axir" })).toBeInTheDocument();
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("renderiza mensagem customizada quando statusText for fornecido", () => {
    render(
      <LoadingScreen statusText="Restaurando cópia de segurança…" />,
    );

    expect(
      screen.getByText("Restaurando cópia de segurança…"),
    ).toBeInTheDocument();
  });

  it("aplica classes de fade-out e desativação quando isClosing for true", () => {
    const { container } = render(<LoadingScreen isClosing />);
    const root = container.querySelector('[role="status"]');
    expect(root).toHaveClass("opacity-0");
    expect(root).toHaveClass("pointer-events-none");
  });
});
