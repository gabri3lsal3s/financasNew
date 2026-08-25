import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("Progress (Fase 67 — Escala Semântica de Alturas)", () => {
  it("renderiza barra de progresso com size md (h-1.5) por padrão", () => {
    render(<Progress value={50} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveClass("h-1.5");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("suporta size sm (h-1) e size lg (h-2.5)", () => {
    const { rerender } = render(<Progress value={30} size="sm" />);
    let bar = screen.getByRole("progressbar");
    expect(bar).toHaveClass("h-1");

    rerender(<Progress value={80} size="lg" />);
    bar = screen.getByRole("progressbar");
    expect(bar).toHaveClass("h-2.5");
  });
});
