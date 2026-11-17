import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentLoading } from "./content-loading";

describe("ContentLoading", () => {
  it("renderiza indicador de carregamento com papel de acessibilidade status", () => {
    render(<ContentLoading />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Carregando…")).toHaveClass("sr-only");
  });

  it("exibe statusText opcional com clareza e sem logomarcas", () => {
    render(<ContentLoading statusText="Carregando extrato de faturas…" />);
    expect(screen.getByText("Carregando extrato de faturas…")).toBeInTheDocument();
  });

  it("aplica classes corretas para variante card", () => {
    const { container } = render(<ContentLoading variant="card" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("rounded-2xl", "bg-surface", "border");
  });

  it("aplica classes corretas para variante inline", () => {
    const { container } = render(<ContentLoading variant="inline" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("py-4");
  });
});
