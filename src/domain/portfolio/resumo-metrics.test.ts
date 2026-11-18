import { describe, expect, it } from "vitest";
import {
  buildAssetAllocationSummaries,
  buildClassAllocationSummaries,
  buildPortfolioPerformanceSummary,
  buildSectorAllocationSummaries,
} from "./resumo-metrics";

describe("resumo-metrics", () => {
  it("agrupa fatias de alocação por classe, setor e ativo ordenadas por valor", () => {
    const rows = [
      { assetId: "a1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo", valueBRL: 3000, isCash: false },
      { assetId: "a2", ticker: "MXRF11", assetClass: "FIIs", sector: "Papel", valueBRL: 6000, isCash: false },
      { assetId: "c1", ticker: "CAIXA", assetClass: "Caixa", sector: null, valueBRL: 1000, isCash: true },
    ];

    const classes = buildClassAllocationSummaries(rows);
    expect(classes.map((c) => c.label)).toEqual(["FIIs", "Ações", "Caixa"]);

    const sectors = buildSectorAllocationSummaries(rows);
    expect(sectors[0]?.label).toBe("Papel");

    const assets = buildAssetAllocationSummaries(rows);
    expect(assets.map((a) => a.label)).toEqual(["MXRF11", "PETR4", "CAIXA"]);
  });

  it("prioriza TWR quando ativo e faz fallback para Custódia Aberta quando TWR indisponível", () => {
    const custody = buildPortfolioPerformanceSummary({
      totalBRL: 15000,
      cashBRL: 5000,
      unrealizedPnlBRL: 500,
      unrealizedPct: 16.67,
    });
    expect(custody.rentabilidadeMode).toBe("custody");
    expect(custody.rentabilidadeValue).toBe("+16.7%");
    expect(custody.irrLabel).toBe("Em formação");

    const twrActive = buildPortfolioPerformanceSummary({
      totalBRL: 15000,
      cashBRL: 0,
      unrealizedPnlBRL: 500,
      unrealizedPct: 10,
      portfolioTwr: { status: "ok", accumulatedRatePct: 18.4, annualizedRatePct: 12.1, monthsElapsed: 18 },
      portfolioIrr: { isEligible: true, annualizedRatePct: 14.5, daysElapsed: 400 },
    });
    expect(twrActive.rentabilidadeMode).toBe("twr");
    expect(twrActive.rentabilidadeValue).toBe("+18.4%");
    expect(twrActive.irrLabel).toBe("+14.5% a.a.");
    expect(twrActive.irrTone).toBe("positive");
  });
});
