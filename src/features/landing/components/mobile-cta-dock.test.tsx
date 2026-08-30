import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { MobileCtaDock } from "./mobile-cta-dock";

describe("MobileCtaDock", () => {
  it("não renderiza nada quando visible=false", () => {
    const { container } = render(
      <BrowserRouter>
        <MobileCtaDock visible={false} />
      </BrowserRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza dock de conversão com CTA e link quando visible=true", () => {
    render(
      <BrowserRouter>
        <MobileCtaDock visible={true} />
      </BrowserRouter>,
    );

    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Testar Grátis/i })).toBeInTheDocument();
  });
});
