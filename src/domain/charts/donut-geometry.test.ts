import { describe, expect, it } from "vitest";
import {
  DONUT_CATEGORY_COLORS,
  computeDonutGeometry,
  computeVisualShares,
  getDonutCategoryColor,
  resolveDonutSliceColor,
} from "./donut-geometry";

describe("donut-geometry (motor puro de arcos e paleta --cat-1..10)", () => {
  it("retorna geometria vazia quando não há fatias positivas", () => {
    const empty = computeDonutGeometry([
      { id: "a", label: "Zero", value: 0 },
      { id: "b", label: "Negativo", value: -50 },
    ]);
    expect(empty.total).toBe(0);
    expect(empty.slices).toHaveLength(0);
  });

  it("mantém a escala fechada --cat-1..10 encapsulada com hsl(var(...))", () => {
    expect(DONUT_CATEGORY_COLORS).toHaveLength(10);
    expect(getDonutCategoryColor(0)).toBe("hsl(var(--cat-1))");
    expect(getDonutCategoryColor(9)).toBe("hsl(var(--cat-10))");
    expect(getDonutCategoryColor(10)).toBe("hsl(var(--cat-1))");
    expect(resolveDonutSliceColor("--primary", 0)).toBe("hsl(var(--primary))");
    expect(resolveDonutSliceColor("var(--cat-3)", 0)).toBe("hsl(var(--cat-3))");
  });

  it("calcula arco completo de 360 graus para fatia única", () => {
    const result = computeDonutGeometry([{ id: "moradia", label: "Moradia", value: 10000 }]);
    expect(result.total).toBe(10000);
    expect(result.slices).toHaveLength(1);
    const slice = result.slices[0]!;
    expect(slice.share).toBe(1);
    expect(slice.percentage).toBe(100);
    expect(slice.startAngleDeg).toBe(0);
    expect(slice.endAngleDeg).toBe(360);
    expect(slice.dashLength).toBeCloseTo(result.circumference, 5);
  });

  it("aplica piso visual mínimo preservando a soma unitária das fatias", () => {
    const shares = computeVisualShares([0.001, 0.999], 0.02);
    expect(shares[0]).toBeGreaterThanOrEqual(0.02);
    expect(shares[0]! + shares[1]!).toBeCloseTo(1, 6);
  });

  it("distribui ângulos com gap entre múltiplas fatias e gera paths SVG válidos", () => {
    const result = computeDonutGeometry(
      [
        { id: "1", label: "Moradia", value: 5000 },
        { id: "2", label: "Lazer", value: 3000 },
        { id: "3", label: "Saúde", value: 2000 },
      ],
      { size: 200, strokeWidth: 20, gapDegrees: 4 },
    );

    expect(result.total).toBe(10000);
    expect(result.slices).toHaveLength(3);
    expect(result.slices[0]!.percentage).toBeCloseTo(50, 5);
    expect(result.slices[1]!.percentage).toBeCloseTo(30, 5);
    expect(result.slices[2]!.percentage).toBeCloseTo(20, 5);

    const last = result.slices[2]!;
    expect(last.endAngleDeg).toBeCloseTo(356, 5);
    for (const slice of result.slices) {
      expect(slice.pathD).toMatch(/^M /);
    }
  });
});
