import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CeilingPriceBadge } from "./ceiling-price-badge";

describe("CeilingPriceBadge", () => {
  it("renderiza null quando não há preço teto ou cotação de mercado", () => {
    const { container: c1 } = render(<CeilingPriceBadge ceilingPrice={null} currentPrice={40} />);
    expect(c1).toBeEmptyDOMElement();

    const { container: c2 } = render(<CeilingPriceBadge ceilingPrice={50} currentPrice={null} />);
    expect(c2).toBeEmptyDOMElement();

    const { container: c3 } = render(<CeilingPriceBadge ceilingPrice={0} currentPrice={40} />);
    expect(c3).toBeEmptyDOMElement();
  });

  it("renderiza badge positivo de oportunidade quando cotação está abaixo do teto com margem >= 15%", () => {
    // Teto 50, Mercado 40 -> Margem 20%
    render(<CeilingPriceBadge ceilingPrice={50} currentPrice={40} />);
    expect(screen.getByText("+20.0% margem")).toBeInTheDocument();
  });

  it("renderiza badge com valor do teto quando showCeilingValue for true", () => {
    render(<CeilingPriceBadge ceilingPrice={50} currentPrice={40} showCeilingValue />);
    expect(screen.getByText(/Margem de 20\.0% vs Teto/)).toBeInTheDocument();
  });

  it("renderiza badge de alerta quando cotação ultrapassa o teto", () => {
    // Teto 50, Mercado 60 -> Acima do teto em +20%
    render(<CeilingPriceBadge ceilingPrice={50} currentPrice={60} />);
    expect(screen.getByText("+20.0% acima do teto")).toBeInTheDocument();
  });

  it("renderiza badge de preço justo quando margem está entre 0% e 15%", () => {
    // Teto 50, Mercado 46 -> Margem 8%
    render(<CeilingPriceBadge ceilingPrice={50} currentPrice={46} />);
    expect(screen.getByText("Preço Justo")).toBeInTheDocument();
  });
});
