import { describe, expect, it } from "vitest";
import { simulateStrategyAporte } from "./simulation";

describe("domain/portfolio/simulation", () => {
  const classes = [
    { key: "acoes", name: "Ações", currentProportion: 0.5, targetPercent: 40, yieldRate: 0.06 },
    { key: "fiis", name: "FIIs", currentProportion: 0.2, targetPercent: 30, yieldRate: 0.10 },
    { key: "renda_fixa", name: "Renda Fixa", currentProportion: 0.3, targetPercent: 30, yieldRate: 0.12 },
  ];

  it("handles empty classes gracefully", () => {
    const res = simulateStrategyAporte({
      patrimonyBase: 100000,
      aporteAmount: 10000,
      classes: [],
    });
    expect(res.newTotalPatrimony).toBe(110000);
    expect(res.allocations).toEqual([]);
    expect(res.monthlyPassive).toBe(0);
  });

  it("allocates aporte strictly to deficit classes and preserves total sum", () => {
    // Patrimony: 100.000. Ações: 50k (target 40% of 110k = 44k -> no deficit).
    // FIIs: 20k (target 30% of 110k = 33k -> deficit 13k).
    // RF: 30k (target 30% of 110k = 33k -> deficit 3k).
    // Total deficit: 16k. Aporte: 10k.
    const res = simulateStrategyAporte({
      patrimonyBase: 100000,
      aporteAmount: 10000,
      classes,
    });

    expect(res.newTotalPatrimony).toBe(110000);
    const sumAllocated = res.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    expect(sumAllocated).toBe(10000);

    const acoes = res.allocations.find((a) => a.key === "acoes");
    const fiis = res.allocations.find((a) => a.key === "fiis");
    const rf = res.allocations.find((a) => a.key === "renda_fixa");

    expect(acoes?.allocatedAmount).toBe(0);
    expect(acoes?.isReceivingAporte).toBe(false);
    expect(fiis?.allocatedAmount).toBeGreaterThan(0);
    expect(rf?.allocatedAmount).toBeGreaterThan(0);
    expect(res.monthlyPassive).toBeGreaterThan(0);
  });
});
