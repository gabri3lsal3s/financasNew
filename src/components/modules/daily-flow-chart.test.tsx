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
  it("renderiza as barras e a curva de saldo acumulado", () => {
    const { container } = render(<DailyFlowChart days={days} />);

    // Barras empilhadas (por dia do mês).
    expect(container.querySelectorAll("div > div > div").length).toBeGreaterThan(30);
    // Curva de saldo (polyline do SVG).
    const polylines = container.querySelectorAll("polyline");
    expect(polylines).toHaveLength(1);
    expect(polylines[0]?.getAttribute("points")?.split(" ").length).toBe(31);
  });

  it("adiciona a linha guia da meta diária quando informada", () => {
    const { container } = render(<DailyFlowChart days={days} dailyGoalCents={5000} />);
    const polylines = container.querySelectorAll("polyline");
    expect(polylines).toHaveLength(2);
    expect(polylines[0]?.getAttribute("stroke-dasharray")).toBe("4 4");
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

  it("sem violações de acessibilidade (axe)", async () => {
    const { container } = render(<DailyFlowChart days={days} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
