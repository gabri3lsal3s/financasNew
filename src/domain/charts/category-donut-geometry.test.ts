import { describe, expect, it } from "vitest";
import {
  buildCategoryDonutArcs,
  buildCategoryVisualRingSlices,
  computeRoundPillShares,
  getCategorySliceColor,
} from "./category-donut-geometry";

describe("category-donut-geometry", () => {
  it("resolve cores --cat-* em hsl(var(...)) sem passar var cru", () => {
    expect(getCategorySliceColor(null, 0)).toBe("hsl(var(--cat-1))");
    expect(getCategorySliceColor("#e11d48", 0)).toBe("#e11d48");
  });

  it("agrupa cauda longa além de maxVisualSlices em __donut_others__", () => {
    const slices = Array.from({ length: 10 }, (_, i) => ({
      key: `k-${i}`,
      label: `Item ${i}`,
      valueCents: 1000,
    }));
    const ring = buildCategoryVisualRingSlices(slices, 7);
    expect(ring).toHaveLength(7);
    expect(ring[6]?.key).toBe("__donut_others__");
    expect(ring[6]?.memberKeys).toHaveLength(4);
  });

  it("computeRoundPillShares preserva soma unitária mesmo com fatias minúsculas", () => {
    const ring = buildCategoryVisualRingSlices(
      [
        { key: "a", label: "A", valueCents: 100000 },
        { key: "b", label: "B", valueCents: 500 },
      ],
      7,
    );
    const shares = computeRoundPillShares(ring, 100500, 0.05);
    expect(shares[1]).toBe(0.05);
    expect((shares[0] ?? 0) + (shares[1] ?? 0)).toBeCloseTo(1, 6);

    const arcs = buildCategoryDonutArcs({
      visualRingSlices: ring,
      total: 100500,
      activeSelectedKey: "a",
      hoveredSliceKey: null,
    });
    expect(arcs[0]?.isSelected).toBe(true);
    expect(arcs[0]?.strokeLinecap).toBe("round");
  });
});
