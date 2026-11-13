import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FireProjectionCurve } from "./fire-projection-curve";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("FireProjectionCurve", () => {
  it("renderiza o gráfico com valores iniciais e meta de independência financeira", () => {
    render(
      <FireProjectionCurve
        initialPatrimony={25000}
        monthlyAporte={3000}
        monthlyExpenses={2500}
        annualRate={0.08}
        years={25}
      />
    );

    // Meta: 2500 * 12 * 25 = 750.000
    expect(screen.getByText(/Meta Patrimonial: R\$\s*750\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/Ano 0 \(Hoje\)/i)).toBeInTheDocument();
    expect(screen.getByText(/25 anos/i)).toBeInTheDocument();
  });

  it("permite navegar rapidamente usando os atalhos de marcos (Hoje, Meta, 25a)", () => {
    render(
      <FireProjectionCurve
        initialPatrimony={25000}
        monthlyAporte={3000}
        monthlyExpenses={2500}
        annualRate={0.08}
        years={25}
      />
    );

    const hojeBtn = screen.getByRole("button", { name: /Hoje \(0a\)/i });
    fireEvent.click(hojeBtn);

    // No ano 0, o patrimônio inicial é 25.000 (exibido no card e no tooltip)
    expect(screen.getAllByText(/R\$\s*25\.000/i).length).toBeGreaterThan(0);

    const maxBtn = screen.getByRole("button", { name: /25a/i });
    fireEvent.click(maxBtn);

    // Ao ir para 25 anos, deve marcar 25a
    expect(screen.getAllByText(/25a/i).length).toBeGreaterThan(0);
  });

  it("permite avançar e retroceder ano a ano via botões do stepper", () => {
    render(
      <FireProjectionCurve
        initialPatrimony={25000}
        monthlyAporte={3000}
        monthlyExpenses={2500}
        annualRate={0.08}
        years={25}
      />
    );

    const voltarBtn = screen.getByRole("button", { name: /Voltar 1 ano/i });
    const avancarBtn = screen.getByRole("button", { name: /Avançar 1 ano/i });

    expect(voltarBtn).toBeInTheDocument();
    expect(avancarBtn).toBeInTheDocument();

    // Clica para avançar e voltar
    fireEvent.click(avancarBtn);
    fireEvent.click(voltarBtn);
    expect(screen.getByRole("button", { name: /Hoje \(0a\)/i })).toBeInTheDocument();
  });

  it("permite controlar a projeção via teclado usando o slider com setas", () => {
    render(
      <FireProjectionCurve
        initialPatrimony={25000}
        monthlyAporte={3000}
        monthlyExpenses={2500}
        annualRate={0.08}
        years={25}
      />
    );

    const slider = screen.getByRole("slider", { name: /Projeção FIRE ao longo dos anos/i });
    expect(slider).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider).toHaveAttribute("aria-valuenow", "25");

    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuenow", "0");
  });
});
