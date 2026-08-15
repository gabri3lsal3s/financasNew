import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeltaHint } from "./delta-hint";

describe("DeltaHint (comparativo Δ vs. período anterior — F14)", () => {
  it("mostra variação positiva com seta de alta (1.000 → 1.250 = +25%)", () => {
    const { container } = render(<DeltaHint currentCents={1250} previousCents={1000} />);
    expect(screen.getByText("25,0%")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-trending-up")).not.toBeNull();
    // Cor semântica: subir é bom sem invert → positiva.
    expect(container.querySelector(".text-positive-strong")).not.toBeNull();
  });

  it("mostra variação negativa com seta de baixa e cor negativa (1.000 → 750 = −25%)", () => {
    const { container } = render(<DeltaHint currentCents={750} previousCents={1000} />);
    expect(screen.getByText("25,0%")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-trending-down")).not.toBeNull();
    expect(container.querySelector(".text-negative-strong")).not.toBeNull();
  });

  it("inverte a semântica quando solicitado (ex.: despesas — subir é ruim)", () => {
    const { container } = render(<DeltaHint currentCents={1250} previousCents={1000} invert />);
    // O ícone segue a direção bruta (alta); a cor inverte para negativa.
    expect(container.querySelector("svg.lucide-trending-up")).not.toBeNull();
    expect(container.querySelector(".text-negative-strong")).not.toBeNull();
  });

  it("não renderiza nada quando não há base de comparação (anterior = 0)", () => {
    const { container } = render(<DeltaHint currentCents={1250} previousCents={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
