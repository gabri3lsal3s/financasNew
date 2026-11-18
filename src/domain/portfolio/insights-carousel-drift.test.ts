import { describe, expect, it } from "vitest";
import type { GroupTarget } from "@/types";
import {
  computePortfolioCarouselDrift,
  type CarouselPositionRowInput,
} from "./insights-carousel-drift";

describe("insights-carousel-drift", () => {
  it("normaliza classes e calcula desvio percentual sem expor Gap monetário", () => {
    const rows: CarouselPositionRowInput[] = [
      { assetClass: "Renda Fixa", valueBRL: 10_000, isCash: false },
    ];

    const classTargets: GroupTarget[] = [
      { id: "c1", user_id: "u1", name: "Renda Fixa", group_type: "class", target_percentage: 70 },
      { id: "c2", user_id: "u1", name: "Ações de Dividendos", group_type: "class", target_percentage: 30 },
    ];

    const result = computePortfolioCarouselDrift({
      classTargets,
      rows,
      totalBRL: 10_000,
      cashBRL: 0,
    });

    expect(result.allocationDrift.isBalanced).toBe(false);
    expect(result.hasInvalidTargetsSum).toBe(false);
    expect(result.driftSummaryText).toContain("Ações (-30 p.p.)");
    expect(result.driftSummaryText).not.toContain("Ações de Dividendos");
  });

  it("não dispara alerta de soma inválida pois a alocação é auto-normalizada", () => {
    const result = computePortfolioCarouselDrift({
      classTargets: [
        { id: "c1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 60 },
      ],
      rows: [],
      totalBRL: 0,
      cashBRL: 0,
    });

    expect(result.targetsSumPct).toBe(60);
    expect(result.hasInvalidTargetsSum).toBe(false);
  });
});
