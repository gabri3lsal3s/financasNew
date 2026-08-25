import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge (Fase 67 — Catálogo Estrito de Tamanhos)", () => {
  it("renderiza o texto e aplica variant default e size sm por padrão", () => {
    render(<Badge>Ativo</Badge>);
    const badge = screen.getByText("Ativo");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("text-[11px]", "bg-primary/12", "text-primary-strong");
  });

  it("aplica size xs (10px) para chips ultra-densos", () => {
    render(<Badge size="xs" variant="positive">Concluído</Badge>);
    const badge = screen.getByText("Concluído");
    expect(badge).toHaveClass("text-[10px]", "px-1.5", "py-0");
  });

  it("aplica size md (12px) para destaque em hero cards", () => {
    render(<Badge size="md" variant="portfolio">Patrimônio</Badge>);
    const badge = screen.getByText("Patrimônio");
    expect(badge).toHaveClass("text-xs", "font-semibold", "px-2.5", "py-1");
  });
});
