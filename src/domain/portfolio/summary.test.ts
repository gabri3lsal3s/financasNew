import { describe, expect, it } from "vitest";
import { allocationByTicker, portfolioReturnPct } from "./summary";

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
