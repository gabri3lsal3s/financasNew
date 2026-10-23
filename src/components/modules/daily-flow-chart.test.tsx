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

  it("renderiza empty state calmo quando a lista de dias estiver vazia", () => {
    render(<DailyFlowChart days={[]} />);
    expect(screen.getByTestId("daily-flow-empty")).toBeInTheDocument();
    expect(screen.getByText("Sem movimentações registradas neste período")).toBeInTheDocument();
  });

  it("renderiza empty state calmo quando o mês só possui dias zerados", () => {
    const zeroDays = [
      { day: "2026-08-01", dayOfMonth: 1, incomeCents: 0, expenseCents: 0, investmentCents: 0, maxCents: 0 },
      { day: "2026-08-02", dayOfMonth: 2, incomeCents: 0, expenseCents: 0, investmentCents: 0, maxCents: 0 },
    ];
    render(<DailyFlowChart days={zeroDays} />);
    expect(screen.getByTestId("daily-flow-empty")).toBeInTheDocument();
  });

  it("renderiza somente a curva de receita quando não há despesas nem investimentos", () => {
    const incomeOnlyDays = [
      { day: "2026-08-01", dayOfMonth: 1, incomeCents: 10000, expenseCents: 0, investmentCents: 0, maxCents: 10000 },
      { day: "2026-08-02", dayOfMonth: 2, incomeCents: 20000, expenseCents: 0, investmentCents: 0, maxCents: 20000 },
    ];
    const { container } = render(<DailyFlowChart days={incomeOnlyDays} />);
    expect(container.querySelector(".stroke-positive-strong")).not.toBeNull();
    expect(container.querySelector(".stroke-negative-strong")).toBeNull();
    expect(container.querySelector(".stroke-portfolio")).toBeNull();
  });

  it("renderiza somente a curva de despesa quando não há receitas nem investimentos", () => {
    const expenseOnlyDays = [
      { day: "2026-08-01", dayOfMonth: 1, incomeCents: 0, expenseCents: 5000, investmentCents: 0, maxCents: 5000 },
      { day: "2026-08-02", dayOfMonth: 2, incomeCents: 0, expenseCents: 8000, investmentCents: 0, maxCents: 8000 },
    ];
    const { container } = render(<DailyFlowChart days={expenseOnlyDays} />);
    expect(container.querySelector(".stroke-positive-strong")).toBeNull();
    expect(container.querySelector(".stroke-negative-strong")).not.toBeNull();
    expect(container.querySelector(".stroke-portfolio")).toBeNull();
  });

  it("aplica clamp no posicionamento horizontal do tooltip próximo aos extremos", () => {
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

    // Posição no extremo esquerdo
    fireEvent.pointerMove(chart, { clientX: 0 });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.style.left).toContain("clamp(76px");
  });

  it("não apresenta overshoot abaixo do baseline (Y <= 148.0) mesmo com picos isolados entre dias zerados", () => {
    // Cenário clássico de overshoot onde antes a spline afundava e cortava reto no chão
    const spikeDays = buildDailyFlow("2026-08", [
      { date: "2026-08-05", kind: "income", amountCents: 500000 },
    ]);

    const { container } = render(<DailyFlowChart days={spikeDays} />);
    const incomeCurve = container.querySelector("path.stroke-positive-strong");
    expect(incomeCurve).toBeInTheDocument();

    const d = incomeCurve?.getAttribute("d") ?? "";
    // Extrai todas as coordenadas numéricas do path d
    // Ex.: M 0.0 148.0 C 3.4 148.0, 6.9 148.0, 10.3 148.0...
    const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    // Em SVG, Y é o segundo valor de cada par (M x y, C x1 y1, x2 y2, x3 y3)
    // O baseline zero fica em Y = 148.0. NENHUM valor Y pode ser maior que 148.01 (abaixo do chão).
    for (let i = 1; i < numbers.length; i += 2) {
      const y = numbers[i]!;
      expect(y).toBeLessThanOrEqual(148.01);
    }
  });

  it("renderiza áreas com gradiente translúcido sob as curvas ativas", () => {
    const { container } = render(<DailyFlowChart days={days} />);
    const incomeArea = container.querySelector("path[fill='url(#flow-income-grad)']");
    const expenseArea = container.querySelector("path[fill='url(#flow-expense-grad)']");
    expect(incomeArea).toBeInTheDocument();
    expect(expenseArea).toBeInTheDocument();
  });

  it("renderiza régua temporal de dias no eixo X", () => {
    render(<DailyFlowChart days={days} />);
    // No mês de agosto (31 dias), os marcadores 01 e 31 devem estar presentes
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
  });
});

