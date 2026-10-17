import { describe, expect, it } from "vitest";
import { sumGrossCents, sumWeightedCents } from "./totals";

describe("domain/money/totals", () => {
  describe("sumGrossCents", () => {
    it("returns 0 for empty array", () => {
      expect(sumGrossCents([])).toBe(0);
    });

    it("sums gross values correctly into integer cents", () => {
      const items = [
        { value: 10.5 },
        { value: 20 },
        { value: 0.05 },
      ];
      expect(sumGrossCents(items)).toBe(3055); // R$ 30,55 = 3055 centavos
    });

    it("handles negative values or edge values safely", () => {
      const items = [
        { value: 100 },
        { value: -20 },
      ];
      expect(sumGrossCents(items)).toBe(8000);
    });
  });

  describe("sumWeightedCents", () => {
    it("returns 0 for empty array", () => {
      expect(sumWeightedCents([])).toBe(0);
    });

    it("applies report_weight when present", () => {
      const items = [
        { value: 100, report_weight: 1 },
        { value: 200, report_weight: 0.5 },
        { value: 50, report_weight: 0 },
      ];
      // 100*1 + 200*0.5 + 50*0 = 100 + 100 + 0 = 200 BRL = 20000 cents
      expect(sumWeightedCents(items)).toBe(20000);
    });

    it("defaults report_weight to 1 if null or undefined", () => {
      const items = [
        { value: 10, report_weight: null },
        { value: 20, report_weight: undefined },
        { value: 30 },
      ];
      expect(sumWeightedCents(items)).toBe(6000);
    });

    it("prevents classic IEEE 754 floating point inaccuracies", () => {
      // 0.1 + 0.2 em JS puro resulta em 0.30000000000000004
      const items = [
        { value: 0.1 },
        { value: 0.2 },
      ];
      expect(sumWeightedCents(items)).toBe(30);
      expect(sumGrossCents(items)).toBe(30);

      // Valores com dizima em divisao ponderada
      const weightedItems = [
        { value: 10.05, report_weight: 0.33 }, // 3.3165 -> 3.32 -> 332 cents
        { value: 10.05, report_weight: 0.67 }, // 6.7335 -> 6.73 -> 673 cents
      ];
      expect(sumWeightedCents(weightedItems)).toBe(1005); // 332 + 673 = 1005 centavos
    });
  });
});
