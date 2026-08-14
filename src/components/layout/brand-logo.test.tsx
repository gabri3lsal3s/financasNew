import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo (F10 — identidade oficial)", () => {
  it("renderiza o símbolo com o wordmark 'Guia Financeiro'", () => {
    render(<BrandLogo />);
    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("com showWordmark=false exibe apenas o símbolo com alt acessível", () => {
    render(<BrandLogo showWordmark={false} />);
    expect(screen.queryByText("Guia Financeiro")).not.toBeInTheDocument();
    const img = screen.getByAltText("Guia Financeiro");
    expect(img).toBeInTheDocument();
  });

  it("renderiza subtítulo quando showSubtitle=true", () => {
    render(<BrandLogo showSubtitle />);
    expect(screen.getByText("Organização & Economia")).toBeInTheDocument();
  });

  it("aceita classes extras no container e no símbolo", () => {
    const { container } = render(<BrandLogo className="justify-center" markClassName="size-10" />);
    expect(container.firstChild).toHaveClass("justify-center");
    expect(container.querySelector("img")).toHaveClass("size-10");
  });
});
