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
