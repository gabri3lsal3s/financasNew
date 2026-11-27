import { describe, expect, it } from "vitest";
import {
  buildGoalProgressBreakdown,
  buildSplitPendingBreakdown,
} from "./overview-carousel-breakdown";

describe("overview-carousel-breakdown (Fase 2B)", () => {
  it("monta progresso de meta respeitando 1 centavo faltante e ritmo diário", () => {
    const b = buildGoalProgressBreakdown({
      shareId: "g-1",
      goalTitle: "Reserva",
      asOf: "2026-11-27",
      deadline: "2026-11-28",
      targetCents: 10_000,
      currentCents: 9_999,
      source: "composição ao vivo",
      remainingCents: 1,
      remainingDays: 1,
      requiredDailyCents: 1,
      stage: "final_stretch",
    });

    expect(b.result.rawValue).toBe(1);
    expect(b.steps.some((s) => s.label.includes("Ritmo Diário"))).toBe(true);
  });

  it("monta rachas pendentes sem inventar participantes em item legado", () => {
    const b = buildSplitPendingBreakdown({
      items: [
        {
          id: "s-1",
          title: "Jantar",
          source: "share",
          expenseCents: 10_000,
          pendingCents: 5_000,
          parts: [{ participantId: "p-1", amountCents: 5_000, settledCents: 0 }],
        },
        {
          id: "debt_1",
          title: "Legado",
          source: "legacy_debt",
          expenseCents: 4_000,
          pendingCents: 2_000,
          parts: [],
        },
      ],
      pendingCents: 7_000,
      count: 2,
    });

    expect(b.result.rawValue).toBe(7_000);
    expect(b.notes?.[0]).toContain("sem inferir participantes");
  });
});
