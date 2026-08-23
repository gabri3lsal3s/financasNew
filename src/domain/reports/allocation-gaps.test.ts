import { describe, expect, it } from "vitest";
import { calculateAllocationGaps } from "./allocation-gaps";
import type { AllocationPositionInput, ClassTargetInput, AssetTargetInput } from "./allocation-gaps";

describe("calculateAllocationGaps", () => {
  it("deve retornar 100% de alinhamento para carteira vazia", () => {
    const result = calculateAllocationGaps([]);
    expect(result.totalBRL).toBe(0);
    expect(result.alignmentScore).toBe(100);
    expect(result.classGaps).toEqual([]);
    expect(result.assetGaps).toEqual([]);
    expect(result.topDeficitClass).toBeNull();
  });

  it("deve calcular gaps de classe com precisão e ordenar por maior déficit", () => {
    const positions: AllocationPositionInput[] = [
      { id: "1", ticker: "PETR4", assetClass: "acoes", valueBRL: 2000 },
      { id: "2", ticker: "VALE3", assetClass: "acoes", valueBRL: 2000 },
      { id: "3", ticker: "HGLG11", assetClass: "fiis", valueBRL: 1000 },
      { id: "4", ticker: "CDB", assetClass: "renda_fixa", valueBRL: 5000 },
    ];
    // Total = 10.000 BRL
    // Ações: 4.000 (40%), FIIs: 1.000 (10%), Renda Fixa: 5.000 (50%)
    const classTargets: ClassTargetInput[] = [
      { assetClass: "acoes", targetPercentage: 30 }, // Atual 40% -> Excedente
      { assetClass: "fiis", targetPercentage: 30 }, // Atual 10% -> Déficit de 2.000 BRL (20%)
      { assetClass: "renda_fixa", targetPercentage: 40 }, // Atual 50% -> Excedente
    ];

    const result = calculateAllocationGaps(positions, classTargets);

    expect(result.totalBRL).toBe(10000);
    expect(result.classGaps).toHaveLength(3);

    // O primeiro deve ser FIIs com maior gap positivo (déficit)
    expect(result.classGaps[0]?.assetClass).toBe("fiis");
    expect(result.classGaps[0]?.currentPct).toBe(10);
    expect(result.classGaps[0]?.targetPct).toBe(30);
    expect(result.classGaps[0]?.gapBRL).toBe(2000);
    expect(result.classGaps[0]?.status).toBe("deficit");
    expect(result.classGaps[0]?.recommendedOrder).toBe(1);

    expect(result.topDeficitClass?.assetClass).toBe("fiis");
    expect(result.alignmentScore).toBeLessThan(100);
  });

  it("deve calcular gaps por ativo individualmente", () => {
    const positions: AllocationPositionInput[] = [
      { id: "a1", ticker: "PETR4", assetClass: "acoes", valueBRL: 6000 },
      { id: "a2", ticker: "VALE3", assetClass: "acoes", valueBRL: 4000 },
    ];
    const assetTargets: AssetTargetInput[] = [
      { assetId: "a1", targetPercentage: 40 }, // Meta 4k -> Atual 6k (+2k surplus)
      { assetId: "a2", targetPercentage: 60 }, // Meta 6k -> Atual 4k (+2k deficit)
    ];

    const result = calculateAllocationGaps(positions, [], assetTargets);

    expect(result.assetGaps[0]?.ticker).toBe("VALE3");
    expect(result.assetGaps[0]?.gapBRL).toBe(2000);
    expect(result.assetGaps[0]?.status).toBe("deficit");

    expect(result.topDeficitAsset?.ticker).toBe("VALE3");
  });
});
