import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { buildDailyFlow } from "@/domain/overview";
import { DailyFlowChart } from "./daily-flow-chart";

const days = buildDailyFlow("2026-08", [
  { date: "2026-08-05", kind: "income", amountCents: 100000 },
  { date: "2026-08-05", kind: "expense", amountCents: 30000 },
  { date: "2026-08-10", kind: "expense", amountCents: 20000 },
]);

describe("DailyFlowChart (F8)", () => {
  it("renderiza as curvas de receitas e despesas com caminhos suaves", () => {
    const { container } = render(<DailyFlowChart days={days} />);

    const incomeCurve = container.querySelector("path.stroke-positive-strong");
    const expenseCurve = container.querySelector("path.stroke-negative-strong");
    expect(incomeCurve).toBeInTheDocument();
    expect(expenseCurve).toBeInTheDocument();
    expect(incomeCurve?.getAttribute("d")).toContain("C");
    expect(expenseCurve?.getAttribute("d")).toContain("C");
  });

  it("scrubbing revela o tooltip do dia", () => {
    const { container } = render(<DailyFlowChart days={days} />);
    const chart = container.firstChild as HTMLElement;
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 310,
      top: 0,
      height: 120,
      right: 310,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(chart, { clientX: 15 });
    // clientX 15 / 310 = 0,048 → dia 2 → tooltip "02/08".
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("02/08")).toBeInTheDocument();

    fireEvent.pointerLeave(chart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("não renderiza curva ou linha de investimentos quando não há aportes no mês", () => {
    const { container } = render(<DailyFlowChart days={days} />);
    expect(container.querySelector("path.stroke-portfolio")).not.toBeInTheDocument();
  });

  it("renderiza a curva de investimentos e detalha no tooltip quando há aportes no mês", () => {
    const daysWithInvestments = buildDailyFlow("2026-08", [
      { date: "2026-08-05", kind: "income", amountCents: 100000 },
      { date: "2026-08-05", kind: "expense", amountCents: 30000 },
      { date: "2026-08-10", kind: "investment", amountCents: 50000 },
    ]);

    const { container } = render(<DailyFlowChart days={daysWithInvestments} />);
    const investmentCurve = container.querySelector("path.stroke-portfolio");
    expect(investmentCurve).toBeInTheDocument();
    expect(investmentCurve?.getAttribute("d")).toContain("C");

    const chart = container.firstChild as HTMLElement;
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 310,
      top: 0,
      height: 120,
      right: 310,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(chart, { clientX: 100 });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Investimentos")).toBeInTheDocument();
  });

  it("mantém a proporção correta de escala entre receitas, despesas e investimentos", () => {
    const daysWithInvestments = buildDailyFlow("2026-08", [
      { date: "2026-08-05", kind: "income", amountCents: 100000 },
      { date: "2026-08-10", kind: "investment", amountCents: 20000 },
    ]);

    const { container } = render(<DailyFlowChart days={daysWithInvestments} />);
    const incomeCurve = container.querySelector("path.stroke-positive-strong")?.getAttribute("d") ?? "";
    const investmentCurve = container.querySelector("path.stroke-portfolio")?.getAttribute("d") ?? "";

    // O pico da renda (100k) atinge o topo (PAD = 12.0), enquanto o investimento (20k) fica proporcionalmente mais baixo (Y maior)
    expect(incomeCurve).toContain("12.0");
    expect(investmentCurve).not.toContain("12.0");
  });

  it("sem violações de acessibilidade (axe)", async () => {
    const { container } = render(<DailyFlowChart days={days} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
