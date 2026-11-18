import { describe, expect, it } from "vitest";
import { buildDailyFlow } from "@/domain/overview";
import {
  DAILY_FLOW_BASELINE_Y,
  computeDailyFlowGeometry,
  formatDailyFlowDayLabel,
} from "./daily-flow-geometry";

describe("daily-flow-geometry", () => {
  it("formatDailyFlowDayLabel preserva o dia 01 sem deslocamento de fuso UTC-3", () => {
    expect(formatDailyFlowDayLabel("2026-08-01", 1)).toBe("01/08");
    expect(formatDailyFlowDayLabel("2026-01-01", 1)).toBe("01/01");
    expect(formatDailyFlowDayLabel("2026-12-31", 31)).toBe("31/12");
  });

  it("computeDailyFlowGeometry gera curvas monotônicas sem overshoot abaixo do baseline", () => {
    const days = buildDailyFlow("2026-08", [
      { date: "2026-08-05", kind: "income", amountCents: 500000 },
      { date: "2026-08-10", kind: "expense", amountCents: 100000 },
    ]);

    const geometry = computeDailyFlowGeometry(days);
    expect(geometry.hasIncomes).toBe(true);
    expect(geometry.hasExpenses).toBe(true);
    expect(geometry.hasInvestments).toBe(false);
    expect(geometry.xTicks[0]?.label).toBe("01");
    expect(geometry.xTicks[geometry.xTicks.length - 1]?.label).toBe("31");

    const numbers = geometry.incomePath.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 1; i < numbers.length; i += 2) {
      expect(numbers[i]!).toBeLessThanOrEqual(DAILY_FLOW_BASELINE_Y + 0.01);
    }
  });
});
