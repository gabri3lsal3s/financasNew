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
    expect(result.driftSummaryText).toContain("Ações (-30 p.p.)");
    expect(result.driftSummaryText).not.toContain("Ações de Dividendos");
  });

  it("expõe parcela em classes sem meta cadastrada no denominador investido", () => {
    const result = computePortfolioCarouselDrift({
      classTargets: [
        { id: "c1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 100 },
      ],
      rows: [
        { assetClass: "Ações", valueBRL: 400, isCash: false },
        { assetClass: "Cripto", valueBRL: 100, isCash: false },
      ],
      totalBRL: 500,
      cashBRL: 0,
    });

    expect(result.unallocatedClassesBRL).toBe(100);
    expect(result.unallocatedClassNames).toEqual(["Cripto"]);
  });
});
