import { describe, expect, it } from "vitest";
import { calculateConcentrationRisk } from "./concentration-risk";
import type { PositionRiskInput } from "./concentration-risk";

describe("calculateConcentrationRisk", () => {
  it("deve lidar de forma segura com carteira vazia", () => {
    const result = calculateConcentrationRisk([]);
    expect(result.totalBRL).toBe(0);
    expect(result.riskScore).toBe(100);
    expect(result.riskAlerts).toHaveLength(0);
    expect(result.singleAssetDominance).toBeNull();
  });

  it("deve calcular concentração Top 5 e Top 10 e exposição cambial", () => {
    const positions: PositionRiskInput[] = [
      { id: "1", ticker: "PETR4", assetClass: "acoes", currency: "BRL", valueBRL: 4000 },
      { id: "2", ticker: "VALE3", assetClass: "acoes", currency: "BRL", valueBRL: 2000 },
      { id: "3", ticker: "HGLG11", assetClass: "fiis", currency: "BRL", valueBRL: 1000 },
      { id: "4", ticker: "AAPL", assetClass: "internacional", currency: "USD", valueBRL: 3000 },
    ];
    // Total = 10.000
    // Top 1: PETR4 (4.000 = 40%) -> Alerta de alta concentração
    // USD: 3.000 (30%), BRL: 7.000 (70%)

    const result = calculateConcentrationRisk(positions);

    expect(result.totalBRL).toBe(10000);
    expect(result.singleAssetDominance?.ticker).toBe("PETR4");
    expect(result.singleAssetDominance?.pct).toBe(40);
    expect(result.currencyExposure.usdPct).toBe(30);
    expect(result.currencyExposure.brlPct).toBe(70);

    expect(result.riskAlerts.some((a) => a.code === "SINGLE_ASSET_CONCENTRATION")).toBe(true);
    expect(result.riskScore).toBeLessThan(100);
  });

  it("deve calcular concentração setorial e emitir alertas de setor dominante", () => {
    const positions: PositionRiskInput[] = [
      { id: "1", ticker: "PETR4", assetClass: "Ações", sector: "Petróleo & Gás", currency: "BRL", valueBRL: 3500 },
      { id: "2", ticker: "PRIO3", assetClass: "Ações", sector: "Petróleo & Gás", currency: "BRL", valueBRL: 1500 },
      { id: "3", ticker: "ITUB4", assetClass: "Ações", sector: "Financeiro / Bancos", currency: "BRL", valueBRL: 2000 },
      { id: "4", ticker: "WEGE3", assetClass: "Ações", sector: "Bens de Capital", currency: "BRL", valueBRL: 3000 },
    ];
    // Total = 10.000 BRL
    // Petróleo & Gás: 5.000 (50%) -> Dominância setorial > 40% (crítico)

    const result = calculateConcentrationRisk(positions);

    expect(result.sectorExposure).toHaveLength(3);
    expect(result.topSectorDominance?.sector).toBe("Petróleo & Gás");
    expect(result.topSectorDominance?.pct).toBe(50);
    expect(result.top3SectorsPct).toBe(100);

    expect(result.riskAlerts.some((a) => a.code === "SECTOR_CONCENTRATION")).toBe(true);
  });
});

