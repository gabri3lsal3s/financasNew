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

  it("deve calcular gaps por setor e construir os nós em árvore", () => {
    const positions: AllocationPositionInput[] = [
      { id: "1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo & Gás", valueBRL: 3000 },
      { id: "2", ticker: "EGIE3", assetClass: "Ações", sector: "Energia Elétrica", valueBRL: 1000 },
      { id: "3", ticker: "HGLG11", assetClass: "FIIs", sector: "Imobiliário / Logística", valueBRL: 6000 },
    ];
    // Total = 10.000 BRL
    // Ações = 4.000 (40%), FIIs = 6.000 (60%)
    const classTargets: ClassTargetInput[] = [
      { assetClass: "Ações", targetPercentage: 50 },
      { assetClass: "FIIs", targetPercentage: 50 },
    ];
    const sectorTargets = [
      { className: "Ações", sectorName: "Petróleo & Gás", targetPercentage: 40 }, // 40% de 50% = 20% total (2.000 BRL) -> atual 3.000 BRL (excedente)
      { className: "Ações", sectorName: "Energia Elétrica", targetPercentage: 60 }, // 60% de 50% = 30% total (3.000 BRL) -> atual 1.000 BRL (déficit 2.000 BRL)
      { className: "FIIs", sectorName: "Imobiliário / Logística", targetPercentage: 100 }, // 100% de 50% = 50% total (5.000 BRL) -> atual 6.000 BRL
    ];

    const result = calculateAllocationGaps(positions, classTargets, [], sectorTargets);

    expect(result.sectorGaps).toBeDefined();
    expect(result.sectorGaps.length).toBeGreaterThanOrEqual(3);

    // Setor com maior déficit deve ser Energia Elétrica
    expect(result.topDeficitSector?.sectorName).toBe("Energia Elétrica");
    expect(result.topDeficitSector?.gapBRL).toBe(2000);
    expect(result.topDeficitSector?.status).toBe("deficit");

    // Valida nós em árvore
    expect(result.treeNodes).toHaveLength(2);
    const acoesNode = result.treeNodes.find((n) => n.assetClass === "Ações");
    expect(acoesNode).toBeDefined();
    expect(acoesNode?.sectors.length).toBe(2);
    const energiaSectorNode = acoesNode?.sectors.find((s) => s.sectorName === "Energia Elétrica");
    expect(energiaSectorNode?.assets).toHaveLength(1);
    expect(energiaSectorNode?.assets[0]?.ticker).toBe("EGIE3");
  });
});

