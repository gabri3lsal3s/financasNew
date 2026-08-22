import { describe, expect, it } from "vitest";
import {
  allocationByTicker,
  assetYieldOnCostPct,
  calculateWeightedAveragePrice,
  portfolioReturnPct,
} from "./summary";

describe("portfolioReturnPct — rentabilidade ponderada pelo valor (§F17)", () => {
  it("pondera os percentuais pelo valor de mercado e ignora caixa", () => {
    const pct = portfolioReturnPct([
      { valueBRL: 6000, unrealizedPct: 20 },
      { valueBRL: 2000, unrealizedPct: 5 },
      { valueBRL: 1000, unrealizedPct: null }, // caixa — fora
    ]);
    // (6000×20 + 2000×5) ÷ 8000 = 130000/8000 = 16,25
    expect(pct).toBe(16.25);
  });

  it("retorna null sem base (vazio ou só caixa)", () => {
    expect(portfolioReturnPct([])).toBeNull();
    expect(portfolioReturnPct([{ valueBRL: 500, unrealizedPct: null }])).toBeNull();
  });

  it("arredonda para 2 casas", () => {
    const pct = portfolioReturnPct([
      { valueBRL: 3333, unrealizedPct: 10 },
      { valueBRL: 3333, unrealizedPct: 10 },
      { valueBRL: 3334, unrealizedPct: 10 },
    ]);
    expect(pct).toBe(10);
  });
});

describe("allocationByTicker — alocação por ativo (§F17)", () => {
  it("agrupa por ticker com peso no patrimônio e ordena desc", () => {
    const slices = allocationByTicker([
      { ticker: "PETR4", valueBRL: 8000 },
      { ticker: "BOVA11", valueBRL: 2000 },
    ]);
    expect(slices).toEqual([
      { ticker: "PETR4", valueBRL: 8000, pct: 80 },
      { ticker: "BOVA11", valueBRL: 2000, pct: 20 },
    ]);
  });

  it("carteira vazia → lista vazia", () => {
    expect(allocationByTicker([])).toEqual([]);
  });
});

describe("assetYieldOnCostPct — Yield on Cost de ativo", () => {
  it("calcula a relação percentual entre proventos recebidos e custo total", () => {
    // 500 reais de proventos com 5.000 de custo = 10%
    expect(assetYieldOnCostPct(500, 5000)).toBe(10);
    // 123.45 reais com 2.500 = 4.94%
    expect(assetYieldOnCostPct(123.45, 2500)).toBe(4.94);
  });

  it("retorna null se não houver custo ou não houver proventos", () => {
    expect(assetYieldOnCostPct(0, 5000)).toBeNull();
    expect(assetYieldOnCostPct(500, 0)).toBeNull();
    expect(assetYieldOnCostPct(-10, 5000)).toBeNull();
    expect(assetYieldOnCostPct(500, -100)).toBeNull();
  });
});

describe("calculateWeightedAveragePrice — Helper de Aporte e Lotes", () => {
  it("calcula preço médio ponderado corretamente ao adicionar novo lote", () => {
    // 100 cotas a R$ 20 + 100 cotas a R$ 40 = 200 cotas a R$ 30 (custo R$ 6.000)
    const res = calculateWeightedAveragePrice(100, 20, 100, 40);
    expect(res).toEqual({
      newQuantity: 200,
      newAveragePrice: 30,
      newTotalCost: 6000,
    });
  });

  it("calcula primeiro lote quando quantidade atual era zero", () => {
    const res = calculateWeightedAveragePrice(0, 0, 50, 35.5);
    expect(res).toEqual({
      newQuantity: 50,
      newAveragePrice: 35.5,
      newTotalCost: 1775,
    });
  });

  it("retorna zeros se as quantidades forem zero", () => {
    const res = calculateWeightedAveragePrice(0, 0, 0, 0);
    expect(res).toEqual({
      newQuantity: 0,
      newAveragePrice: 0,
      newTotalCost: 0,
    });
  });
});
