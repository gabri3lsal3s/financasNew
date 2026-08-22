import { describe, expect, it } from "vitest";
import {
  sellAssetPosition,
  splitAssetPosition,
} from "./operations";

describe("domain/portfolio/operations — Vendas e Desinvestimentos", () => {
  it("venda parcial mantém o Preço Médio das cotas remanescentes inalterado", () => {
    // 100 cotas a R$ 30,00 de PM. Vende 40 cotas a R$ 35,00.
    const result = sellAssetPosition({
      currentQuantity: 100,
      currentAveragePrice: 30,
      sellQuantity: 40,
      sellPrice: 35,
      assetClass: "Ações",
    });

    expect(result.remainingQuantity).toBe(60);
    expect(result.remainingAveragePrice).toBe(30); // PM rigorosamente mantido
    expect(result.remainingTotalCost).toBe(1800);
    expect(result.grossAmount).toBe(1400); // 40 * 35
    expect(result.costOfSoldQuantity).toBe(1200); // 40 * 30
    expect(result.realizedPnl).toBe(200); // R$ 200 de lucro realizado
    expect(result.realizedPnlPct).toBeCloseTo(16.67, 1);
    expect(result.isFullyExited).toBe(false);
  });

  it("venda total zera a posição e o PM", () => {
    const result = sellAssetPosition({
      currentQuantity: 50,
      currentAveragePrice: 10,
      sellQuantity: 50,
      sellPrice: 12,
      assetClass: "FIIs",
    });

    expect(result.remainingQuantity).toBe(0);
    expect(result.remainingAveragePrice).toBe(0);
    expect(result.remainingTotalCost).toBe(0);
    expect(result.grossAmount).toBe(600);
    expect(result.realizedPnl).toBe(100);
    expect(result.isFullyExited).toBe(true);
  });

  it("aplica isenção de R$ 20.000 para vendas de ações", () => {
    const resultUnderLimit = sellAssetPosition({
      currentQuantity: 500,
      currentAveragePrice: 20,
      sellQuantity: 200,
      sellPrice: 25, // Total R$ 5.000
      assetClass: "Ações",
      monthlyAccumulatedStockSales: 10_000,
    });

    expect(resultUnderLimit.taxInfo.isStock).toBe(true);
    expect(resultUnderLimit.taxInfo.accumulatedSalesAfter).toBe(15_000);
    expect(resultUnderLimit.taxInfo.isTaxExempt).toBe(true);
    expect(resultUnderLimit.taxInfo.estimatedTaxPayable).toBe(0);
  });

  it("calcula DARF estimado de 15% para ações quando ultrapassa o teto de 20k no mês", () => {
    const resultOverLimit = sellAssetPosition({
      currentQuantity: 1000,
      currentAveragePrice: 20,
      sellQuantity: 500,
      sellPrice: 30, // Total R$ 15.000
      assetClass: "Ações",
      monthlyAccumulatedStockSales: 10_000, // Total acumulado = 25.000 (> 20k)
    });

    expect(resultOverLimit.taxInfo.isStock).toBe(true);
    expect(resultOverLimit.taxInfo.accumulatedSalesAfter).toBe(25_000);
    expect(resultOverLimit.taxInfo.isTaxExempt).toBe(false);
    expect(resultOverLimit.realizedPnl).toBe(5000); // 500 * (30 - 20)
    expect(resultOverLimit.taxInfo.estimatedTaxPayable).toBe(750); // 15% de 5000
  });

  it("aplica tributação fixa de 20% para FIIs sem isenção de 20k", () => {
    const resultFii = sellAssetPosition({
      currentQuantity: 100,
      currentAveragePrice: 10,
      sellQuantity: 50,
      sellPrice: 12, // Total R$ 600
      assetClass: "FIIs",
      monthlyAccumulatedStockSales: 0,
    });

    expect(resultFii.taxInfo.isFii).toBe(true);
    expect(resultFii.taxInfo.isTaxExempt).toBe(false);
    expect(resultFii.realizedPnl).toBe(100);
    expect(resultFii.taxInfo.estimatedTaxPayable).toBe(20); // 20% de 100
  });
});

describe("domain/portfolio/operations — Splits (Desdobramento e Grupamento)", () => {
  it("desdobramento 1 para 10 multiplica cotas por 10, divide PM por 10 e mantém custo invariante", () => {
    const split = splitAssetPosition({
      currentQuantity: 100,
      currentAveragePrice: 50,
      ratioFrom: 1,
      ratioTo: 10,
    });

    expect(split.newQuantity).toBe(1000);
    expect(split.newAveragePrice).toBe(5);
    expect(split.totalCostBefore).toBe(5000);
    expect(split.totalCostAfter).toBe(5000);
  });

  it("grupamento 10 para 1 divide cotas por 10, multiplica PM por 10 e mantém custo invariante", () => {
    const split = splitAssetPosition({
      currentQuantity: 1000,
      currentAveragePrice: 2,
      ratioFrom: 10,
      ratioTo: 1,
    });

    expect(split.newQuantity).toBe(100);
    expect(split.newAveragePrice).toBe(20);
    expect(split.totalCostBefore).toBe(2000);
    expect(split.totalCostAfter).toBe(2000);
  });
});
