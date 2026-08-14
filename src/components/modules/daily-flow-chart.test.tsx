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

  it("sem violações de acessibilidade (axe)", async () => {
    const { container } = render(<DailyFlowChart days={days} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
