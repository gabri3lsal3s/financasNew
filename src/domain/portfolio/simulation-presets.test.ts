import { describe, it, expect } from "vitest";
import { STRATEGY_PRESETS, STRATEGY_PRESETS_LIST } from "./simulation-presets";

describe("simulation-presets", () => {
  it("contém os 3 presets principais de alocação", () => {
    expect(STRATEGY_PRESETS_LIST).toHaveLength(3);
    expect(STRATEGY_PRESETS.dividendos).toBeDefined();
    expect(STRATEGY_PRESETS.multimercado).toBeDefined();
    expect(STRATEGY_PRESETS.crescimento).toBeDefined();
  });

  it("cada preset soma exatamente 100% de meta percentual de alocação", () => {
    for (const preset of STRATEGY_PRESETS_LIST) {
      const totalPercent = preset.classes.reduce((acc, c) => acc + c.targetPercent, 0);
      expect(totalPercent).toBe(100);
    }
  });

  it("as proporções atuais e yield rates são válidos", () => {
    for (const preset of STRATEGY_PRESETS_LIST) {
      expect(preset.classes.length).toBeGreaterThan(0);
      for (const cls of preset.classes) {
        expect(cls.currentProportion).toBeGreaterThanOrEqual(0);
        expect(cls.currentProportion).toBeLessThanOrEqual(1);
        expect(cls.yieldRate).toBeGreaterThanOrEqual(0);
        expect(cls.key).toBeTruthy();
        expect(cls.name).toBeTruthy();
      }
    }
  });
});
