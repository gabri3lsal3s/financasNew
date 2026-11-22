import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
  it("renderiza a logo oficial e o indicador de carregamento sem o texto Axir", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    // O wordmark textual foi removido em prol do minimalismo puro
    expect(screen.queryByText("Axir")).not.toBeInTheDocument();
    // A logo oficial monograma está presente via imagem acessível, inline WebP e blindada contra flash de alt
    const img = screen.getByRole("img", { name: "Axir" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("decoding", "sync");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img).toHaveClass("text-transparent", "text-[0px]");
    const source = document.querySelector("picture source[type='image/webp']");
    expect(source?.getAttribute("srcset")?.startsWith("data:image/webp;base64,")).toBe(true);
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
