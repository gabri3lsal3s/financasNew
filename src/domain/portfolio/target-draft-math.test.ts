import { describe, expect, it } from "vitest";
import type { GroupTarget, PortfolioAsset } from "@/types";
import {
  buildEffectiveTargetsAndScoreRows,
  buildEqualDraftPatch,
  buildNormalizedDraftPatch,
  buildRemainingDraftPatch,
  buildStoredSectorMaps,
  buildStoredSectorsPayload,
  buildZeroDraftPatch,
  sectorDraftKey,
} from "./target-draft-math";

describe("target-draft-math", () => {
  it("distribui o restante percentual para classes zeradas e garante soma 100%", () => {
    const current = new Map<string, number>([
      ["Ações", 60],
      ["FIIs", 0],
    ]);
    const patch = buildRemainingDraftPatch(["Ações", "FIIs"], (k) => current.get(k) ?? 0);
    expect(patch).toEqual({ Ações: 60, FIIs: 40 });
  });

  it("normaliza, distribui igualmente e zera rascunhos usando builders puros", () => {
    expect(buildEqualDraftPatch(["A", "B"])).toEqual({ A: 50, B: 50 });
    expect(buildNormalizedDraftPatch(["A", "B"], (k) => (k === "A" ? 30 : 20))).toEqual({
      A: 60,
      B: 40,
    });
    expect(buildZeroDraftPatch(["A", "B"], (k) => sectorDraftKey("Ações", k))).toEqual({
      "Ações::A": 0,
      "Ações::B": 0,
    });
  });

  it("constrói payload escopado de setores substituindo apenas a classe editada", () => {
    const existing: GroupTarget[] = [
      { id: "1", user_id: "u1", group_type: "sector", class_name: "Ações", name: "Bancos", target_percentage: 40 },
      { id: "2", user_id: "u1", group_type: "sector", class_name: "FIIs", name: "Papel", target_percentage: 100 },
    ];
    const payload = buildStoredSectorsPayload(existing, "Ações", [
      { name: "Petróleo", target: 60 },
      { name: "Energia", target: 40 },
    ]);

    expect(payload).toEqual([
      { class_name: "FIIs", name: "Papel", target_percentage: 100 },
      { class_name: "Ações", name: "Petróleo", target_percentage: 60 },
      { class_name: "Ações", name: "Energia", target_percentage: 40 },
    ]);
  });

  it("deriva metas efetivas por ativo combinando classes, setores e notas", () => {
    const storedSectorMaps = buildStoredSectorMaps([
      { id: "s1", user_id: "u1", group_type: "sector", class_name: "Ações", name: "Petróleo", target_percentage: 100 },
    ]);
    const assetMap = new Map<string, PortfolioAsset>([
      [
        "a1",
        {
          id: "a1",
          user_id: "u1",
          ticker: "PETR4",
          asset_class: "Ações",
          sector: "Petróleo",
          currency: "BRL",
          quantity: 100,
          average_price: 30,
          score: 8,
          allocation_status: "active",
        },
      ],
    ]);

    const { assetScoreRows } = buildEffectiveTargetsAndScoreRows({
      classes: ["Ações"],
      investableRows: [
        { assetId: "a1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo", valueBRL: 4000, pct: 100 },
      ],
      investableTotalBRL: 4000,
      assetMap,
      classDraft: {},
      sectorDraft: {},
      storedClassTargets: new Map([["Ações", 100]]),
      storedSectorMaps,
    });

    expect(assetScoreRows[0]?.effectiveTargetPct).toBe(100);
    expect(assetScoreRows[0]?.rawScore).toBe(8);
  });
});
