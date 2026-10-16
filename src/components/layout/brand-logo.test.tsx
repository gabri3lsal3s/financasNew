import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo (F10 — identidade oficial)", () => {
  it("renderiza apenas o símbolo por padrão com alt acessível 'AXIS'", () => {
    render(<BrandLogo />);
    expect(screen.queryByText("AXIS")).not.toBeInTheDocument();
    const img = screen.getByAltText("AXIS");
    expect(img).toBeInTheDocument();
  });

  it("com showWordmark=true exibe o símbolo e o wordmark 'AXIS'", () => {
    render(<BrandLogo showWordmark />);
    expect(screen.getByText("AXIS")).toBeInTheDocument();
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("renderiza subtítulo 'Guia Financeiro' quando showWordmark e showSubtitle são true", () => {
    render(<BrandLogo showWordmark showSubtitle />);
    expect(screen.getByText("AXIS")).toBeInTheDocument();
    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();
  });

  it("aceita classes extras no container e no símbolo", () => {
    const { container } = render(<BrandLogo className="justify-center" markClassName="size-10" />);
    expect(container.firstChild).toHaveClass("justify-center");
    expect(container.querySelector("img")).toHaveClass("size-10");
  });
});
