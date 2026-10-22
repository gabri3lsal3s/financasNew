import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./sparkline";

describe("Sparkline (F8)", () => {
  it("renderiza a polilinha com os pontos da série", () => {
    const { container } = render(<Sparkline data={[100, 200, 150]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    const points = polyline?.getAttribute("points") ?? "";
    expect(points.split(" ")).toHaveLength(3);
  });

  it("não renderiza nada com série vazia", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renderiza linha horizontal na base quando todos os valores da série forem zero", () => {
    const { container } = render(<Sparkline data={[0, 0, 0, 0, 0, 0]} height={40} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    const points = polyline?.getAttribute("points") ?? "";
    expect(points.split(" ")).toHaveLength(6);
    // Na base, y = height - 2 = 38.0
    expect(points).toContain(",38.0");
  });

  it("renderiza linha horizontal para série de elemento único", () => {
    const { container } = render(<Sparkline data={[0]} height={40} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    const points = polyline?.getAttribute("points") ?? "";
    expect(points.split(" ")).toHaveLength(2);
    expect(points).toContain(",38.0");
  });

  it("posiciona linha no topo para série constante positiva com folga de 2px", () => {
    const { container } = render(<Sparkline data={[100, 100, 100]} height={40} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    const points = polyline?.getAttribute("points") ?? "";
    // Com height=40 e y = 40 - 2 - (1 * 36) = 2.0
    expect(points).toContain(",2.0");
  });

  it("preenche a área sob a linha quando filled", () => {
    const { container } = render(<Sparkline data={[10, 20]} filled />);
    const polygon = container.querySelector("polygon");
    expect(polygon).not.toBeNull();
    expect(polygon?.getAttribute("points")?.endsWith(" 0,40") ?? false).toBe(true);
  });

  it("aplica as classes de traço e fill informadas", () => {
    const { container } = render(
      <Sparkline data={[1, 2]} strokeClassName="stroke-positive-strong" fillClassName="fill-positive-strong/15" filled />,
    );
    expect(container.querySelector("polyline")?.getAttribute("class")).toContain("stroke-positive-strong");
    expect(container.querySelector("polygon")?.getAttribute("class")).toContain("fill-positive-strong/15");
  });

  it("é decorativo (aria-hidden) — valor vem do KPI", () => {
    const { container } = render(<Sparkline data={[1, 2]} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
