import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo (F10 — identidade oficial)", () => {
  it("renderiza o símbolo com o wordmark 'Guia Financeiro'", () => {
    render(<BrandLogo />);
    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();
    // Símbolo vetorial é decorativo (aria-hidden), fora da árvore acessível.
    expect(document.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("com showWordmark=false exibe apenas o símbolo", () => {
    render(<BrandLogo showWordmark={false} />);
    expect(screen.queryByText("Guia Financeiro")).not.toBeInTheDocument();
    expect(document.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("aceita classes extras no container e no símbolo", () => {
    const { container } = render(<BrandLogo className="justify-center" markClassName="size-10" />);
    expect(container.firstChild).toHaveClass("justify-center");
    expect(container.querySelector("svg")).toHaveClass("size-10");
  });
});
