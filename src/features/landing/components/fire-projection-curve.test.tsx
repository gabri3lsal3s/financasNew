import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FireProjectionCurve } from "./fire-projection-curve";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

const DEFAULT_PROPS = {
  initialPatrimony: 25000,
  monthlyAporte: 3000,
  monthlyExpenses: 2500,
  annualRate: 0.08,
  years: 25,
};

describe("FireProjectionCurve", () => {
  it("renderiza a meta patrimonial e o eixo temporal em duas faixas", () => {
    render(<FireProjectionCurve {...DEFAULT_PROPS} />);

    // Capital crítico da regra dos 4%: R$ 2.500 × 300 = R$ 750.000
    expect(screen.getByText(/Meta Patrimonial: R\$\s*750\.000/i)).toBeInTheDocument();
    expect(screen.getByText("25 anos")).toBeInTheDocument();
  });

  it("abre no ano de independência calculado pelo motor de domínio", () => {
    render(<FireProjectionCurve {...DEFAULT_PROPS} />);

    const slider = screen.getByRole("slider", { name: /Projeção patrimonial ao longo dos anos/i });
    expect(slider).toHaveAttribute("aria-valuenow", "12");
    expect(screen.getByRole("button", { name: /Independência \(12a\)/i })).toBeInTheDocument();
  });

  it("permite navegar pelos marcos de hoje e de independência", () => {
    render(<FireProjectionCurve {...DEFAULT_PROPS} />);

    const slider = screen.getByRole("slider", { name: /Projeção patrimonial ao longo dos anos/i });

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(slider).toHaveAttribute("aria-valuenow", "0");

    fireEvent.click(screen.getByRole("button", { name: /Independência \(12a\)/i }));
    expect(slider).toHaveAttribute("aria-valuenow", "12");
  });

  it("controla a projeção via teclado (setas, Home e End)", () => {
    render(<FireProjectionCurve {...DEFAULT_PROPS} />);

    const slider = screen.getByRole("slider", { name: /Projeção patrimonial ao longo dos anos/i });

    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuenow", "0");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "1");

    fireEvent.keyDown(slider, { key: "End" });
    expect(slider).toHaveAttribute("aria-valuenow", "25");
  });

  it("não expõe steppers redundantes de ano a ano", () => {
    render(<FireProjectionCurve {...DEFAULT_PROPS} />);

    expect(screen.queryByRole("button", { name: /Voltar 1 ano/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Avançar 1 ano/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^25a$/i })).not.toBeInTheDocument();
  });

  it("informa os três indicadores ativos do ano selecionado", () => {
    render(<FireProjectionCurve {...DEFAULT_PROPS} />);

    expect(screen.getByText("Horizonte")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio")).toBeInTheDocument();
    expect(screen.getByText("Renda passiva")).toBeInTheDocument();
    expect(screen.getByText(/% da meta/i)).toBeInTheDocument();
    expect(screen.getByText(/% do custo de vida/i)).toBeInTheDocument();
  });

  it("avisa quando a meta não é alcançada no horizonte", () => {
    render(<FireProjectionCurve {...DEFAULT_PROPS} monthlyAporte={0} years={5} />);

    expect(screen.getByText(/Meta não alcançada em 5 anos/i)).toBeInTheDocument();
  });
});
