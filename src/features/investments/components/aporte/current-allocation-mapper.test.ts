import { describe, expect, it } from "vitest";
import { buildCurrentAllocationSummaries } from "./current-allocation-mapper";

describe("buildCurrentAllocationSummaries", () => {
  it("deriva resumos de classes e setores com valor alocado zerado quando aporte é zero", () => {
    const positionRows = [
      { assetId: "a1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo", valueBRL: 4000, priceBRL: 40, currency: "BRL" as const, isCash: false },
      { assetId: "a2", ticker: "HGLG11", assetClass: "FIIs", sector: "Logística", valueBRL: 6000, priceBRL: 160, currency: "BRL" as const, isCash: false },
      { assetId: "cash", ticker: "CAIXA", assetClass: null, sector: null, valueBRL: 1000, priceBRL: 1, currency: "BRL" as const, isCash: true },
    ];

    const classTargets = [
      { id: "t1", user_id: "u1", group_type: "class" as const, name: "Ações", target_percentage: 50 },
      { id: "t2", user_id: "u1", group_type: "class" as const, name: "FIIs", target_percentage: 50 },
    ];

    const sectorTargets = [
      { id: "s1", user_id: "u1", group_type: "sector" as const, class_name: "Ações", name: "Petróleo", target_percentage: 100 },
    ];

    const res = buildCurrentAllocationSummaries({
      positionRows,
      rawClassTargets: classTargets,
      rawSectorTargets: sectorTargets,
    });

    expect(res.totalCurrentBRL).toBe(10000);
    expect(res.classSummaries).toHaveLength(2);
    expect(res.classSummaries[0]?.actualAllocatedBRL).toBe(0);
    expect(res.sectorSummaries).toHaveLength(2);
    expect(res.sectorSummaries[0]?.actualAllocatedBRL).toBe(0);
  });
});
